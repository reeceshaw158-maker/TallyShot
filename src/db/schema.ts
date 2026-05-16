import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;
let dbOpening: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  if (dbOpening) {
    console.log('[DB] getDb() waiting on in-flight open');
    return dbOpening;
  }
  console.log('[DB] getDb() opening tallyshot.db');
  dbOpening = (async () => {
    const opened = await SQLite.openDatabaseAsync('tallyshot.db');
    console.log('[DB] openDatabaseAsync resolved, handle:', !!opened);
    await initSchema(opened);
    await dumpSchemaDiagnostics(opened);
    db = opened;
    return opened;
  })();
  try {
    return await dbOpening;
  } finally {
    dbOpening = null;
  }
}

async function dumpSchemaDiagnostics(d: SQLite.SQLiteDatabase) {
  try {
    const userVersion = await d.getFirstAsync<{ user_version: number }>(`PRAGMA user_version`);
    const cols = await d.getAllAsync<{
      cid: number; name: string; type: string; notnull: number; dflt_value: any; pk: number;
    }>(`PRAGMA table_info(receipts)`);
    console.log('[DB] schema user_version:', userVersion?.user_version);
    console.log('[DB] receipts columns:', cols.map(c =>
      `${c.name}:${c.type}${c.notnull ? ' NOT NULL' : ''}${c.dflt_value != null ? ` DEFAULT ${c.dflt_value}` : ''}`
    ).join(' | '));
  } catch (e) {
    console.warn('[DB] schema diagnostics failed', e);
  }
}

async function initSchema(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`PRAGMA journal_mode = WAL;`);

  // ── Core tables ──────────────────────────────────────────────────────────

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT NOT NULL,
      icon           TEXT NOT NULL,
      color          TEXT NOT NULL,
      tax_deductible INTEGER NOT NULL DEFAULT 0,
      is_default     INTEGER NOT NULL DEFAULT 1,
      sort_order     INTEGER NOT NULL DEFAULT 0,
      archived_at    TEXT
    );

    CREATE TABLE IF NOT EXISTS reports (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT NOT NULL,
      description    TEXT NOT NULL DEFAULT '',
      advance_amount REAL NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      archived_at    TEXT
    );

    -- Single-row settings (id always = 1)
    CREATE TABLE IF NOT EXISTS settings (
      id                INTEGER PRIMARY KEY DEFAULT 1,
      biometric_enabled INTEGER NOT NULL DEFAULT 0,
      mileage_rate      REAL    NOT NULL DEFAULT 0.45,
      home_currency     TEXT    NOT NULL DEFAULT 'GBP',
      distance_unit     TEXT    NOT NULL DEFAULT 'mi',
      auto_track_drives INTEGER NOT NULL DEFAULT 0,
      updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant           TEXT    NOT NULL DEFAULT '',
      date               TEXT    NOT NULL,
      currency           TEXT    NOT NULL DEFAULT 'GBP',
      line_items         TEXT    NOT NULL DEFAULT '[]',
      subtotal           REAL    NOT NULL DEFAULT 0,
      tax                REAL    NOT NULL DEFAULT 0,
      total              REAL    NOT NULL DEFAULT 0,
      payment_method     TEXT,
      invoice_number     TEXT,
      category           TEXT    NOT NULL DEFAULT 'Other',
      category_id        INTEGER REFERENCES categories(id),
      notes              TEXT    NOT NULL DEFAULT '',
      image_uri          TEXT    NOT NULL DEFAULT '',
      additional_images  TEXT    NOT NULL DEFAULT '[]',
      status             TEXT    NOT NULL DEFAULT 'complete',
      is_tax_deductible  INTEGER NOT NULL DEFAULT 0,
      is_reimbursable    INTEGER NOT NULL DEFAULT 0,
      refund             INTEGER NOT NULL DEFAULT 0,
      report_id          INTEGER REFERENCES reports(id),
      archived_at        TEXT,
      deleted_at         TEXT,
      updated_at         TEXT    NOT NULL DEFAULT (datetime('now')),
      created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS drives (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at   TEXT NOT NULL,
      ended_at     TEXT,
      distance_km  REAL NOT NULL DEFAULT 0,
      start_lat    REAL,
      start_lng    REAL,
      end_lat      REAL,
      end_lng      REAL,
      purpose      TEXT NOT NULL DEFAULT '',
      notes        TEXT NOT NULL DEFAULT '',
      auto_tracked INTEGER NOT NULL DEFAULT 0,
      is_reimbursable INTEGER NOT NULL DEFAULT 0,
      deleted_at   TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Open Food Facts lookup cache. One row per barcode the user has ever
    -- scanned, regardless of whether OFF had a hit. We keep negative results
    -- (status='not_found' / 'not_grocery') too so repeat scans of unknown
    -- items don't keep hitting the network. Stale-while-revalidate: rows
    -- are returned immediately; callers may refresh in the background.
    CREATE TABLE IF NOT EXISTS products (
      barcode      TEXT PRIMARY KEY,
      status       TEXT NOT NULL,                 -- 'found' | 'not_found' | 'not_grocery'
      name         TEXT,
      brand        TEXT,
      image_url    TEXT,
      categories   TEXT,                          -- raw OFF tags (comma-joined)
      quantity     TEXT,                          -- e.g. "330 ml", "500g"
      nutriscore   TEXT,                          -- 'a'..'e' or null
      nova_group   INTEGER,                       -- 1..4 or null (ultra-processed grade)
      ecoscore     TEXT,                          -- 'a'..'e' or null
      nutriments   TEXT,                          -- JSON blob: per-100g values
      fetched_at   TEXT NOT NULL DEFAULT (datetime('now')),
      source       TEXT NOT NULL DEFAULT 'openfoodfacts'
    );
    CREATE INDEX IF NOT EXISTS idx_products_fetched ON products(fetched_at);

    CREATE TABLE IF NOT EXISTS extraction_feedback (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_id      INTEGER,
      field           TEXT NOT NULL,
      extracted_value TEXT,
      corrected_value TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_receipts_date       ON receipts(date);
    CREATE INDEX IF NOT EXISTS idx_receipts_category   ON receipts(category);
    CREATE INDEX IF NOT EXISTS idx_receipts_category_id ON receipts(category_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_archived   ON receipts(archived_at);
    CREATE INDEX IF NOT EXISTS idx_receipts_deleted    ON receipts(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_receipts_report     ON receipts(report_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_status     ON receipts(status);
    CREATE INDEX IF NOT EXISTS idx_receipts_deductible ON receipts(is_tax_deductible);
    CREATE INDEX IF NOT EXISTS idx_drives_started      ON drives(started_at);
    CREATE INDEX IF NOT EXISTS idx_drives_deleted      ON drives(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_feedback_receipt    ON extraction_feedback(receipt_id);
  `);

  // ── Additive column migrations (existing installs) ────────────────────────

  const receiptCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(receipts)`);
  const rcols = new Set(receiptCols.map((c) => c.name));

  const receiptMigrations: [string, string][] = [
    ['status',            `ALTER TABLE receipts ADD COLUMN status TEXT NOT NULL DEFAULT 'complete'`],
    ['is_tax_deductible', `ALTER TABLE receipts ADD COLUMN is_tax_deductible INTEGER NOT NULL DEFAULT 0`],
    ['invoice_number',    `ALTER TABLE receipts ADD COLUMN invoice_number TEXT`],
    ['archived_at',       `ALTER TABLE receipts ADD COLUMN archived_at TEXT`],
    ['is_reimbursable',   `ALTER TABLE receipts ADD COLUMN is_reimbursable INTEGER NOT NULL DEFAULT 0`],
    ['category_id',       `ALTER TABLE receipts ADD COLUMN category_id INTEGER REFERENCES categories(id)`],
    ['additional_images', `ALTER TABLE receipts ADD COLUMN additional_images TEXT NOT NULL DEFAULT '[]'`],
    ['refund',            `ALTER TABLE receipts ADD COLUMN refund INTEGER NOT NULL DEFAULT 0`],
    ['report_id',         `ALTER TABLE receipts ADD COLUMN report_id INTEGER REFERENCES reports(id)`],
    ['deleted_at',        `ALTER TABLE receipts ADD COLUMN deleted_at TEXT`],
    ['updated_at',        `ALTER TABLE receipts ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))`],
  ];

  for (const [col, sql] of receiptMigrations) {
    if (!rcols.has(col)) {
      try { await db.execAsync(sql); } catch (e) { console.warn(`receipts.${col} migration failed`, e); }
    }
  }

  // Backfill: set is_tax_deductible on legacy category names
  if (!rcols.has('is_tax_deductible')) {
    try {
      await db.execAsync(`
        UPDATE receipts SET is_tax_deductible = 1
        WHERE category IN ('Travel','Transport','Accommodation','Office & Tech')
      `);
    } catch {}
  }

  const driveCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(drives)`);
  const dcols = new Set(driveCols.map((c) => c.name));

  const driveMigrations: [string, string][] = [
    ['start_lat',     `ALTER TABLE drives ADD COLUMN start_lat REAL`],
    ['start_lng',     `ALTER TABLE drives ADD COLUMN start_lng REAL`],
    ['end_lat',       `ALTER TABLE drives ADD COLUMN end_lat REAL`],
    ['end_lng',       `ALTER TABLE drives ADD COLUMN end_lng REAL`],
    ['auto_tracked',  `ALTER TABLE drives ADD COLUMN auto_tracked INTEGER NOT NULL DEFAULT 0`],
    ['deleted_at',    `ALTER TABLE drives ADD COLUMN deleted_at TEXT`],
    ['is_reimbursable', `ALTER TABLE drives ADD COLUMN is_reimbursable INTEGER NOT NULL DEFAULT 0`],
    // v2 GPS tracking: reverse-geocoded addresses, total drive time, and a
    // JSON-encoded list of {lat,lng,ts} samples for future map preview.
    ['start_address',     `ALTER TABLE drives ADD COLUMN start_address TEXT`],
    ['end_address',       `ALTER TABLE drives ADD COLUMN end_address TEXT`],
    ['duration_seconds',  `ALTER TABLE drives ADD COLUMN duration_seconds INTEGER`],
    ['route_json',        `ALTER TABLE drives ADD COLUMN route_json TEXT`],
  ];

  for (const [col, sql] of driveMigrations) {
    if (!dcols.has(col)) {
      try { await db.execAsync(sql); } catch (e) { console.warn(`drives.${col} migration failed`, e); }
    }
  }

  // products: ingredients/allergens/country added in v2 — additive migration
  // so any existing user cache survives.
  const productCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(products)`);
  const pcols = new Set(productCols.map((c) => c.name));
  const productMigrations: [string, string][] = [
    ['ingredients_text', `ALTER TABLE products ADD COLUMN ingredients_text TEXT`],
    ['allergens',        `ALTER TABLE products ADD COLUMN allergens TEXT`],
    ['countries',        `ALTER TABLE products ADD COLUMN countries TEXT`],
  ];
  for (const [col, sql] of productMigrations) {
    if (!pcols.has(col)) {
      try { await db.execAsync(sql); } catch (e) { console.warn(`products.${col} migration failed`, e); }
    }
  }

  // ── One-off colour migrations ────────────────────────────────────────────
  // Brand pivot away from orange — replace the old Marketing & Advertising
  // default colour for users who haven't customised it. Only touches the
  // default-seeded category; custom user colours are left alone.
  try {
    await db.runAsync(
      `UPDATE categories
         SET color = '#ec4899'
       WHERE name = 'Marketing & Advertising'
         AND color = '#f97316'
         AND is_default = 1`
    );
  } catch (e) {
    console.warn('Marketing & Advertising colour migration failed', e);
  }

  // ── Seed data (only if tables are empty) ─────────────────────────────────

  await seedCategories(db);
  await seedSettings(db);
}

async function seedCategories(db: SQLite.SQLiteDatabase) {
  const existing = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM categories WHERE archived_at IS NULL`
  );
  if (existing && existing.count > 0) return;

  // UK self-assessment categories — tax deductible defaults follow HMRC guidance
  const defaults = [
    { name: 'Office & Supplies',        icon: 'office-building-outline',  color: '#3b82f6', deductible: 1, sort: 0 },
    { name: 'Travel & Transport',        icon: 'train-car',                color: '#8b5cf6', deductible: 1, sort: 1 },
    { name: 'Meals & Entertainment',     icon: 'silverware-fork-knife',    color: '#f59e0b', deductible: 1, sort: 2 },
    { name: 'Accommodation',             icon: 'bed-outline',              color: '#06b6d4', deductible: 1, sort: 3 },
    { name: 'Fuel',                      icon: 'gas-station-outline',      color: '#ef4444', deductible: 1, sort: 4 },
    { name: 'Software & Subscriptions',  icon: 'laptop',                   color: '#6366f1', deductible: 1, sort: 5 },
    { name: 'Professional Services',     icon: 'briefcase-outline',        color: '#10b981', deductible: 1, sort: 6 },
    { name: 'Marketing & Advertising',   icon: 'bullhorn-outline',         color: '#ec4899', deductible: 1, sort: 7 },
    { name: 'Utilities',                 icon: 'lightning-bolt-outline',   color: '#64748b', deductible: 0, sort: 8 },
    { name: 'Personal',                  icon: 'account-outline',          color: '#94a3b8', deductible: 0, sort: 9 },
    { name: 'Other',                     icon: 'dots-horizontal-circle-outline', color: '#6b7280', deductible: 0, sort: 10 },
  ];

  for (const cat of defaults) {
    await db.runAsync(
      `INSERT INTO categories (name, icon, color, tax_deductible, is_default, sort_order)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [cat.name, cat.icon, cat.color, cat.deductible, cat.sort]
    );
  }
}

async function seedSettings(db: SQLite.SQLiteDatabase) {
  const existing = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM settings`);
  if (existing && existing.count > 0) return;
  await db.runAsync(
    `INSERT INTO settings (id, biometric_enabled, mileage_rate, home_currency, distance_unit, auto_track_drives)
     VALUES (1, 0, 0.45, 'GBP', 'mi', 0)`
  );
}

export async function clearAllReceipts(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM receipts;');
}
