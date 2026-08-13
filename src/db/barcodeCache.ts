import { getDb } from './schema';
import type { ProductLookupResult } from '../services/productLookup';

/**
 * On-device cache of successful barcode lookups. Rescanning a product is
 * instant and works offline — and spares the free public APIs repeat calls
 * for the same code, which their usage terms ask nicely for.
 *
 * Cache errors are swallowed everywhere: the cache is an accelerator, and a
 * failed read or write must never break a scan that would otherwise work.
 */

export async function getCachedProduct(barcode: string): Promise<ProductLookupResult | null> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ result: string }>(
      'SELECT result FROM barcode_cache WHERE barcode = ?',
      [barcode]
    );
    if (!row) return null;
    return JSON.parse(row.result) as ProductLookupResult;
  } catch {
    return null;
  }
}

export async function cacheProduct(barcode: string, result: ProductLookupResult): Promise<void> {
  try {
    const db = await getDb();
    const { fromCache: _fromCache, ...stored } = result;
    await db.runAsync(
      'INSERT OR REPLACE INTO barcode_cache (barcode, source, result) VALUES (?, ?, ?)',
      [barcode, result.source, JSON.stringify(stored)]
    );
  } catch {
    // Best-effort only.
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
