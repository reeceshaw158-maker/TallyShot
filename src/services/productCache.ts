/**
 * Product lookup cache — Step 3 of the food intelligence feature.
 *
 * Strategy: stale-while-revalidate.
 *   1. Caller invokes `lookup(barcode)`.
 *   2. If we have a cached row, return it immediately as `{ fromCache: true }`.
 *      If the row is older than STALE_AFTER_MS we kick off a background
 *      refresh so the next view shows fresh data.
 *   3. If we have nothing, hit Open Food Facts directly. Negative results
 *      (not_found / not_grocery) are cached too so the same unknown barcode
 *      doesn't keep hitting the network on subsequent scans.
 *
 * Offline handling: the caller surfaces an 'offline' state when we throw
 * `ProductLookupOffline`. We deliberately distinguish offline from generic
 * network errors so the UI can copy-tune the message.
 *
 * The actual Open Food Facts API is public, anonymous, and rate-limited
 * politely. Endpoint shape:
 *   GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json
 *     ?fields=product_name,brands,image_url,categories_tags,quantity,
 *             nutriscore_grade,nova_group,ecoscore_grade,nutriments
 */
import { getDb } from '../db/schema';

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product';
const OFF_FIELDS = [
  'product_name',
  'brands',
  'image_url',
  'image_small_url',
  'image_front_small_url',
  'categories_tags',
  'quantity',
  'nutriscore_grade',
  'nova_group',
  'ecoscore_grade',
  'nutriments',
].join(',');

// 14 days — OFF data is community-curated and rarely changes for a given
// barcode. Refreshing more often wastes bandwidth and burns through the
// public API's politeness budget.
const STALE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;

export type ProductStatus = 'found' | 'not_found' | 'not_grocery';

export interface ProductRecord {
  barcode: string;
  status: ProductStatus;
  name: string | null;
  brand: string | null;
  imageUrl: string | null;
  categories: string | null;
  quantity: string | null;
  nutriscore: string | null;     // 'a'..'e'
  novaGroup: number | null;      // 1..4
  ecoscore: string | null;       // 'a'..'e'
  /** Per-100g values from OFF — only the fields we care about, normalised. */
  nutriments: Nutriments | null;
  fetchedAt: string;
}

export interface Nutriments {
  energyKcal100g: number | null;
  fat100g: number | null;
  saturatedFat100g: number | null;
  sugars100g: number | null;
  salt100g: number | null;
  proteins100g: number | null;
  fiber100g: number | null;
  carbohydrates100g: number | null;
}

export interface LookupResult {
  record: ProductRecord;
  /** True when the record came straight from the local cache. */
  fromCache: boolean;
  /** Set when fromCache=true and a background refresh is in flight. */
  refreshing: boolean;
}

export class ProductLookupOffline extends Error {
  constructor() { super('offline'); this.name = 'ProductLookupOffline'; }
}
export class ProductLookupFailed extends Error {
  constructor(message?: string) { super(message); this.name = 'ProductLookupFailed'; }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Look up a product by barcode. Always cache-first; falls back to network.
 *
 * Throws `ProductLookupOffline` when both the cache misses and the network
 * is unreachable, and `ProductLookupFailed` for unexpected errors. The
 * caller decides whether to retry.
 */
export async function lookup(barcode: string): Promise<LookupResult> {
  const clean = sanitizeBarcode(barcode);
  if (!clean) throw new ProductLookupFailed('invalid_barcode');

  const cached = await readCache(clean);
  if (cached) {
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    const stale = age > STALE_AFTER_MS;
    if (stale) {
      // Fire-and-forget refresh. Errors are swallowed — the user already has
      // a usable record on screen; we'll try again next time they look it up.
      void refreshInBackground(clean);
    }
    return { record: cached, fromCache: true, refreshing: stale };
  }

  // No cache — must hit the network. This is the only path that can surface
  // offline / failure to the user.
  const fresh = await fetchAndCache(clean);
  return { record: fresh, fromCache: false, refreshing: false };
}

/** Imperatively refresh a cached row from OFF. Resolves on completion. */
export async function refresh(barcode: string): Promise<ProductRecord> {
  return fetchAndCache(sanitizeBarcode(barcode));
}

// ── Internals ────────────────────────────────────────────────────────────────

function sanitizeBarcode(raw: string): string {
  // Strip everything that isn't a digit. OFF accepts EAN-13, EAN-8, UPC-A,
  // UPC-E — all numeric. Code 128 grocery codes are usually digits too;
  // anything else won't match a product anyway.
  return String(raw).replace(/\D+/g, '');
}

async function refreshInBackground(barcode: string): Promise<void> {
  try { await fetchAndCache(barcode); } catch { /* swallow — see lookup() */ }
}

async function fetchAndCache(barcode: string): Promise<ProductRecord> {
  const url = `${OFF_BASE}/${barcode}.json?fields=${encodeURIComponent(OFF_FIELDS)}`;

  let res: Response;
  try {
    res = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS);
  } catch (err: any) {
    // RN throws TypeError 'Network request failed' on actual no-network. We
    // can't reliably distinguish offline from DNS hiccups, but treating any
    // network-layer error as offline is the right UX call: the message just
    // says "you're offline" and the user can retry once their bars come back.
    throw new ProductLookupOffline();
  }

  if (!res.ok) {
    // 404 ≠ "no product" — OFF returns 200 with status: 0 for unknown
    // barcodes. A non-2xx here means OFF itself is unhappy.
    throw new ProductLookupFailed(`http_${res.status}`);
  }

  let json: any;
  try { json = await res.json(); }
  catch { throw new ProductLookupFailed('bad_json'); }

  const record = normalize(barcode, json);
  await writeCache(record);
  return record;
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  // AbortController is available in RN's Hermes runtime since RN 0.60+.
  // Wrapping the fetch lets us hard-fail slow lookups instead of leaving the
  // user staring at a spinner.
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, {
      method: 'GET',
      signal: ac.signal,
      headers: {
        // OFF asks users to identify themselves so they can rate-limit
        // bad actors without blocking everyone. Keep this honest.
        'User-Agent': 'TallyShot/1.0 (https://tallyshot.app)',
        'Accept': 'application/json',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function normalize(barcode: string, body: any): ProductRecord {
  const now = new Date().toISOString();

  // OFF response shape: { status: 0|1, product: {...}, status_verbose?: '...' }
  // status === 0 means "barcode not in database".
  if (!body || body.status === 0 || !body.product) {
    return blankRecord(barcode, 'not_found', now);
  }

  const p = body.product;
  const categories: string = Array.isArray(p.categories_tags) ? p.categories_tags.join(',') : '';

  // Phase 1 is grocery-only. OFF tags everything with at least one of these
  // for actual food/drink. Cleaning products and pet food sneak in too —
  // we explicitly exclude the obvious non-grocery noise.
  const isFoodOrDrink =
    /\b(en:)?(foods?|beverages?|drinks?|dairy|snacks?|sweets|breakfast|meals?|condiments?|sauces?|cereals?|fruits?|vegetables?|meat|fish|plant-based|baby-foods?)\b/i.test(categories);
  const isExcluded =
    /\b(en:)?(non-food|cleaning|cosmetics|hygiene|pet-food|tobacco|alcohol-only)\b/i.test(categories);

  if (!isFoodOrDrink || isExcluded) {
    // Still cache the name/brand so the not_grocery screen can show what
    // the user actually scanned ("Heineken 6-pack? Not a grocery.").
    return {
      barcode,
      status: 'not_grocery',
      name: pickString(p.product_name, null),
      brand: pickString(p.brands, null),
      imageUrl: pickString(p.image_front_small_url, p.image_small_url, p.image_url, null),
      categories: categories || null,
      quantity: pickString(p.quantity, null),
      nutriscore: null,
      novaGroup: null,
      ecoscore: null,
      nutriments: null,
      fetchedAt: now,
    };
  }

  return {
    barcode,
    status: 'found',
    name: pickString(p.product_name, null),
    brand: pickString(p.brands, null),
    imageUrl: pickString(p.image_front_small_url, p.image_small_url, p.image_url, null),
    categories: categories || null,
    quantity: pickString(p.quantity, null),
    nutriscore: pickGrade(p.nutriscore_grade),
    novaGroup: pickInt(p.nova_group, 1, 4),
    ecoscore: pickGrade(p.ecoscore_grade),
    nutriments: extractNutriments(p.nutriments),
    fetchedAt: now,
  };
}

function pickString(...candidates: any[]): string | null {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim();
  }
  return null;
}

function pickGrade(v: any): string | null {
  if (typeof v !== 'string') return null;
  const g = v.toLowerCase();
  return /^[a-e]$/.test(g) ? g : null;
}

function pickInt(v: any, min: number, max: number): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded >= min && rounded <= max ? rounded : null;
}

function extractNutriments(n: any): Nutriments | null {
  if (!n || typeof n !== 'object') return null;
  const num = (k: string): number | null => {
    const v = n[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const parsed = Number(v);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };
  const out: Nutriments = {
    energyKcal100g:    num('energy-kcal_100g'),
    fat100g:           num('fat_100g'),
    saturatedFat100g:  num('saturated-fat_100g'),
    sugars100g:        num('sugars_100g'),
    salt100g:          num('salt_100g'),
    proteins100g:      num('proteins_100g'),
    fiber100g:         num('fiber_100g'),
    carbohydrates100g: num('carbohydrates_100g'),
  };
  // If literally nothing parsed, treat as null so the UI can hide the
  // nutrition card cleanly instead of rendering 8 dashes.
  const anyValue = Object.values(out).some((v) => v !== null);
  return anyValue ? out : null;
}

function blankRecord(barcode: string, status: ProductStatus, fetchedAt: string): ProductRecord {
  return {
    barcode, status, fetchedAt,
    name: null, brand: null, imageUrl: null, categories: null, quantity: null,
    nutriscore: null, novaGroup: null, ecoscore: null, nutriments: null,
  };
}

// ── SQLite cache ─────────────────────────────────────────────────────────────

async function readCache(barcode: string): Promise<ProductRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    `SELECT * FROM products WHERE barcode = ?`, [barcode]
  );
  if (!row) return null;
  return {
    barcode:     row.barcode,
    status:      row.status as ProductStatus,
    name:        row.name ?? null,
    brand:       row.brand ?? null,
    imageUrl:    row.image_url ?? null,
    categories:  row.categories ?? null,
    quantity:    row.quantity ?? null,
    nutriscore:  row.nutriscore ?? null,
    novaGroup:   row.nova_group ?? null,
    ecoscore:    row.ecoscore ?? null,
    nutriments:  row.nutriments ? safeParse(row.nutriments) : null,
    fetchedAt:   row.fetched_at,
  };
}

function safeParse(s: string): Nutriments | null {
  try { return JSON.parse(s) as Nutriments; } catch { return null; }
}

async function writeCache(p: ProductRecord): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO products
       (barcode, status, name, brand, image_url, categories, quantity,
        nutriscore, nova_group, ecoscore, nutriments, fetched_at, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'openfoodfacts')
     ON CONFLICT(barcode) DO UPDATE SET
       status      = excluded.status,
       name        = excluded.name,
       brand       = excluded.brand,
       image_url   = excluded.image_url,
       categories  = excluded.categories,
       quantity    = excluded.quantity,
       nutriscore  = excluded.nutriscore,
       nova_group  = excluded.nova_group,
       ecoscore    = excluded.ecoscore,
       nutriments  = excluded.nutriments,
       fetched_at  = excluded.fetched_at`,
    [
      p.barcode,
      p.status,
      p.name,
      p.brand,
      p.imageUrl,
      p.categories,
      p.quantity,
      p.nutriscore,
      p.novaGroup,
      p.ecoscore,
      p.nutriments ? JSON.stringify(p.nutriments) : null,
      p.fetchedAt,
    ]
  );
}
