import { Category } from '../types';
import { BarcodeLookup, lookupBarcode } from './detection';
import { getCachedProduct, cacheProduct } from '../db/barcodeCache';

/**
 * Product barcode lookup chain.
 *
 * Order matters — cheapest and most trustworthy first:
 *
 *   0. Local SQLite cache        — instant, offline, free
 *   1. Open Food Facts family    — food, beauty, pet food, general products.
 *                                  Free, no key, rate-limited per user (not
 *                                  per app) when called from the device.
 *   2. UPCitemdb free tier       — 500M+ general products (electronics,
 *                                  tools, toys). Keyless; the per-IP limit
 *                                  (100/day) becomes per-user because we call
 *                                  it from the phone, not the Worker.
 *   3. AI guess via the Worker   — last resort, user-triggered because it
 *                                  costs an AI scan and is only a guess.
 *
 * Steps 1–2 run automatically on scan; they cost nothing and can't be wrong
 * in the way an AI guess can. The AI step stays behind an explicit button.
 */

export type LookupSource =
  | 'openfoodfacts'
  | 'openbeautyfacts'
  | 'openproductsfacts'
  | 'openpetfoodfacts'
  | 'upcitemdb'
  | 'ai';

export interface ProductLookupResult extends BarcodeLookup {
  source: LookupSource;
  /** True when this scan was answered from the on-device cache. */
  fromCache: boolean;
}

export const SOURCE_LABEL: Record<LookupSource, string> = {
  openfoodfacts: 'Open Food Facts',
  openbeautyfacts: 'Open Beauty Facts',
  openproductsfacts: 'Open Products Facts',
  openpetfoodfacts: 'Open Pet Food Facts',
  upcitemdb: 'UPCitemdb',
  ai: 'AI guess',
};

export function isOpenFactsSource(source: LookupSource): boolean {
  return source.startsWith('open');
}

/** ODbL licence requires visible attribution wherever the data is shown. */
export const OPEN_FACTS_ATTRIBUTION = 'Product data from Open Food Facts — openfoodfacts.org';

// Open Food Facts asks API users to identify themselves with a custom UA.
const USER_AGENT = 'TallyShot/1.0 (Android; expense tracker)';

interface OpenFactsSource {
  base: string;
  source: LookupSource;
  category: Category;
}

const OPEN_FACTS_SOURCES: OpenFactsSource[] = [
  { base: 'https://world.openfoodfacts.org', source: 'openfoodfacts', category: 'Food & Drink' },
  { base: 'https://world.openbeautyfacts.org', source: 'openbeautyfacts', category: 'Shopping' },
  { base: 'https://world.openproductsfacts.org', source: 'openproductsfacts', category: 'Shopping' },
  { base: 'https://world.openpetfoodfacts.org', source: 'openpetfoodfacts', category: 'Shopping' },
];

async function getJson(url: string, timeoutMs: number): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    // "Not found" arrives as a JSON body (often with a 404 status), so parse
    // whatever came back and let the caller judge it. Anything unparseable is
    // treated as a miss, never an error — a lookup miss must not block the chain.
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * UPC-E is a compressed UPC-A. Databases index the full form, so expand
 * before looking up. Input is the 8-digit form (number system + 6 + check).
 */
function expandUpcE(digits: string): string | null {
  if (!/^[01]\d{7}$/.test(digits)) return null;
  const ns = digits[0];
  const m = digits.slice(1, 7);
  const check = digits[7];
  const last = m[5];
  let body: string;
  if (last === '0' || last === '1' || last === '2') {
    body = m.slice(0, 2) + last + '0000' + m.slice(2, 5);
  } else if (last === '3') {
    body = m.slice(0, 3) + '00000' + m.slice(3, 5);
  } else if (last === '4') {
    body = m.slice(0, 4) + '00000' + m[4];
  } else {
    body = m.slice(0, 5) + '0000' + last;
  }
  return ns + body + check;
}

/**
 * The forms a scanned code should be tried under. UPC-A codes live in these
 * databases as 13-digit EAN-13 with a leading zero (and occasionally as the
 * bare 12 digits), so we try both. Non-retail symbologies (QR, Code 128…)
 * aren't in any product database — empty list sends the UI straight to
 * AI-guess / manual entry without wasted network calls.
 */
export function barcodeCandidates(rawCode: string, barcodeType: string): string[] {
  const type = barcodeType.toLowerCase();
  let digits = rawCode.replace(/\D/g, '');

  if (type.includes('upc_e') || type.includes('upce')) {
    const expanded = digits.length === 8 ? expandUpcE(digits) : null;
    if (expanded) digits = expanded;
  }

  const out: string[] = [];
  if (digits.length === 14) digits = digits.slice(1); // GTIN-14 → EAN-13
  if (digits.length === 13) {
    out.push(digits);
    if (digits.startsWith('0')) out.push(digits.slice(1)); // UPC-A form
  } else if (digits.length === 12) {
    out.push('0' + digits); // EAN-13 form — the canonical one in these DBs
    out.push(digits);
  } else if (digits.length === 8 && (type.includes('ean') || type === '')) {
    out.push(digits); // EAN-8 stands alone; no padding tricks apply
  }
  return out;
}

function titleCase(tag: string): string {
  const clean = tag.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ').trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

async function fetchOpenFacts(
  src: OpenFactsSource,
  code: string
): Promise<ProductLookupResult | null> {
  const url =
    `${src.base}/api/v2/product/${code}.json` +
    `?fields=product_name,brands,quantity,countries_tags`;
  const json = await getJson(url, 6_000);
  if (!json || json.status !== 1 || !json.product) return null;

  const p = json.product;
  const name: string = (p.product_name ?? '').trim();
  const brand: string = ((p.brands ?? '').split(',')[0] ?? '').trim();
  if (!name && !brand) return null; // a row with no name or brand helps nobody

  const quantity: string = (p.quantity ?? '').trim();
  const country: string = Array.isArray(p.countries_tags) && p.countries_tags[0]
    ? titleCase(String(p.countries_tags[0]))
    : '';

  return {
    found: true,
    product_name: name || brand,
    brand: name ? brand : '',
    country,
    suggested_category: src.category,
    // Databases know what the product is, not what this user paid for it.
    estimated_price: 0,
    confidence: 1,
    note: quantity ? `Pack size: ${quantity}` : '',
    source: src.source,
    fromCache: false,
  };
}

function mapUpcCategory(category: string): Category {
  const c = category.toLowerCase();
  if (/food|beverage|grocer|drink/.test(c)) return 'Food & Drink';
  if (/health|medic|pharma/.test(c)) return 'Healthcare';
  if (/electronic|computer|software|office|phone|camera/.test(c)) return 'Office & Tech';
  if (/media|music|movie|video game|toy/.test(c)) return 'Entertainment';
  return 'Shopping';
}

async function fetchUpcItemDb(code: string): Promise<ProductLookupResult | null> {
  const json = await getJson(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, 8_000);
  if (!json || json.code !== 'OK' || !json.items?.length) return null;

  // Guard against any fuzzy matching: the returned item must carry the exact
  // GTIN we asked about (their `ean` is the 13-digit form, `upc` the 12-digit).
  const item = json.items.find((i: any) => {
    const ean = String(i?.ean ?? '');
    const upc = String(i?.upc ?? '');
    return ean === code || upc === code || '0' + upc === code || ean === '0' + code;
  });
  if (!item) return null;
  const title: string = (item.title ?? '').trim();
  const brand: string = (item.brand ?? '').trim();
  if (!title && !brand) return null;

  return {
    found: true,
    product_name: title || brand,
    brand: title ? brand : '',
    country: '',
    suggested_category: mapUpcCategory(String(item.category ?? '')),
    estimated_price: 0,
    confidence: 1,
    note: '',
    source: 'upcitemdb',
    fromCache: false,
  };
}

function cacheKey(rawCode: string): string {
  const digits = rawCode.replace(/\D/g, '');
  return digits || rawCode;
}

/**
 * The free part of the chain: cache → Open *Facts family → UPCitemdb.
 * Returns null when no database knows the product — the UI then offers the
 * AI guess and manual entry, never a dead end.
 */
export async function findProduct(
  rawCode: string,
  barcodeType: string
): Promise<ProductLookupResult | null> {
  const key = cacheKey(rawCode);

  const cached = await getCachedProduct(key);
  if (cached) return { ...cached, fromCache: true };

  const candidates = barcodeCandidates(rawCode, barcodeType);
  for (const src of OPEN_FACTS_SOURCES) {
    for (const code of candidates) {
      const result = await fetchOpenFacts(src, code);
      if (result) {
        await cacheProduct(key, result);
        return result;
      }
    }
  }

  if (candidates.length > 0) {
    const result = await fetchUpcItemDb(candidates[0]);
    if (result) {
      await cacheProduct(key, result);
      return result;
    }
  }

  return null;
}

/**
 * Last resort: ask Claude via the Worker. Caller is responsible for gating
 * on the free-scan limit and counting the scan — this is the only step in
 * the chain that costs money.
 */
export async function aiGuessProduct(
  rawCode: string,
  barcodeType: string,
  currency: string
): Promise<ProductLookupResult> {
  const guess = await lookupBarcode(rawCode, barcodeType, currency);
  const result: ProductLookupResult = { ...guess, source: 'ai', fromCache: false };
  // Cache only real identifications; a shrugged "not found" shouldn't stick,
  // because the databases gain thousands of products a day.
  if (guess.found && guess.product_name?.trim()) {
    await cacheProduct(cacheKey(rawCode), result);
  }
  return result;
}
