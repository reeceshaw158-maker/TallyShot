import { Category } from '../types';
import { lookupBarcode } from './detection';
import { getCachedProduct, cacheProduct, cacheMiss, wasRecentMiss } from '../db/barcodeCache';

/**
 * Product barcode lookup chain.
 *
 * Order matters — cheapest and most trustworthy first:
 *
 *   0. Local SQLite cache        — instant, offline, free
 *   1. Open Food Facts family    — food, beauty, pet food, general products.
 *                                  Free, no key, called from the device so the
 *                                  rate limit is per user, not per app.
 *   2. UPCitemdb free tier       — 500M+ general products (electronics,
 *                                  tools, toys). Keyless.
 *   3. AI guess via the Worker   — last resort, user-triggered.
 *   4. Manual entry              — always available, never a dead end.
 *
 * Steps 1–2 run automatically on scan; they cost nothing. The AI step stays
 * behind an explicit button because it's the only one that can be confidently
 * wrong rather than simply absent.
 *
 * ## Why v3 and not v2
 *
 * Open Food Facts marks v3 as the recommended version, and it earns that here
 * for one specific reason: **it normalises GTINs server-side**. Looking up
 * Coca-Cola as `049000006346` (12-digit UPC-A) and `0049000006346` (13-digit
 * EAN) returns the identical product. Under v2 we sent both forms of every
 * code to every database — up to 8 requests per scan.
 *
 * That mattered because OFF enforces **15 requests/min/IP for product reads**
 * and reserves the right to IP-ban over it
 * (https://openfoodfacts.github.io/openfoodfacts-server/api/). At 8 calls a
 * scan, two scans in a minute put a user at the edge of a ban. One canonical
 * candidate per source brings the worst case to 5, and `RateBudget` below
 * keeps even a fast scanner under the ceiling.
 */

export type LookupSource =
  | 'openfoodfacts'
  | 'openbeautyfacts'
  | 'openproductsfacts'
  | 'openpetfoodfacts'
  | 'upcitemdb'
  | 'ai';

/**
 * What sort of thing this is, which decides how the card is laid out.
 * Derived from the database it came from plus its category tags.
 */
export type ProductKind = 'food' | 'drink' | 'alcohol' | 'cosmetic' | 'petfood' | 'other';

/** Where an ingredient list came from. Shown to the user — provenance matters. */
export type IngredientsOrigin = 'database' | 'photo';

export interface ProductCard {
  barcode: string;
  barcodeType: string;
  name: string;
  brand: string;
  kind: ProductKind;
  imageUrl: string | null;
  /** Free-text pack size straight from the database, e.g. "400 g e". */
  quantity: string;
  country: string;
  categoriesTags: string[];

  /** Raw Open Food Facts nutriments block; nutrition.ts turns it into rows. */
  nutriments: Record<string, unknown> | null;
  nutriscoreGrade: string | null;
  novaGroup: number | null;

  ingredientsText: string | null;
  ingredientsOrigin: IngredientsOrigin | null;
  allergensTags: string[];
  tracesTags: string[];
  additivesTags: string[];

  /** % alcohol by volume, when the database records one. */
  abv: number | null;

  source: LookupSource;
  fromCache: boolean;
  /** Only meaningful for `source: 'ai'` — database matches are exact. */
  confidence: number;
  estimatedPrice: number;
  suggestedCategory: Category;
  note: string;
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

/**
 * Open Food Facts asks API users to identify themselves as
 * `AppName/Version (ContactEmail)`.
 *
 * Deliberately a project address and not the developer's personal email: this
 * header is sent to third-party servers on every single lookup, and a personal
 * address in it would be handed to those servers by every user of the app.
 */
const USER_AGENT = 'TallyShot/1.1 (hello@tallyshot.app)';

/* ------------------------------------------------------------------ *
 * Rate budget
 * ------------------------------------------------------------------ */

/**
 * A sliding-window counter that keeps us under Open Food Facts' published
 * ceiling of 15 product reads/min/IP.
 *
 * We stop at 12 to leave headroom: the limit is per IP, and a user on a shared
 * or carrier-NAT'd connection is not the only person behind it. Running out is
 * not an error — the chain simply skips the remaining Open*Facts sources and
 * carries on to UPCitemdb, and the caller can tell the user we didn't check
 * everything rather than claiming the product doesn't exist.
 */
class RateBudget {
  private hits: number[] = [];

  constructor(
    private readonly max: number,
    private readonly windowMs: number
  ) {}

  private prune() {
    const cutoff = Date.now() - this.windowMs;
    this.hits = this.hits.filter((t) => t > cutoff);
  }

  get available(): boolean {
    this.prune();
    return this.hits.length < this.max;
  }

  spend() {
    this.prune();
    this.hits.push(Date.now());
  }
}

const offBudget = new RateBudget(12, 60_000);
/** Their search endpoint has its own, lower ceiling of 10/min. */
const searchBudget = new RateBudget(6, 60_000);

/* ------------------------------------------------------------------ *
 * HTTP
 * ------------------------------------------------------------------ */

async function getJson(url: string, timeoutMs: number): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    // A miss arrives as JSON with a 404 status, so parse whatever came back and
    // let the caller judge it. When OFF throttles us it returns an HTML holding
    // page instead of JSON — .json() throws on that, which lands in the catch
    // and is treated as a miss. Never an exception out of this function: a
    // lookup failure must not break a scan.
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ *
 * Barcode normalisation
 * ------------------------------------------------------------------ */

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
 * The single canonical form to look a scanned code up under.
 *
 * v3 normalises UPC-A to EAN-13 itself, so unlike the old v2 code we send one
 * candidate rather than two. Returns null for non-retail symbologies (QR,
 * Code 128, …) which aren't in any product database — that sends the UI
 * straight to AI/manual without wasting a request from the rate budget.
 */
export function canonicalBarcode(rawCode: string, barcodeType: string): string | null {
  const type = barcodeType.toLowerCase();
  let digits = rawCode.replace(/\D/g, '');

  if (type.includes('upc_e') || type.includes('upce')) {
    const expanded = digits.length === 8 ? expandUpcE(digits) : null;
    if (expanded) digits = expanded;
  }

  if (digits.length === 14) digits = digits.slice(1); // GTIN-14 carton → EAN-13
  if (digits.length === 13 || digits.length === 12 || digits.length === 8) return digits;
  return null;
}

/** True for symbologies that could plausibly be in a product database. */
export function isRetailBarcode(rawCode: string, barcodeType: string): boolean {
  return canonicalBarcode(rawCode, barcodeType) !== null;
}

/**
 * ML Kit's numeric barcode formats.
 *
 * Needed because expo-camera is inconsistent about `type` on Android: the live
 * `onBarcodeScanned` callback runs it through `BarcodeType.mapFormatToString`
 * and yields "ean13", while `scanFromURLAsync` serialises the raw ML Kit
 * constant with `putInt("type", ...)` and yields 32 — even though both are
 * typed as `string` in expo-camera's own definitions.
 *
 * Left unhandled, a code picked off the frozen confirmation frame would arrive
 * with type "32", which fails every `type.includes('upc_e')` test and so would
 * silently skip UPC-E expansion. Normalising here means the rest of the app
 * only ever deals in the string form.
 */
const MLKIT_FORMATS: Record<number, string> = {
  1: 'code128',
  2: 'code39',
  4: 'code93',
  8: 'codabar',
  16: 'datamatrix',
  32: 'ean13',
  64: 'ean8',
  128: 'itf14',
  256: 'qr',
  512: 'upc_a',
  1024: 'upc_e',
  2048: 'pdf417',
  4096: 'aztec',
};

export function normaliseBarcodeType(type: unknown): string {
  if (typeof type === 'number') return MLKIT_FORMATS[type] ?? 'unknown';
  const s = String(type ?? '').trim();
  if (!s) return 'unknown';
  // A numeric string is the same constant that survived a JSON round-trip.
  if (/^\d+$/.test(s)) return MLKIT_FORMATS[Number(s)] ?? 'unknown';
  return s.toLowerCase();
}

/* ------------------------------------------------------------------ *
 * Open *Facts
 * ------------------------------------------------------------------ */

interface OpenFactsSource {
  base: string;
  source: LookupSource;
  category: Category;
  defaultKind: ProductKind;
}

const OPEN_FACTS_SOURCES: OpenFactsSource[] = [
  {
    base: 'https://world.openfoodfacts.org',
    source: 'openfoodfacts',
    category: 'Food & Drink',
    defaultKind: 'food',
  },
  {
    base: 'https://world.openbeautyfacts.org',
    source: 'openbeautyfacts',
    category: 'Shopping',
    defaultKind: 'cosmetic',
  },
  {
    base: 'https://world.openproductsfacts.org',
    source: 'openproductsfacts',
    category: 'Shopping',
    defaultKind: 'other',
  },
  {
    base: 'https://world.openpetfoodfacts.org',
    source: 'openpetfoodfacts',
    category: 'Shopping',
    defaultKind: 'petfood',
  },
];

/**
 * Everything the card can display, requested in one call. Asking for named
 * fields rather than the whole product keeps the response small — a full OFF
 * product document is hundreds of keys.
 */
const OFF_FIELDS = [
  'product_name',
  'product_name_en',
  'generic_name',
  'brands',
  'quantity',
  'countries_tags',
  'categories_tags',
  'image_front_small_url',
  'image_front_url',
  'nutriscore_grade',
  'nova_group',
  'nutriments',
  'ingredients_text',
  'ingredients_text_en',
  'allergens_tags',
  'traces_tags',
  'additives_tags',
].join(',');

function titleCase(tag: string): string {
  const clean = tag.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ').trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
}

/**
 * Decide what sort of product this is.
 *
 * Alcohol is checked before drink and food because an alcoholic drink is
 * tagged as a beverage too, and the card we want for it is quite different.
 * A recorded ABV above 0.5% is treated as decisive even when the category
 * tags are missing — plenty of imported bottles have thin tagging.
 */
function classifyKind(
  tags: string[],
  abv: number | null,
  fallback: ProductKind
): ProductKind {
  const t = tags.map((x) => x.toLowerCase()).join(' ');

  const alcoholic =
    /alcoholic-beverage|\bbeers?\b|\bwines?\b|spirits|whisk|vodka|\brum\b|\bgin\b|cider|liqueur|champagne|prosecco/.test(
      t
    );
  if (alcoholic || (abv !== null && abv >= 0.5)) return 'alcohol';

  if (/pet-food|dog|cat-food/.test(t)) return 'petfood';

  if (
    /\bcosmetic|beauty|skin-care|hair-care|make-up|makeup|shampoo|deodorant|toothpaste|perfume|moisturi/.test(
      t
    )
  ) {
    return 'cosmetic';
  }

  if (/beverage|\bdrinks?\b|juice|\bwaters?\b|sodas|infusion/.test(t)) return 'drink';

  if (fallback === 'food' && tags.length === 0) return 'food';
  return fallback;
}

function emptyCard(barcode: string, barcodeType: string): ProductCard {
  return {
    barcode,
    barcodeType,
    name: '',
    brand: '',
    kind: 'other',
    imageUrl: null,
    quantity: '',
    country: '',
    categoriesTags: [],
    nutriments: null,
    nutriscoreGrade: null,
    novaGroup: null,
    ingredientsText: null,
    ingredientsOrigin: null,
    allergensTags: [],
    tracesTags: [],
    additivesTags: [],
    abv: null,
    source: 'openfoodfacts',
    fromCache: false,
    confidence: 1,
    estimatedPrice: 0,
    suggestedCategory: 'Other',
    note: '',
  };
}

async function fetchOpenFacts(
  src: OpenFactsSource,
  code: string,
  barcodeType: string
): Promise<ProductCard | null> {
  if (!offBudget.available) return null;
  offBudget.spend();

  const json = await getJson(
    `${src.base}/api/v3/product/${code}.json?fields=${OFF_FIELDS}`,
    6_000
  );

  // v3 reports success as either "success" or "success_with_warnings" (a
  // normalised barcode counts as a warning), so the authoritative check is
  // result.id, not the status string.
  if (!json || json.result?.id !== 'product_found' || !json.product) return null;

  const p = json.product;
  const name = str(p.product_name) || str(p.product_name_en) || str(p.generic_name);
  const brand = str((str(p.brands).split(',')[0] ?? ''));
  if (!name && !brand) return null; // a row with neither helps nobody

  const nutriments =
    p.nutriments && typeof p.nutriments === 'object'
      ? (p.nutriments as Record<string, unknown>)
      : null;

  const abvRaw = nutriments ? Number(nutriments['alcohol_value'] ?? nutriments['alcohol']) : NaN;
  const abv = Number.isFinite(abvRaw) && abvRaw > 0 ? abvRaw : null;

  const categoriesTags = strArray(p.categories_tags);
  const countryTags = strArray(p.countries_tags);
  const novaRaw = Number(p.nova_group);

  const card = emptyCard(code, barcodeType);
  return {
    ...card,
    name: name || brand,
    brand: name ? brand : '',
    kind: classifyKind(categoriesTags, abv, src.defaultKind),
    imageUrl: str(p.image_front_small_url) || str(p.image_front_url) || null,
    quantity: str(p.quantity),
    country: countryTags[0] ? titleCase(countryTags[0]) : '',
    categoriesTags,
    nutriments,
    nutriscoreGrade: str(p.nutriscore_grade).toLowerCase() || null,
    novaGroup: Number.isFinite(novaRaw) && novaRaw >= 1 && novaRaw <= 4 ? novaRaw : null,
    ingredientsText: str(p.ingredients_text) || str(p.ingredients_text_en) || null,
    ingredientsOrigin: str(p.ingredients_text) || str(p.ingredients_text_en) ? 'database' : null,
    allergensTags: strArray(p.allergens_tags),
    tracesTags: strArray(p.traces_tags),
    additivesTags: strArray(p.additives_tags),
    abv,
    source: src.source,
    suggestedCategory: src.category,
  };
}

/* ------------------------------------------------------------------ *
 * UPCitemdb
 * ------------------------------------------------------------------ */

function mapUpcCategory(category: string): Category {
  const c = category.toLowerCase();
  if (/food|beverage|grocer|drink/.test(c)) return 'Food & Drink';
  if (/health|medic|pharma/.test(c)) return 'Healthcare';
  if (/electronic|computer|software|office|phone|camera/.test(c)) return 'Office & Tech';
  if (/media|music|movie|video game|toy/.test(c)) return 'Entertainment';
  return 'Shopping';
}

async function fetchUpcItemDb(code: string, barcodeType: string): Promise<ProductCard | null> {
  const json = await getJson(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, 8_000);
  if (!json || json.code !== 'OK' || !json.items?.length) return null;

  // Guard against fuzzy matching: the returned item must carry the exact GTIN
  // we asked about (their `ean` is the 13-digit form, `upc` the 12-digit).
  const item = json.items.find((i: any) => {
    const ean = String(i?.ean ?? '');
    const upc = String(i?.upc ?? '');
    return ean === code || upc === code || '0' + upc === code || ean === '0' + code;
  });
  if (!item) return null;

  const title = str(item.title);
  const brand = str(item.brand);
  if (!title && !brand) return null;

  const images = strArray(item.images);
  const card = emptyCard(code, barcodeType);
  return {
    ...card,
    name: title || brand,
    brand: title ? brand : '',
    kind: 'other',
    imageUrl: images[0] ?? null,
    source: 'upcitemdb',
    suggestedCategory: mapUpcCategory(str(item.category)),
  };
}

/* ------------------------------------------------------------------ *
 * The chain
 * ------------------------------------------------------------------ */

function cacheKey(rawCode: string): string {
  const digits = rawCode.replace(/\D/g, '');
  return digits || rawCode;
}

export interface LookupOutcome {
  card: ProductCard | null;
  /**
   * True when we ran out of rate budget before checking every database, so
   * "not found" would be an overstatement. The UI says "couldn't check them
   * all right now" instead of "not in any database".
   */
  incomplete: boolean;
}

/**
 * The free part of the chain: cache → Open *Facts family → UPCitemdb.
 *
 * A null card means no database knows the product; the UI then offers the AI
 * guess and manual entry. Never throws.
 */
export async function findProduct(
  rawCode: string,
  barcodeType: string
): Promise<LookupOutcome> {
  const key = cacheKey(rawCode);

  const cached = await getCachedProduct(key);
  if (cached) return { card: { ...cached, fromCache: true }, incomplete: false };

  const code = canonicalBarcode(rawCode, barcodeType);
  // Not a retail symbology — no product database will have it.
  if (!code) return { card: null, incomplete: false };

  // A miss we recorded recently. The databases genuinely do gain thousands of
  // products a day, so this expires quickly rather than being permanent.
  if (await wasRecentMiss(key)) return { card: null, incomplete: false };

  let incomplete = false;

  for (const src of OPEN_FACTS_SOURCES) {
    if (!offBudget.available) {
      incomplete = true;
      break;
    }
    const card = await fetchOpenFacts(src, code, barcodeType);
    if (card) {
      await cacheProduct(key, card);
      return { card, incomplete: false };
    }
  }

  const upc = await fetchUpcItemDb(code, barcodeType);
  if (upc) {
    await cacheProduct(key, upc);
    return { card: upc, incomplete: false };
  }

  // Only remember a miss when we actually finished the chain.
  if (!incomplete) await cacheMiss(key);
  return { card: null, incomplete };
}

/**
 * Last resort: ask Claude via the Worker. The caller gates on the free-scan
 * limit and counts the scan — this is the only step in the chain that costs
 * anything.
 */
export async function aiGuessProduct(
  rawCode: string,
  barcodeType: string,
  currency: string
): Promise<ProductCard> {
  const guess = await lookupBarcode(rawCode, barcodeType, currency);
  const base = emptyCard(rawCode, barcodeType);
  const card: ProductCard = {
    ...base,
    name: guess.product_name?.trim() ?? '',
    brand: guess.brand?.trim() ?? '',
    country: guess.country?.trim() ?? '',
    kind: guess.suggested_category === 'Food & Drink' ? 'food' : 'other',
    source: 'ai',
    confidence: guess.confidence,
    estimatedPrice: guess.estimated_price,
    suggestedCategory: guess.suggested_category as Category,
    note: guess.note ?? '',
  };
  // Cache real identifications only — a shrugged "not found" shouldn't stick.
  if (guess.found && card.name) await cacheProduct(cacheKey(rawCode), card);
  return card;
}

/**
 * Attach an ingredient list read off a photo of the pack.
 *
 * Open Beauty Facts holds names and photos for most cosmetics but very few
 * INCI lists, so for cosmetics this is often the only way to get one. The
 * origin is recorded so the card can say where the list came from.
 */
export function withPhotographedIngredients(card: ProductCard, text: string): ProductCard {
  const clean = text.trim();
  if (!clean) return card;
  return { ...card, ingredientsText: clean, ingredientsOrigin: 'photo' };
}

/* ------------------------------------------------------------------ *
 * Alternatives
 * ------------------------------------------------------------------ */

export interface Alternative {
  barcode: string;
  name: string;
  brand: string;
  imageUrl: string | null;
  nutriscoreGrade: string;
}

/**
 * Better-scoring products from the same Open Food Facts category.
 *
 * Button-triggered, never automatic. Their search endpoint is capped at
 * 10 requests/min/IP — lower than the product endpoint — and it is the first
 * thing to start returning an HTML holding page when they throttle. Firing one
 * on every poor-scoring scan would burn that budget in seconds.
 *
 * Returns an empty list rather than throwing: "no alternatives right now" is a
 * fine outcome, an error dialog over a nice-to-have is not.
 */
export async function findAlternatives(
  card: ProductCard,
  limit = 6
): Promise<Alternative[]> {
  if (card.kind !== 'food' && card.kind !== 'drink') return [];
  if (!searchBudget.available) return [];

  // Prefer the most specific category tag — the last one is usually the
  // narrowest ("en:sweet-spreads" rather than "en:breakfasts"), which makes
  // for a genuinely comparable alternative rather than a random other food.
  const tag = [...card.categoriesTags]
    .reverse()
    .find((t) => /^en:/.test(t) && t.length > 4);
  if (!tag) return [];

  searchBudget.spend();

  const url =
    `https://world.openfoodfacts.org/api/v2/search` +
    `?categories_tags=${encodeURIComponent(tag)}` +
    `&nutrition_grades_tags=a` +
    `&fields=code,product_name,brands,nutriscore_grade,image_front_small_url` +
    `&page_size=${limit * 2}`;

  const json = await getJson(url, 9_000);
  const products = Array.isArray(json?.products) ? json.products : [];

  const out: Alternative[] = [];
  for (const p of products) {
    const grade = str(p?.nutriscore_grade).toLowerCase();
    const name = str(p?.product_name);
    const barcode = str(p?.code);
    if (!name || !barcode || barcode === card.barcode) continue;
    if (!/^[a-e]$/.test(grade)) continue;
    out.push({
      barcode,
      name,
      brand: str((str(p?.brands).split(',')[0] ?? '')),
      imageUrl: str(p?.image_front_small_url) || null,
      nutriscoreGrade: grade,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Bridge to the receipt flow
 * ------------------------------------------------------------------ */

/**
 * Turn a product card into something the Review screen already understands,
 * so barcode scanning reuses the whole existing edit/save path.
 */
export function cardToExtraction(card: ProductCard, currency: string) {
  const price = card.estimatedPrice > 0 ? Number(card.estimatedPrice.toFixed(2)) : 0;
  const name = card.name || 'Unknown product';
  return {
    merchant: card.brand || '',
    date: new Date().toLocaleDateString('en-CA'),
    currency,
    line_items: [{ description: name, quantity: 1, unit_price: price, total: price }],
    subtotal: price,
    tax: 0,
    total: price,
    payment_method: null,
    invoice_number: card.barcode,
    suggested_category: card.suggestedCategory,
  };
}
