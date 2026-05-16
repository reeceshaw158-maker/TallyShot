/**
 * GPS-driven drive tracker for live mileage capture.
 *
 * Lifecycle:
 *   1. requestPermissions() — call once before start(). Returns 'granted',
 *      'denied' (user said no), or 'denied_forever' (the OS-level permanent
 *      deny that requires Settings). The caller surfaces the right UX for
 *      each case.
 *   2. start(opts) — subscribe to expo-location updates. Each sample feeds
 *      Haversine and accumulates a running total. We also keep the raw
 *      samples in memory so the caller can save a route polyline.
 *   3. subscribe(cb) — receive live tick events ({ distanceKm, elapsedMs,
 *      samples }) so the UI can show a live read-out.
 *   4. stop() — kills the subscription and returns the final summary,
 *      including reverse-geocoded start/end addresses.
 *
 * Sampling: we ask for ONE update per 5 seconds OR every 10 metres,
 * whichever comes first. That keeps the buffer small (≈12 samples per
 * minute) without losing detail on short urban hops.
 *
 * Distance noise: at low speeds GPS jitters a few metres per fix. We
 * discard any individual hop < 5 metres so a stationary car (queued at
 * a light) doesn't accrue phantom distance.
 *
 * Resilience: every async location/geocoding call is wrapped in try/catch
 * so a single hiccup never crashes a drive in progress.
 */
import * as Location from 'expo-location';

export interface DriveSample {
  lat: number;
  lng: number;
  ts: number;          // epoch ms
}

export interface DriveTick {
  distanceKm: number;
  elapsedMs: number;
  samples: DriveSample[];
}

export interface DriveSummary {
  distanceKm: number;
  durationSeconds: number;
  startedAt: string;      // ISO
  endedAt: string;        // ISO
  startLat: number | null;
  startLng: number | null;
  endLat: number | null;
  endLng: number | null;
  startAddress: string | null;
  endAddress: string | null;
  samples: DriveSample[];
}

export type PermissionState = 'granted' | 'denied' | 'denied_forever';

const MIN_HOP_METRES = 5;
const SAMPLE_INTERVAL_MS = 5_000;
const SAMPLE_DISTANCE_M = 10;

let watcher: Location.LocationSubscription | null = null;
let startedAt: Date | null = null;
let samples: DriveSample[] = [];
let distanceKm = 0;
const listeners = new Set<(tick: DriveTick) => void>();

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Ask the OS for foreground location. We deliberately do NOT request
 * background location — the brief calls for live tracking only while the
 * user has the app open, and asking for "always" permission scares users
 * and complicates Play Store review.
 */
export async function requestPermissions(): Promise<PermissionState> {
  try {
    const existing = await Location.getForegroundPermissionsAsync();
    if (existing.status === 'granted') return 'granted';
    // If the user has previously denied with "don't ask again", canAskAgain
    // is false and we can only direct them to Settings.
    if (!existing.canAskAgain) return 'denied_forever';

    const result = await Location.requestForegroundPermissionsAsync();
    if (result.status === 'granted') return 'granted';
    return result.canAskAgain ? 'denied' : 'denied_forever';
  } catch {
    return 'denied';
  }
}

export function isTracking(): boolean {
  return watcher !== null;
}

/**
 * Begin a tracking session. Resolves once the watcher is hooked up so the
 * caller can flip UI to "tracking" immediately afterwards.
 *
 * Throws if permissions are missing — call requestPermissions() first.
 */
export async function start(): Promise<void> {
  if (watcher) return; // already tracking — no-op
  const perm = await Location.getForegroundPermissionsAsync();
  if (perm.status !== 'granted') {
    throw new Error('LOCATION_PERMISSION_DENIED');
  }

  // Reset state
  samples = [];
  distanceKm = 0;
  startedAt = new Date();

  watcher = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: SAMPLE_INTERVAL_MS,
      distanceInterval: SAMPLE_DISTANCE_M,
    },
    (loc) => onFix(loc),
  );
}

/**
 * Stop the active session and resolve with a summary suitable for
 * persisting via insertDrive(). Returns null if no session is active.
 */
export async function stop(): Promise<DriveSummary | null> {
  if (!watcher || !startedAt) return null;
  try { watcher.remove(); } catch { /* OS already cleaned up */ }
  watcher = null;

  const endedAtDate = new Date();
  const first = samples[0] ?? null;
  const last  = samples[samples.length - 1] ?? null;

  // Reverse geocoding is best-effort — Apple/Google can rate-limit, and
  // we'd rather save the drive without a label than block the save.
  const [startAddress, endAddress] = await Promise.all([
    first ? reverseGeocode(first.lat, first.lng) : Promise.resolve(null),
    last  ? reverseGeocode(last.lat,  last.lng)  : Promise.resolve(null),
  ]);

  const summary: DriveSummary = {
    distanceKm,
    durationSeconds: Math.round((endedAtDate.getTime() - startedAt.getTime()) / 1000),
    startedAt: startedAt.toISOString(),
    endedAt: endedAtDate.toISOString(),
    startLat: first?.lat ?? null,
    startLng: first?.lng ?? null,
    endLat:   last?.lat  ?? null,
    endLng:   last?.lng  ?? null,
    startAddress,
    endAddress,
    samples: [...samples],
  };

  // Clear in-memory state so a follow-up start() begins fresh.
  samples = [];
  distanceKm = 0;
  startedAt = null;
  return summary;
}

/**
 * Subscribe to live ticks. Returns an unsubscribe function. The callback
 * fires on every accepted fix (i.e. after noise filtering) so the UI can
 * show the running distance + duration in real time.
 */
export function subscribe(cb: (tick: DriveTick) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

// ── Internals ───────────────────────────────────────────────────────────────

function onFix(loc: Location.LocationObject) {
  const sample: DriveSample = {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    ts: loc.timestamp,
  };
  const prev = samples[samples.length - 1];
  if (prev) {
    const hopMetres = haversineKm(prev.lat, prev.lng, sample.lat, sample.lng) * 1000;
    if (hopMetres < MIN_HOP_METRES) return; // jitter — ignore
    distanceKm += hopMetres / 1000;
  }
  samples.push(sample);

  const tick: DriveTick = {
    distanceKm,
    elapsedMs: startedAt ? sample.ts - startedAt.getTime() : 0,
    samples,
  };
  for (const l of listeners) {
    try { l(tick); } catch { /* listener bug shouldn't kill the watcher */ }
  }
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!results || results.length === 0) return null;
    const r = results[0];
    // Prefer "Street, City". Fall back to whatever components exist — OFF-
    // road / remote routes might only have a region.
    const parts = [
      r.street ?? r.name,
      r.city ?? r.subregion ?? r.region,
    ].filter((s): s is string => typeof s === 'string' && s.length > 0);
    if (parts.length === 0) return null;
    return parts.join(', ');
  } catch {
    return null;
  }
}

/**
 * Haversine — distance between two GPS coords in kilometres. Earth radius
 * 6371 km. We keep our own copy here (rather than importing from db/drives)
 * so the tracker has zero coupling to the DB layer.
 */
export function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
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
