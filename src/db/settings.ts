import { getDb } from './schema';
import { AppSettings } from '../types';

function rowToSettings(row: any): AppSettings {
  return {
    biometric_enabled: Boolean(row.biometric_enabled),
    mileage_rate:      row.mileage_rate ?? 0.45,
    home_currency:     row.home_currency ?? 'GBP',
    distance_unit:     (row.distance_unit === 'km' ? 'km' : 'mi') as 'mi' | 'km',
    auto_track_drives: Boolean(row.auto_track_drives),
    updated_at:        row.updated_at ?? new Date().toISOString(),
  };
}

/** Always returns a settings object — seeds the row if missing. */
export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(`SELECT * FROM settings WHERE id = 1`);
  if (row) return rowToSettings(row);

  // Shouldn't happen (seeded in initSchema) but guard anyway
  await db.runAsync(
    `INSERT OR IGNORE INTO settings (id, biometric_enabled, mileage_rate, home_currency, distance_unit, auto_track_drives)
     VALUES (1, 0, 0.45, 'GBP', 'mi', 0)`
  );
  const seeded = await db.getFirstAsync<any>(`SELECT * FROM settings WHERE id = 1`);
  return rowToSettings(seeded);
}

export async function updateSettings(patch: Partial<Omit<AppSettings, 'updated_at'>>): Promise<void> {
  const db = await getDb();
  const sets: string[] = [`updated_at = datetime('now')`];
  const vals: any[] = [];

  if (patch.biometric_enabled !== undefined) { sets.push('biometric_enabled = ?'); vals.push(patch.biometric_enabled ? 1 : 0); }
  if (patch.mileage_rate      !== undefined) { sets.push('mileage_rate = ?');      vals.push(patch.mileage_rate); }
  if (patch.home_currency     !== undefined) { sets.push('home_currency = ?');     vals.push(patch.home_currency); }
  if (patch.distance_unit     !== undefined) { sets.push('distance_unit = ?');     vals.push(patch.distance_unit); }
  if (patch.auto_track_drives !== undefined) { sets.push('auto_track_drives = ?'); vals.push(patch.auto_track_drives ? 1 : 0); }

  await db.runAsync(`UPDATE settings SET ${sets.join(', ')} WHERE id = 1`, vals);
}
