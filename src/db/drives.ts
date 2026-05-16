import { getDb } from './schema';

export interface Drive {
  id: number;
  started_at: string;
  ended_at: string | null;
  distance_km: number;
  notes: string;
  purpose: string;
  is_reimbursable: boolean;
  created_at: string;
  // GPS tracking fields — null on legacy/manual drives.
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  start_address: string | null;
  end_address: string | null;
  duration_seconds: number | null;
  auto_tracked: boolean;
}

export interface DriveDraft {
  started_at: string;
  ended_at?: string | null;
  distance_km: number;
  notes?: string;
  purpose?: string;
  is_reimbursable?: boolean;
  start_lat?: number | null;
  start_lng?: number | null;
  end_lat?: number | null;
  end_lng?: number | null;
  start_address?: string | null;
  end_address?: string | null;
  duration_seconds?: number | null;
  /** JSON-encoded list of {lat,lng,ts} samples from live GPS tracking. */
  route_json?: string | null;
  auto_tracked?: boolean;
}

function rowToDrive(row: any): Drive {
  return {
    ...row,
    ended_at: row.ended_at ?? null,
    is_reimbursable: Boolean(row.is_reimbursable),
    start_lat: row.start_lat ?? null,
    start_lng: row.start_lng ?? null,
    end_lat: row.end_lat ?? null,
    end_lng: row.end_lng ?? null,
    start_address: row.start_address ?? null,
    end_address: row.end_address ?? null,
    duration_seconds: row.duration_seconds ?? null,
    auto_tracked: Boolean(row.auto_tracked),
  };
}

export async function insertDrive(draft: DriveDraft): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO drives (
       started_at, ended_at, distance_km, notes, purpose, is_reimbursable,
       start_lat, start_lng, end_lat, end_lng,
       start_address, end_address, duration_seconds, route_json, auto_tracked
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      draft.started_at,
      draft.ended_at ?? null,
      draft.distance_km,
      draft.notes ?? '',
      draft.purpose ?? '',
      (draft.is_reimbursable ?? false) ? 1 : 0,
      draft.start_lat ?? null,
      draft.start_lng ?? null,
      draft.end_lat ?? null,
      draft.end_lng ?? null,
      draft.start_address ?? null,
      draft.end_address ?? null,
      draft.duration_seconds ?? null,
      draft.route_json ?? null,
      (draft.auto_tracked ?? false) ? 1 : 0,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateDrive(id: number, patch: Partial<DriveDraft>): Promise<void> {
  const db = await getDb();
  const entries = Object.entries(patch).map(([k, v]) => {
    if (k === 'is_reimbursable') return [k, v ? 1 : 0];
    return [k, v];
  });
  const fields = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([, v]) => v);
  await db.runAsync(`UPDATE drives SET ${fields} WHERE id = ?`, [...values, id]);
}

export async function deleteDrive(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM drives WHERE id = ?', [id]);
}

export async function getAllDrives(): Promise<Drive[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM drives ORDER BY started_at DESC, id DESC'
  );
  return rows.map(rowToDrive);
}

export async function getDrivesSummary(): Promise<{ count: number; totalKm: number }> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number; totalKm: number }>(
    'SELECT COUNT(*) as count, COALESCE(SUM(distance_km), 0) as totalKm FROM drives WHERE ended_at IS NOT NULL'
  );
  return { count: row?.count ?? 0, totalKm: row?.totalKm ?? 0 };
}

/** Haversine formula — distance between two GPS coords in km */
export function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
