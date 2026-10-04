import { getDb } from './schema';
import type { ProductCard } from '../services/productLookup';

/**
 * On-device cache of barcode lookups. Rescanning a product is instant and
 * works offline — and spares the free public APIs repeat calls for the same
 * code, which their usage terms ask nicely for.
 *
 * Cache errors are swallowed everywhere: the cache is an accelerator, and a
 * failed read or write must never break a scan that would otherwise work.
 */

/**
 * How long a recorded *miss* suppresses a repeat lookup.
 *
 * Misses are cached because a shopper who scans an unlisted item, backs out
 * and scans it again shouldn't spend another five requests from a rate budget
 * capped at 15/min. But Open Food Facts gains thousands of products a day, so
 * the suppression is deliberately short — a product added this afternoon is
 * findable by tomorrow morning.
 */
const MISS_TTL_HOURS = 6;

/** Sentinel stored in the `source` column for a recorded miss. */
const MISS_SOURCE = '__miss';

export async function getCachedProduct(barcode: string): Promise<ProductCard | null> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ result: string; source: string }>(
      'SELECT result, source FROM barcode_cache WHERE barcode = ?',
      [barcode]
    );
    if (!row || row.source === MISS_SOURCE) return null;

    const parsed = JSON.parse(row.result) as ProductCard;
    // Rows written by an older version of the app have the pre-ProductCard
    // shape. Rather than migrate them, ignore anything without a name and let
    // the chain refetch — the cache is disposable by design.
    if (!parsed || typeof parsed !== 'object' || typeof parsed.name !== 'string') return null;

    // Fields added after this row may have been written are backfilled rather
    // than treated as a bad row: a cache hit that renders without its badges is
    // a far better outcome than throwing away a valid offline result. The array
    // fields in particular are mapped over unguarded by the card.
    return {
      ...parsed,
      labelsTags: parsed.labelsTags ?? [],
      ingredientsAnalysisTags: parsed.ingredientsAnalysisTags ?? [],
      ecoscoreGrade: parsed.ecoscoreGrade ?? null,
      servingSize: parsed.servingSize ?? '',
      servingQuantity: parsed.servingQuantity ?? null,
    };
  } catch {
    return null;
  }
}

export async function cacheProduct(barcode: string, card: ProductCard): Promise<void> {
  try {
    const db = await getDb();
    const { fromCache: _fromCache, ...stored } = card;
    await db.runAsync(
      `INSERT OR REPLACE INTO barcode_cache (barcode, source, result, created_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [barcode, card.source, JSON.stringify(stored)]
    );
  } catch {
    // Best-effort only.
  }
}

/** Record that the whole free chain came up empty for this code. */
export async function cacheMiss(barcode: string): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO barcode_cache (barcode, source, result, created_at)
       VALUES (?, ?, '{}', datetime('now'))`,
      [barcode, MISS_SOURCE]
    );
  } catch {
    // Best-effort only.
  }
}

/** True when we recorded a miss for this code inside the TTL. */
export async function wasRecentMiss(barcode: string): Promise<boolean> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ fresh: number }>(
      `SELECT (created_at > datetime('now', ?)) AS fresh
         FROM barcode_cache
        WHERE barcode = ? AND source = ?`,
      [`-${MISS_TTL_HOURS} hours`, barcode, MISS_SOURCE]
    );
    return !!row?.fresh;
  } catch {
    return false;
  }
}

export async function clearBarcodeCache(): Promise<void> {
  try {
    const db = await getDb();
    await db.execAsync('DELETE FROM barcode_cache;');
  } catch {
    // Table may not exist yet on a fresh install mid-migration.
  }
}
