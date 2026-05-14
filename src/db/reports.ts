import { getDb } from './schema';
import { Report, ReportDraft, Receipt } from '../types';

function rowToReport(row: any): Report {
  return {
    id:             row.id,
    name:           row.name,
    description:    row.description ?? '',
    advance_amount: row.advance_amount ?? 0,
    created_at:     row.created_at,
    archived_at:    row.archived_at ?? null,
  };
}

/** All active (non-archived) reports, newest first. */
export async function getAllReports(): Promise<Report[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM reports WHERE archived_at IS NULL ORDER BY created_at DESC`
  );
  return rows.map(rowToReport);
}

export async function getReportById(id: number): Promise<Report | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(`SELECT * FROM reports WHERE id = ?`, [id]);
  return row ? rowToReport(row) : null;
}

/** Insert a new report. Returns new id. */
export async function insertReport(draft: ReportDraft): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO reports (name, description, advance_amount) VALUES (?, ?, ?)`,
    [draft.name.trim(), draft.description.trim(), draft.advance_amount]
  );
  return result.lastInsertRowId;
}

export async function updateReport(id: number, patch: Partial<ReportDraft>): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const vals: any[] = [];
  if (patch.name           !== undefined) { sets.push('name = ?');           vals.push(patch.name.trim()); }
  if (patch.description    !== undefined) { sets.push('description = ?');    vals.push(patch.description.trim()); }
  if (patch.advance_amount !== undefined) { sets.push('advance_amount = ?'); vals.push(patch.advance_amount); }
  if (sets.length === 0) return;
  vals.push(id);
  await db.runAsync(`UPDATE reports SET ${sets.join(', ')} WHERE id = ?`, vals);
}

/** Soft-archive a report. Receipts assigned to it retain their report_id. */
export async function archiveReport(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE reports SET archived_at = datetime('now') WHERE id = ?`, [id]
  );
}

export async function restoreReport(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE reports SET archived_at = NULL WHERE id = ?`, [id]);
}

/** Permanently delete a report (unassigns receipts). Only called from Trash. */
export async function permanentlyDeleteReport(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE receipts SET report_id = NULL WHERE report_id = ?`, [id]);
  await db.runAsync(`DELETE FROM reports WHERE id = ?`, [id]);
}

// ── Report summary helpers ─────────────────────────────────────────────────────

export interface ReportSummary {
  report: Report;
  receiptCount: number;
  subtotal: number;
  totalVat: number;
  total: number;
  reimbursable: number;
}

export async function getReportSummary(reportId: number): Promise<ReportSummary | null> {
  const db = await getDb();
  const report = await getReportById(reportId);
  if (!report) return null;

  const row = await db.getFirstAsync<{
    count: number; subtotal: number; vat: number; total: number; reimbursable: number;
  }>(
    `SELECT
       COUNT(*)                                             AS count,
       COALESCE(SUM(subtotal), 0)                          AS subtotal,
       COALESCE(SUM(tax), 0)                               AS vat,
       COALESCE(SUM(total), 0)                             AS total,
       COALESCE(SUM(CASE WHEN is_reimbursable = 1 THEN total ELSE 0 END), 0) AS reimbursable
     FROM receipts
     WHERE report_id = ? AND deleted_at IS NULL AND archived_at IS NULL`,
    [reportId]
  );

  return {
    report,
    receiptCount: row?.count ?? 0,
    subtotal:     row?.subtotal ?? 0,
    totalVat:     row?.vat ?? 0,
    total:        row?.total ?? 0,
    reimbursable: row?.reimbursable ?? 0,
  };
}

/** All receipts assigned to a report, newest first. */
export async function getReceiptsForReport(reportId: number): Promise<any[]> {
  const db = await getDb();
  return db.getAllAsync<any>(
    `SELECT * FROM receipts
     WHERE report_id = ? AND deleted_at IS NULL AND archived_at IS NULL
     ORDER BY date DESC`,
    [reportId]
  );
}

/** Assign / unassign a receipt to a report. Pass null to unassign. */
export async function setReceiptReport(receiptId: number, reportId: number | null): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE receipts SET report_id = ?, updated_at = datetime('now') WHERE id = ?`,
    [reportId, receiptId]
  );
}
