import * as FileSystem from 'expo-file-system/legacy';
import { getDb } from './schema';
import { Receipt, ReceiptDraft, ReceiptStatus, CATEGORY_DEDUCTIBLE_DEFAULTS, Category } from '../types';

function rowToReceipt(row: any): Receipt {
  return {
    ...row,
    line_items: JSON.parse(row.line_items || '[]'),
    status: (row.status ?? 'complete') as ReceiptStatus,
    is_tax_deductible: Boolean(row.is_tax_deductible),
    invoice_number: row.invoice_number ?? null,
    archived_at: row.archived_at ?? null,
  };
}

export async function insertReceipt(draft: ReceiptDraft): Promise<number> {
  const db = await getDb();
  const status: ReceiptStatus = draft.status ?? 'complete';
  const deductible = draft.is_tax_deductible ?? CATEGORY_DEDUCTIBLE_DEFAULTS[draft.category as Category] ?? false;
  const result = await db.runAsync(
    `INSERT INTO receipts (merchant, date, currency, line_items, subtotal, tax, total, payment_method, invoice_number, category, notes, image_uri, status, is_tax_deductible)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      draft.merchant,
      draft.date,
      draft.currency,
      JSON.stringify(draft.line_items),
      draft.subtotal,
      draft.tax,
      draft.total,
      draft.payment_method,
      draft.invoice_number ?? null,
      draft.category,
      draft.notes,
      draft.image_uri,
      status,
      deductible ? 1 : 0,
    ]
  );
  return result.lastInsertRowId;
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
  // Coerce booleans to integers and objects to JSON.
  const entries = Object.entries(draft).map(([k, v]) => {
    if (k === 'is_tax_deductible') return [k, v ? 1 : 0];
    if (typeof v === 'object' && v !== null) return [k, JSON.stringify(v)];
    return [k, v];
  });
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
