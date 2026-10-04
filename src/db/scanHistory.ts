import { getDb } from './schema';
import type { ProductCard, ProductKind } from '../services/productLookup';

/**
 * Scan history — one row per scan the user confirmed.
 *
 * Distinct from `barcode_cache`, which is keyed by barcode and answers "what
 * is this product". History answers "what did I scan, and when", so rescanning
 * the same tin of beans adds a second row rather than overwriting the first.
 */

export interface ScanHistoryEntry {
  id: number;
  barcode: string;
  barcodeType: string;
  name: string;
  brand: string;
  kind: ProductKind;
  source: string;
  imageUrl: string | null;
  card: ProductCard | null;
  scannedAt: string;
}

interface Row {
  id: number;
  barcode: string;
  barcode_type: string;
  name: string;
  brand: string;
  kind: string;
  source: string;
  image_url: string | null;
  card: string;
  scanned_at: string;
}

function toEntry(row: Row): ScanHistoryEntry {
  let card: ProductCard | null = null;
  try {
    const parsed = JSON.parse(row.card);
    if (parsed && typeof parsed === 'object' && typeof parsed.name === 'string') card = parsed;
  } catch {
    // A row whose blob won't parse still lists usefully from its own columns.
  }
  return {
    id: row.id,
    barcode: row.barcode,
    barcodeType: row.barcode_type,
    name: row.name,
    brand: row.brand,
    kind: (row.kind || 'other') as ProductKind,
    source: row.source,
    imageUrl: row.image_url,
    card,
    scannedAt: row.scanned_at,
  };
}

export async function addScanToHistory(card: ProductCard): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO scan_history
         (barcode, barcode_type, name, brand, kind, source, image_url, card, scanned_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        card.barcode,
        card.barcodeType,
        card.name,
        card.brand,
        card.kind,
        card.source,
        card.imageUrl,
        JSON.stringify(card),
      ]
    );
  } catch {
    // History is a convenience. Losing an entry must never fail a scan.
  }
}

/**
 * List history, newest first.
 *
 * `search` matches product name, brand or the barcode digits, so a user who
 * remembers only "that oat milk" or only the number on the tin can both find
 * it. `kind` narrows to one category.
 */
export async function getScanHistory(opts?: {
  search?: string;
  kind?: ProductKind | 'all';
  limit?: number;
}): Promise<ScanHistoryEntry[]> {
  try {
    const db = await getDb();
    const where: string[] = [];
    const params: (string | number)[] = [];

    const search = opts?.search?.trim();
    if (search) {
      where.push('(name LIKE ? OR brand LIKE ? OR barcode LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (opts?.kind && opts.kind !== 'all') {
      where.push('kind = ?');
      params.push(opts.kind);
    }

    const sql =
      `SELECT * FROM scan_history` +
      (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
      ` ORDER BY scanned_at DESC, id DESC LIMIT ?`;
    params.push(opts?.limit ?? 300);

    const rows = await db.getAllAsync<Row>(sql, params);
    return rows.map(toEntry);
  } catch {
    return [];
  }
}

export async function deleteScanFromHistory(id: number): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync('DELETE FROM scan_history WHERE id = ?', [id]);
  } catch {
    // Best-effort.
  }
}

/** Re-insert a deleted entry, keeping its original id, for undo. */
export async function restoreScanToHistory(entry: ScanHistoryEntry): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO scan_history
         (id, barcode, barcode_type, name, brand, kind, source, image_url, card, scanned_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.barcode,
        entry.barcodeType,
        entry.name,
        entry.brand,
        entry.kind,
        entry.source,
        entry.imageUrl,
        entry.card ? JSON.stringify(entry.card) : '{}',
        entry.scannedAt,
      ]
    );
  } catch {
    // Best-effort.
  }
}

export async function getScanHistoryCount(): Promise<number> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM scan_history');
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

export async function clearScanHistory(): Promise<void> {
  try {
    const db = await getDb();
    await db.execAsync('DELETE FROM scan_history;');
  } catch {
    // Table may not exist yet on a fresh install mid-migration.
  }
}

/**
 * One scan by row id, with its full stored card.
 *
 * Used by compare mode, which needs the whole `ProductCard` rather than the
 * summary columns the list renders from. Returns null when the row is gone or
 * its blob predates the current card shape — the caller says so rather than
 * comparing half a product.
 */
export async function getScanById(id: number): Promise<ScanHistoryEntry | null> {
  if (!Number.isFinite(id)) return null;
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<Row>('SELECT * FROM scan_history WHERE id = ?', [id]);
    return row ? toEntry(row) : null;
  } catch {
    return null;
  }
}
