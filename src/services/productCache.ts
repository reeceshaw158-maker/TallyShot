/**
 * Product lookup cache — stale-while-revalidate, multi-source waterfall.
 *
 * Tier 0: SQLite local cache
 * Tier 1: Open Food Facts (food/grocery)
 * Tier 2: Open Beauty Facts (cosmetics/personal care)
 * Tier 3: Open Products Facts (general consumer products)
 *
 * Negative results are cached so the same unknown barcode doesn't keep
 * hitting the network on repeated scans.
 */
import { getDb } from '../db/schema';

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product';
const OBF_BASE = 'https://world.openbeautyfacts.org/api/v2/product';
const OPF_BASE = 'https://world.openproductsfacts.org/api/v2/product';

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
  'ingredients_text_en',
  'ingredients_text',
  'allergens_tags',
  'allergens',
  'countries',
  'countries_tags',
  'product_type',
  'labels_tags',
].join(',');

const STALE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 7_000;

export type ProductStatus = 'found' | 'not_found' | 'not_grocery';
export type ProductSource = 'openfoodfacts' | 'openbeautyfacts' | 'openproductsfacts' | 'manual';

export interface ProductRecord {
  barcode: string;
  status: ProductStatus;
  name: string | null;
  brand: string | null;
  imageUrl: string | null;
  categories: string | null;
  quantity: string | null;
  nutriscore: string | null;
  novaGroup: number | null;
  ecoscore: string | null;
  nutriments: Nutriments | null;
  ingredients: string | null;
  allergens: string | null;
  countries: string | null;
  fetchedAt: string;
  source: ProductSource;
  aiSummary: string | null;
  aiGeneratedAt: string | null;
  lastSeenAt: string | null;
  description: string | null;
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
  fromCache: boolean;
  refreshing: boolean;
}

export class ProductLookupOffline extends Error {
  constructor() { super('offline'); this.name = 'ProductLookupOffline'; }
}
export class ProductLookupFailed extends Error {
  constructor(message?: string) { super(message); this.name = 'ProductLookupFailed'; }
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function lookup(barcode: string): Promise<LookupResult> {
  const clean = sanitizeBarcode(barcode);
  if (!clean) throw new ProductLookupFailed('invalid_barcode');

  const cached = await readCache(clean);
  if (cached) {
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    const stale = age > STALE_AFTER_MS;
    if (stale) void refreshInBackground(clean);
    void updateLastSeen(clean);
    return { record: cached, fromCache: true, refreshing: stale };
  }

  const fresh = await fetchFromAnySource(clean);
  return { record: fresh, fromCache: false, refreshing: false };
}

export async function refresh(barcode: string): Promise<ProductRecord> {
  return fetchFromAnySource(sanitizeBarcode(barcode));
}

export async function clearAllProductScans(): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM products`);
}

export async function deleteProductScan(barcode: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM products WHERE barcode = ?`, [barcode]);
}

export async function saveAiSummary(barcode: string, summary: string): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(
      `UPDATE products SET ai_summary = ?, ai_generated_at = ? WHERE barcode = ?`,
      [summary, new Date().toISOString(), barcode]
    );
  } catch { /* swallow — non-critical */ }
}

export async function getRecentProducts(limit = 10): Promise<ProductRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM products WHERE status = 'found'
     ORDER BY COALESCE(last_seen_at, fetched_at) DESC LIMIT ?`,
    [limit]
  );
  return rows.map(rowToRecord);
}

// ── Internals ────────────────────────────────────────────────────────────────

function sanitizeBarcode(raw: string): string {
  return String(raw).replace(/\D+/g, '');
}

async function updateLastSeen(barcode: string): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(
      `UPDATE products SET last_seen_at = ? WHERE barcode = ?`,
      [new Date().toISOString(), barcode]
    );
  } catch { /* swallow */ }
}

async function refreshInBackground(barcode: string): Promise<void> {
  try { await fetchFromAnySource(barcode); } catch { /* swallow */ }
}

async function fetchFromAnySource(barcode: string): Promise<ProductRecord> {
  const sources: Array<{ base: string; source: ProductSource }> = [
    { base: OFF_BASE, source: 'openfoodfacts' },
    { base: OBF_BASE, source: 'openbeautyfacts' },
    { base: OPF_BASE, source: 'openproductsfacts' },
  ];

  // Query all three databases in parallel — whichever finds it first wins.
  // This covers food, beauty, and general products (vapes, household, etc.)
  // in one round-trip instead of waiting for each to fail sequentially.
  let offlineError = false;
  const attempts = await Promise.allSettled(
    sources.map(async ({ base, source }) => {
      const url = `${base}/${barcode}.json?fields=${encodeURIComponent(OFF_FIELDS)}`;
      let res: Response;
      try {
        res = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS);
      } catch {
        if (source === 'openfoodfacts') offlineError = true;
        throw new Error('network');
      }
      if (!res.ok) throw new Error('not_ok');
      let json: any;
      try { json = await res.json(); } catch { throw new Error('parse'); }
      const record = normalize(barcode, json, source);
      if (record.status !== 'found') throw new Error('not_found');
      return record;
    })
  );

  // If all three network calls failed and OFF was unreachable → offline
  const allFailed = attempts.every((r) => r.status === 'rejected');
  if (allFailed && offlineError) throw new ProductLookupOffline();

  // Return the first successful hit
  for (const result of attempts) {
    if (result.status === 'fulfilled') {
      await writeCache(result.value);
      return result.value;
    }
  }

  // All sources exhausted — cache as not_found to avoid hammering the APIs
  const notFound = blankRecord(barcode, 'not_found', new Date().toISOString(), 'openfoodfacts');
  await writeCache(notFound);
  return notFound;
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, {
      method: 'GET',
      signal: ac.signal,
      headers: {
        'User-Agent': 'TallyShot/1.0 (https://tallyshot.app)',
        'Accept': 'application/json',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function normalize(barcode: string, body: any, source: ProductSource): ProductRecord {
  const now = new Date().toISOString();
  if (!body || body.status === 0 || !body.product) {
    return blankRecord(barcode, 'not_found', now, source);
  }

  const p = body.product;
  const categories: string = Array.isArray(p.categories_tags) ? p.categories_tags.join(',') : '';

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
    ingredients: pickString(p.ingredients_text_en, p.ingredients_text, null),
    allergens: pickAllergens(p.allergens_tags, p.allergens),
    countries: pickString(p.countries, null),
    fetchedAt: now,
    source,
    aiSummary: null,
    aiGeneratedAt: null,
    lastSeenAt: now,
    description: null,
  };
}

function pickAllergens(tags: any, fallback: any): string | null {
  if (Array.isArray(tags) && tags.length > 0) {
    const cleaned = tags
      .map((t) => typeof t === 'string' ? t.replace(/^[a-z]{2}:/, '').trim() : '')
      .filter(Boolean);
    if (cleaned.length > 0) return cleaned.join(', ');
  }
  return pickString(fallback, null);
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
  const anyValue = Object.values(out).some((v) => v !== null);
  return anyValue ? out : null;
}

function blankRecord(barcode: string, status: ProductStatus, fetchedAt: string, source: ProductSource): ProductRecord {
  return {
    barcode, status, fetchedAt, source,
    name: null, brand: null, imageUrl: null, categories: null, quantity: null,
    nutriscore: null, novaGroup: null, ecoscore: null, nutriments: null,
    ingredients: null, allergens: null, countries: null,
    aiSummary: null, aiGeneratedAt: null, lastSeenAt: null, description: null,
  };
}

// ── SQLite cache ─────────────────────────────────────────────────────────────

function rowToRecord(row: any): ProductRecord {
  return {
    barcode:        row.barcode,
    status:         row.status as ProductStatus,
    name:           row.name ?? null,
    brand:          row.brand ?? null,
    imageUrl:       row.image_url ?? null,
    categories:     row.categories ?? null,
    quantity:       row.quantity ?? null,
    nutriscore:     row.nutriscore ?? null,
    novaGroup:      row.nova_group ?? null,
    ecoscore:       row.ecoscore ?? null,
    nutriments:     row.nutriments ? safeParse(row.nutriments) : null,
    ingredients:    row.ingredients_text ?? null,
    allergens:      row.allergens ?? null,
    countries:      row.countries ?? null,
    fetchedAt:      row.fetched_at,
    source:         (row.source as ProductSource) ?? 'openfoodfacts',
    aiSummary:      row.ai_summary ?? null,
    aiGeneratedAt:  row.ai_generated_at ?? null,
    lastSeenAt:     row.last_seen_at ?? null,
    description:    row.description ?? null,
  };
}

async function readCache(barcode: string): Promise<ProductRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(
    `SELECT * FROM products WHERE barcode = ?`, [barcode]
  );
  if (!row) return null;
  return rowToRecord(row);
}

function safeParse(s: string): Nutriments | null {
  try { return JSON.parse(s) as Nutriments; } catch { return null; }
}

async function writeCache(p: ProductRecord): Promise<void> {
  const db = await getDb();
  // Preserve any existing AI summary when overwriting product data
  const existing = await db.getFirstAsync<{ ai_summary: string | null; ai_generated_at: string | null }>(
    `SELECT ai_summary, ai_generated_at FROM products WHERE barcode = ?`,
    [p.barcode]
  );
  await db.runAsync(
    `INSERT OR REPLACE INTO products
       (barcode, status, name, brand, image_url, categories, quantity,
        nutriscore, nova_group, ecoscore, nutriments,
        ingredients_text, allergens, countries,
        fetched_at, source, last_seen_at,
        ai_summary, ai_generated_at, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      p.ingredients,
      p.allergens,
      p.countries,
      p.fetchedAt,
      p.source ?? 'openfoodfacts',
      p.lastSeenAt ?? new Date().toISOString(),
      existing?.ai_summary ?? null,
      existing?.ai_generated_at ?? null,
      p.description ?? null,
    ]
  );
}
