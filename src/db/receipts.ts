import * as FileSystem from 'expo-file-system/legacy';
import type { SQLiteBindValue } from 'expo-sqlite';
import { getDb } from './schema';
import { Receipt, ReceiptDraft, ReceiptStatus, CATEGORY_DEDUCTIBLE_DEFAULTS, Category } from '../types';

function rowToReceipt(row: any): Receipt {
  return {
    ...row,
    line_items:        JSON.parse(row.line_items || '[]'),
    additional_images: JSON.parse(row.additional_images || '[]'),
    status:            (row.status ?? 'complete') as ReceiptStatus,
    is_tax_deductible: Boolean(row.is_tax_deductible),
    is_reimbursable:   Boolean(row.is_reimbursable),
    refund:            Boolean(row.refund),
    invoice_number:    row.invoice_number ?? null,
    category_id:       row.category_id ?? null,
    report_id:         row.report_id ?? null,
    archived_at:       row.archived_at ?? null,
    deleted_at:        row.deleted_at ?? null,
    updated_at:        row.updated_at ?? row.created_at,
  };
}

export async function insertReceipt(draft: ReceiptDraft): Promise<number> {
  const db = await getDb();
  console.log('[insertReceipt] db handle present:', !!db);
  const status: ReceiptStatus = draft.status ?? 'complete';
  const deductible = draft.is_tax_deductible ?? CATEGORY_DEDUCTIBLE_DEFAULTS[draft.category as Category] ?? false;

  const sql = `INSERT INTO receipts
       (merchant, date, currency, line_items, subtotal, tax, total,
        payment_method, invoice_number, category, category_id, notes,
        image_uri, additional_images, status, is_tax_deductible,
        is_reimbursable, refund, report_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;

  const params: Array<[string, SQLiteBindValue]> = [
    ['merchant',          draft.merchant],
    ['date',              draft.date],
    ['currency',          draft.currency],
    ['line_items',        JSON.stringify(draft.line_items)],
    ['subtotal',          draft.subtotal],
    ['tax',               draft.tax],
    ['total',             draft.total],
    ['payment_method',    draft.payment_method ?? null],
    ['invoice_number',    draft.invoice_number ?? null],
    ['category',          draft.category],
    ['category_id',       draft.category_id ?? null],
    ['notes',             draft.notes],
    ['image_uri',         draft.image_uri],
    ['additional_images', JSON.stringify(draft.additional_images ?? [])],
    ['status',            status],
    ['is_tax_deductible', deductible ? 1 : 0],
    ['is_reimbursable',   (draft.is_reimbursable ?? false) ? 1 : 0],
    ['refund',            (draft.refund ?? false) ? 1 : 0],
    ['report_id',         draft.report_id ?? null],
  ];

  console.log('[insertReceipt] SQL:', sql.replace(/\s+/g, ' ').trim());
  for (const [name, value] of params) {
    const t = value === null ? 'null' : value === undefined ? 'undefined' : typeof value;
    const preview = typeof value === 'string' && value.length > 60 ? value.slice(0, 60) + '…' : value;
    console.log(`[insertReceipt] param ${name} = ${JSON.stringify(preview)} (${t})`);
  }

  try {
    const result = await db.runAsync(sql, params.map(([, v]) => v));
    console.log('[insertReceipt] success, lastInsertRowId:', result.lastInsertRowId);
    return result.lastInsertRowId;
  } catch (err) {
    console.error('[insertReceipt] FAILED', err);
    throw err; // do not swallow — UI still surfaces it
  }
}

/**
 * Record a "this extraction was wrong" feedback entry. Triggered by
 * long-pressing an editable receipt field. Local-only — we use it as a
 * future fine-tuning signal and may surface it to the user in Settings later.
 */
export async function recordExtractionFeedback(opts: {
  receiptId: number | null;
  field: string;
  extractedValue?: string | number | null;
  correctedValue?: string | number | null;
}): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO extraction_feedback (receipt_id, field, extracted_value, corrected_value)
     VALUES (?, ?, ?, ?)`,
    [
      opts.receiptId,
      opts.field,
      opts.extractedValue == null ? null : String(opts.extractedValue),
      opts.correctedValue == null ? null : String(opts.correctedValue),
    ]
  );
}

export async function updateReceipt(id: number, draft: Partial<ReceiptDraft>): Promise<void> {
  const db = await getDb();
  const BOOL_COLS = new Set(['is_tax_deductible', 'is_reimbursable', 'refund']);
  const entries = Object.entries(draft).map(([k, v]) => {
    if (BOOL_COLS.has(k)) return [k, v ? 1 : 0];
    if (typeof v === 'object' && v !== null) return [k, JSON.stringify(v)];
    return [k, v];
  });
  entries.push(['updated_at', new Date().toISOString()]);
  const fields = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([, v]) => v);
  await db.runAsync(`UPDATE receipts SET ${fields} WHERE id = ?`, [...values, id]);
}

export async function setReceiptStatus(id: number, status: ReceiptStatus): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE receipts SET status = ? WHERE id = ?', [status, id]);
}

/**
 * Soft-delete: hide the receipt from default lists but keep the row and
 * the photo on disk. Restorable from Settings → Archived Receipts.
 *
 * The default delete behaviour throughout the app is now archive, not
 * permanent delete. Counters Dext's "no way to access archived receipts"
 * review pattern.
 */
export async function archiveReceipt(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE receipts SET archived_at = ? WHERE id = ?`,
    [new Date().toISOString(), id]
  );
}

/**
 * Bring a soft-deleted receipt back into the active list.
 */
export async function restoreReceipt(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE receipts SET archived_at = NULL WHERE id = ?`, [id]);
}

/**
 * Hard delete: remove the row and the photo file from disk. Reachable
 * only from the Archived Receipts screen — never as the default action.
 */
export async function permanentlyDeleteReceipt(id: number): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ image_uri: string }>(
    'SELECT image_uri FROM receipts WHERE id = ?',
    [id]
  );
  if (row?.image_uri) {
    try {
      await FileSystem.deleteAsync(row.image_uri, { idempotent: true });
    } catch {
      // Ignore — image already missing.
    }
  }
  await db.runAsync('DELETE FROM receipts WHERE id = ?', [id]);
}

/**
 * @deprecated Use `archiveReceipt` for the default action and
 * `permanentlyDeleteReceipt` from the Archived screen. Kept as a thin
 * alias so the rest of the codebase compiles during the migration; we'll
 * remove it once every call site is converted.
 */
export async function deleteReceipt(id: number): Promise<void> {
  return permanentlyDeleteReceipt(id);
}

/** Move to trash (soft delete). Separate from archive. */
export async function trashReceipt(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE receipts SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`, [id]
  );
}

/** Restore from trash. */
export async function restoreFromTrash(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE receipts SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ?`, [id]
  );
}

/** All receipts in trash, newest first. */
export async function getTrashedReceipts(): Promise<Receipt[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM receipts WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`
  );
  return rows.map(rowToReceipt);
}

/** Auto-purge receipts that have been in trash > 30 days. */
export async function purgeOldTrash(): Promise<void> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: number; image_uri: string }>(
    `SELECT id, image_uri FROM receipts
     WHERE deleted_at IS NOT NULL
       AND deleted_at < datetime('now', '-30 days')`
  );
  for (const row of rows) {
    if (row.image_uri) {
      try { await FileSystem.deleteAsync(row.image_uri, { idempotent: true }); } catch {}
    }
    await db.runAsync('DELETE FROM receipts WHERE id = ?', [row.id]);
  }
}

export async function getArchivedReceipts(): Promise<Receipt[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM receipts WHERE archived_at IS NOT NULL ORDER BY archived_at DESC, id DESC`
  );
  return rows.map(rowToReceipt);
}

export async function getArchivedCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM receipts WHERE archived_at IS NOT NULL`
  );
  return row?.c ?? 0;
}

export async function getReceipt(id: number): Promise<Receipt | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT * FROM receipts WHERE id = ?', [id]);
  return row ? rowToReceipt(row) : null;
}

export async function getAllReceipts(opts?: {
  category?: string;
  status?: ReceiptStatus;
  deductibleOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  /** Include archived rows. Defaults false — they belong on the Archived screen. */
  includeArchived?: boolean;
}): Promise<Receipt[]> {
  const db = await getDb();
  let query = 'SELECT * FROM receipts WHERE 1=1';
  const params: any[] = [];

  // Always exclude trashed rows from main list
  query += ' AND deleted_at IS NULL';

  if (!opts?.includeArchived) {
    query += ' AND archived_at IS NULL';
  }

  if (opts?.category) {
    query += ' AND category = ?';
    params.push(opts.category);
  }
  if (opts?.status) {
    query += ' AND status = ?';
    params.push(opts.status);
  }
  if (opts?.deductibleOnly) {
    query += ' AND is_tax_deductible = 1';
  }
  if (opts?.dateFrom) {
    query += ' AND date >= ?';
    params.push(opts.dateFrom);
  }
  if (opts?.dateTo) {
    query += ' AND date <= ?';
    params.push(opts.dateTo);
  }
  if (opts?.search) {
    query += ' AND (merchant LIKE ? OR notes LIKE ?)';
    params.push(`%${opts.search}%`, `%${opts.search}%`);
  }

  query += ' ORDER BY date DESC, id DESC';
  const rows = await db.getAllAsync<any>(query, params);
  return rows.map(rowToReceipt);
}

export async function getReceiptsInRange(dateFrom: string, dateTo: string): Promise<Receipt[]> {
  return getAllReceipts({ dateFrom, dateTo });
}

export async function getNeedsReviewCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM receipts WHERE status = 'needs_review' AND archived_at IS NULL`
  );
  return row?.c ?? 0;
}

export async function getMonthlyDeductibleTotal(yearMonth: string): Promise<{
  total: number;
  count: number;
}> {
  const db = await getDb();
  const dateFrom = `${yearMonth}-01`;
  const dateTo = `${yearMonth}-31`;
  const row = await db.getFirstAsync<{ total: number; count: number }>(
    `SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count FROM receipts
     WHERE date >= ? AND date <= ? AND status = 'complete' AND archived_at IS NULL AND is_tax_deductible = 1`,
    [dateFrom, dateTo]
  );
  return { total: row?.total ?? 0, count: row?.count ?? 0 };
}

export async function getMonthlySummary(yearMonth: string): Promise<{
  total: number;
  byCategory: { category: string; total: number }[];
  topMerchants: { merchant: string; total: number; count: number }[];
}> {
  const db = await getDb();
  const dateFrom = `${yearMonth}-01`;
  const dateTo = `${yearMonth}-31`;

  const totalRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(total), 0) as total FROM receipts
     WHERE date >= ? AND date <= ? AND status = 'complete' AND archived_at IS NULL`,
    [dateFrom, dateTo]
  );

  const byCategory = await db.getAllAsync<{ category: string; total: number }>(
    `SELECT category, SUM(total) as total FROM receipts
     WHERE date >= ? AND date <= ? AND status = 'complete' AND archived_at IS NULL
     GROUP BY category ORDER BY total DESC`,
    [dateFrom, dateTo]
  );

  const topMerchants = await db.getAllAsync<{ merchant: string; total: number; count: number }>(
    `SELECT merchant, SUM(total) as total, COUNT(*) as count FROM receipts
     WHERE date >= ? AND date <= ? AND status = 'complete' AND archived_at IS NULL
     GROUP BY merchant ORDER BY total DESC LIMIT 5`,
    [dateFrom, dateTo]
  );

  return {
    total: totalRow?.total ?? 0,
    byCategory,
    topMerchants,
  };
}

export async function clearAllUserData(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM receipts;');
  const dir = `${FileSystem.documentDirectory}receipts/`;
  try {
    await FileSystem.deleteAsync(dir, { idempotent: true });
  } catch {
    // Folder didn't exist.
  }
}
