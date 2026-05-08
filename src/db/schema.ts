import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('tallyshot.db');
    await initSchema(db);
  }
  return db;
}

async function initSchema(db: SQLite.SQLiteDatabase) {
  // Step 1: base table — fresh installs get every column from day one.
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'GBP',
      line_items TEXT NOT NULL DEFAULT '[]',
      subtotal REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      payment_method TEXT,
      invoice_number TEXT,
      category TEXT NOT NULL DEFAULT 'Other',
      notes TEXT NOT NULL DEFAULT '',
      image_uri TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'complete',
      is_tax_deductible INTEGER NOT NULL DEFAULT 0,
      archived_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(date);
    CREATE INDEX IF NOT EXISTS idx_receipts_category ON receipts(category);
    CREATE INDEX IF NOT EXISTS idx_receipts_archived ON receipts(archived_at);

    -- Extraction feedback: one row per "this field was wrong" long-press.
    -- Local-only for now; we'll surface it in Settings later for users who
    -- want to forward the corrections, and use it as a fine-tuning signal.
    CREATE TABLE IF NOT EXISTS extraction_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_id INTEGER,
      field TEXT NOT NULL,
      extracted_value TEXT,
      corrected_value TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_feedback_receipt ON extraction_feedback(receipt_id);
  `);

  // Step 2: column-by-column migration for users on older schemas.
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(receipts)`);
  const colNames = new Set(cols.map((c) => c.name));

  // 2a. status column (added in Slice 1)
  if (!colNames.has('status')) {
    try {
      await db.execAsync(
        `ALTER TABLE receipts ADD COLUMN status TEXT NOT NULL DEFAULT 'complete'`
      );
    } catch (e) {
      console.warn('TallyShot DB: status column migration failed', e);
    }
  }

  // 2b. is_tax_deductible column (added in Slice 2A)
  if (!colNames.has('is_tax_deductible')) {
    try {
      await db.execAsync(
        `ALTER TABLE receipts ADD COLUMN is_tax_deductible INTEGER NOT NULL DEFAULT 0`
      );
      // One-time backfill: set deductible=1 for likely-business categories on existing rows.
      // Matches CATEGORY_DEDUCTIBLE_DEFAULTS in src/types/index.ts.
      await db.execAsync(`
        UPDATE receipts SET is_tax_deductible = 1
        WHERE category IN ('Travel', 'Transport', 'Accommodation', 'Office & Tech')
      `);
    } catch (e) {
      console.warn('TallyShot DB: is_tax_deductible column migration failed', e);
    }
  }

  // 2c. invoice_number column (added in Slice 6 — counters Dext "can't edit
  // invoice number" review pattern). Nullable; existing rows get NULL.
  if (!colNames.has('invoice_number')) {
    try {
      await db.execAsync(`ALTER TABLE receipts ADD COLUMN invoice_number TEXT`);
    } catch (e) {
      console.warn('TallyShot DB: invoice_number column migration failed', e);
    }
  }

  // 2d. archived_at column (added in Slice 6 — counters Dext "no way to
  // access archived receipts" review pattern). Soft-delete timestamp. NULL
  // = active. Existing rows stay active.
  if (!colNames.has('archived_at')) {
    try {
      await db.execAsync(`ALTER TABLE receipts ADD COLUMN archived_at TEXT`);
    } catch (e) {
      console.warn('TallyShot DB: archived_at column migration failed', e);
    }
  }

  // Step 3: indexes that depend on migrated columns.
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
    CREATE INDEX IF NOT EXISTS idx_receipts_deductible ON receipts(is_tax_deductible);
    CREATE INDEX IF NOT EXISTS idx_receipts_archived ON receipts(archived_at);
  `);
}

export async function clearAllReceipts(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM receipts;');
}
