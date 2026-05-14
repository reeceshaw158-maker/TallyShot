import { getDb } from './schema';
import { DbCategory } from '../types';

function rowToCategory(row: any): DbCategory {
  return {
    id:             row.id,
    name:           row.name,
    icon:           row.icon,
    color:          row.color,
    tax_deductible: Boolean(row.tax_deductible),
    is_default:     Boolean(row.is_default),
    sort_order:     row.sort_order ?? 0,
    archived_at:    row.archived_at ?? null,
  };
}

/** All active (non-archived) categories, sorted by sort_order. */
export async function getAllCategories(): Promise<DbCategory[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM categories WHERE archived_at IS NULL ORDER BY sort_order ASC, name ASC`
  );
  return rows.map(rowToCategory);
}

/** Single category by id. */
export async function getCategoryById(id: number): Promise<DbCategory | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(`SELECT * FROM categories WHERE id = ?`, [id]);
  return row ? rowToCategory(row) : null;
}

export interface CategoryDraft {
  name: string;
  icon: string;
  color: string;
  tax_deductible: boolean;
}

/** Insert a user-created category. Returns new id. */
export async function insertCategory(draft: CategoryDraft): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO categories (name, icon, color, tax_deductible, is_default, sort_order)
     VALUES (?, ?, ?, ?, 0,
       (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories))`,
    [draft.name, draft.icon, draft.color, draft.tax_deductible ? 1 : 0]
  );
  return result.lastInsertRowId;
}

/** Update a category (any field). */
export async function updateCategory(id: number, patch: Partial<CategoryDraft>): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const vals: any[] = [];
  if (patch.name           !== undefined) { sets.push('name = ?');           vals.push(patch.name); }
  if (patch.icon           !== undefined) { sets.push('icon = ?');           vals.push(patch.icon); }
  if (patch.color          !== undefined) { sets.push('color = ?');          vals.push(patch.color); }
  if (patch.tax_deductible !== undefined) { sets.push('tax_deductible = ?'); vals.push(patch.tax_deductible ? 1 : 0); }
  if (sets.length === 0) return;
  vals.push(id);
  await db.runAsync(`UPDATE categories SET ${sets.join(', ')} WHERE id = ?`, vals);
}

/** Soft-archive a category (hide it). Default categories can be archived too — just not deleted. */
export async function archiveCategory(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE categories SET archived_at = datetime('now') WHERE id = ?`, [id]
  );
}

/** Restore an archived category. */
export async function restoreCategory(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE categories SET archived_at = NULL WHERE id = ?`, [id]);
}

/** Find the best matching category id for a legacy text category name. */
export async function resolveCategoryId(textName: string): Promise<number | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM categories WHERE name = ? AND archived_at IS NULL LIMIT 1`,
    [textName]
  );
  return row?.id ?? null;
}
