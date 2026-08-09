import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getDb } from '../db/schema';

export interface BackupData {
  version: number;
  exported_at: string;
  receipts: any[];
  drives: any[];
  categories: any[];
}

export async function exportBackup(): Promise<void> {
  const db = await getDb();

  const [receipts, drives, categories] = await Promise.all([
    db.getAllAsync<any>('SELECT * FROM receipts WHERE deleted_at IS NULL'),
    db.getAllAsync<any>('SELECT * FROM drives WHERE deleted_at IS NULL'),
    db.getAllAsync<any>('SELECT * FROM categories WHERE archived_at IS NULL AND is_default = 0'),
  ]);

  const backup: BackupData = {
    version: 1,
    exported_at: new Date().toISOString(),
    receipts,
    drives,
    categories,
  };

  const date = new Date().toLocaleDateString('en-CA').slice(0, 10);
  const fileName = `tallyshot-backup-${date}.json`;
  const fileUri = `${FileSystem.documentDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backup, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');

  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/json',
    dialogTitle: 'Save TallyShot backup',
    UTI: 'public.json',
  });
}

export async function importBackup(): Promise<{
  receipts: number;
  drives: number;
  categories: number;
}> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) {
    throw new Error('cancelled');
  }

  const json = await FileSystem.readAsStringAsync(result.assets[0].uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  let backup: BackupData;
  try {
    backup = JSON.parse(json);
  } catch {
    throw new Error('Invalid backup file — could not parse JSON.');
  }

  if (!Array.isArray(backup.receipts) || !Array.isArray(backup.drives) || !Array.isArray(backup.categories)) {
    throw new Error('Invalid backup file — missing required fields.');
  }

  const db = await getDb();
  let catCount = 0, receiptCount = 0, driveCount = 0;

  for (const cat of backup.categories) {
    try {
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM categories WHERE name = ? AND archived_at IS NULL', [cat.name]
      );
      if (!existing) {
        await db.runAsync(
          `INSERT INTO categories (name, icon, color, tax_deductible, is_default, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
          [cat.name, cat.icon, cat.color, cat.tax_deductible, cat.is_default, cat.sort_order]
        );
        catCount++;
      }
    } catch {}
  }

  for (const r of backup.receipts) {
    try {
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM receipts WHERE merchant = ? AND date = ? AND total = ? AND deleted_at IS NULL',
        [r.merchant, r.date, r.total]
      );
      if (!existing) {
        await db.runAsync(
          `INSERT INTO receipts
             (merchant, date, currency, line_items, subtotal, tax, total,
              payment_method, invoice_number, category, notes, image_uri,
              additional_images, status, is_tax_deductible, is_reimbursable,
              refund, archived_at, deleted_at, updated_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
          [
            r.merchant, r.date, r.currency, r.line_items, r.subtotal, r.tax, r.total,
            r.payment_method ?? null, r.invoice_number ?? null, r.category, r.notes,
            r.image_uri, r.additional_images, r.status,
            r.is_tax_deductible, r.is_reimbursable, r.refund ?? 0,
            r.archived_at ?? null,
            r.updated_at ?? new Date().toISOString(),
            r.created_at ?? new Date().toISOString(),
          ]
        );
        receiptCount++;
      }
    } catch {}
  }

  for (const d of backup.drives) {
    try {
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM drives WHERE started_at = ? AND distance_km = ?',
        [d.started_at, d.distance_km]
      );
      if (!existing) {
        await db.runAsync(
          `INSERT INTO drives
             (started_at, ended_at, distance_km, notes, purpose, is_reimbursable,
              start_lat, start_lng, end_lat, end_lng, start_address, end_address,
              duration_seconds, auto_tracked, deleted_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
          [
            d.started_at, d.ended_at ?? null, d.distance_km,
            d.notes ?? '', d.purpose ?? '', d.is_reimbursable ? 1 : 0,
            d.start_lat ?? null, d.start_lng ?? null, d.end_lat ?? null, d.end_lng ?? null,
            d.start_address ?? null, d.end_address ?? null, d.duration_seconds ?? null,
            d.auto_tracked ? 1 : 0,
            d.created_at ?? new Date().toISOString(),
          ]
        );
        driveCount++;
      }
    } catch {}
  }

  return { receipts: receiptCount, drives: driveCount, categories: catCount };
}
