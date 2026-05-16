import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, Alert,
  FlatList, TextInput, StatusBar, Linking,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getAllDrives, insertDrive, deleteDrive, getDrivesSummary, Drive,
} from '../../src/db/drives';
import { getSettings } from '../../src/db/settings';
import { AppSettings } from '../../src/types';
import { useThemeTokens, useActiveScheme } from '../../src/theme';
import { hapticLight, hapticMedium, hapticHeavy } from '../../src/utils/haptics';
import * as Tracker from '../../src/services/driveTracker';

const KM_TO_MILES = 0.621371;
const MILES_TO_KM = 1.609344;
/** HMRC rate is expressed in pence-per-mile in the UI ("45p/mile").
 *  `rate * 100` produces 45.000000000000006 due to IEEE-754, so we round
 *  before display. The underlying stored rate keeps full precision. */
const ratePence = (rate: number) => Math.round(rate * 100);

export default function DrivesScreen() {
  const t = useThemeTokens();
  const scheme = useActiveScheme();
  const insets = useSafeAreaInsets();

  const [drives, setDrives] = useState<Drive[]>([]);
  const [summary, setSummary] = useState({ count: 0, totalKm: 0 });
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Manual add drive
  const [showManual, setShowManual] = useState(false);
  const [manualDist, setManualDist] = useState('');
  const [manualPurpose, setManualPurpose] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Live GPS tracking state ────────────────────────────────────────────
  const [tracking, setTracking] = useState(Tracker.isTracking());
  const [liveKm, setLiveKm] = useState(0);
  const [liveMs, setLiveMs] = useState(0);
  // Force a re-render once per second so the duration counter ticks even
  // when no new GPS samples arrive (e.g. car queued at a junction).
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const unsub = Tracker.subscribe(({ distanceKm, elapsedMs }) => {
      setLiveKm(distanceKm);
      setLiveMs(elapsedMs);
    });
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    if (tracking) {
      // Tick once a second to keep the elapsed display fluid.
      tickRef.current = setInterval(() => setLiveMs((m) => m + 1000), 1000);
    } else if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [tracking]);

  const load = useCallback(async () => {
    const [all, sum, s] = await Promise.all([getAllDrives(), getDrivesSummary(), getSettings()]);
    setDrives(all);
    setSummary(sum);
    setSettings(s);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unit = settings?.distance_unit ?? 'mi';
  const rate = settings?.mileage_rate ?? 0.45;

  // Convert stored km to display unit
  const toDisplay = (km: number) => unit === 'km' ? km : km * KM_TO_MILES;
  // Convert input (in display unit) to km for storage
  const toKm = (dist: number) => unit === 'km' ? dist : dist * MILES_TO_KM;

  const fmtDist = (km: number) => `${toDisplay(km).toFixed(1)} ${unit}`;
  const fmtAllowance = (km: number) => {
    const miles = km * KM_TO_MILES;
    const allowance = miles * rate;
    return `£${allowance.toFixed(2)}`;
  };
  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return iso.slice(0, 10); }
  };
  /** Format an elapsed seconds value as `H:MM:SS` (or `M:SS` under an hour). */
  const fmtDuration = (totalSeconds: number) => {
    const s = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(sec).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
  };

  const totalAllowance = summary.totalKm * KM_TO_MILES * rate;

  // ── GPS handlers ────────────────────────────────────────────────────────

  /**
   * Show a confirm dialog that opens device Settings so the user can
   * grant location after a permanent-deny. Used after permission status
   * becomes 'denied_forever'.
   */
  const showSettingsPrompt = () => {
    Alert.alert(
      'Location permission needed',
      "TallyShot can't track your drive without location access. Open Settings and turn on location for TallyShot to continue.",
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => { Linking.openSettings().catch(() => {}); } },
      ],
    );
  };

  const handleStartTracking = async () => {
    try {
      const perm = await Tracker.requestPermissions();
      if (perm === 'denied') {
        Alert.alert('Permission denied', 'TallyShot needs your location to measure mileage. Try again and tap Allow.');
        return;
      }
      if (perm === 'denied_forever') {
        showSettingsPrompt();
        return;
      }
      await Tracker.start();
      setTracking(true);
      setLiveKm(0);
      setLiveMs(0);
      hapticMedium();
    } catch (err: any) {
      Alert.alert('Could not start tracking', err?.message ?? 'GPS is unavailable. Make sure location is on.');
    }
  };

  const handleStopTracking = async () => {
    try {
      const summary = await Tracker.stop();
      setTracking(false);
      if (!summary || summary.distanceKm < 0.05) {
        Alert.alert('No movement detected', 'We did not record enough movement to save this drive. Try again on a longer route.');
        return;
      }
      const id = await insertDrive({
        started_at: summary.startedAt,
        ended_at: summary.endedAt,
        distance_km: summary.distanceKm,
        start_lat: summary.startLat,
        start_lng: summary.startLng,
        end_lat: summary.endLat,
        end_lng: summary.endLng,
        start_address: summary.startAddress,
        end_address: summary.endAddress,
        duration_seconds: summary.durationSeconds,
        route_json: JSON.stringify(summary.samples),
        auto_tracked: true,
      });
      hapticHeavy();
      const allowance = `£${(summary.distanceKm * KM_TO_MILES * rate).toFixed(2)}`;
      const route = [summary.startAddress, summary.endAddress].filter(Boolean).join(' → ') || '—';
      Alert.alert(
        'Drive saved',
        `Distance: ${fmtDist(summary.distanceKm)}\nDuration: ${fmtDuration(summary.durationSeconds)}\nHMRC allowance: ${allowance}\nRoute: ${route}`,
        [{ text: 'OK' }],
      );
      void id;
      await load();
    } catch (err: any) {
      Alert.alert('Could not save drive', err?.message ?? 'Please try again.');
    }
  };

  const handleManualSave = async () => {
    const dist = parseFloat(manualDist);
    if (!dist || dist <= 0) {
      Alert.alert('Enter distance', `Please enter a valid distance in ${unit}.`);
      return;
    }
    setSaving(true);
    const now = new Date().toISOString();
    await insertDrive({
      started_at: now,
      ended_at: now,
      distance_km: toKm(dist),
      purpose: manualPurpose.trim(),
      notes: manualNotes.trim(),
    });
    setManualDist('');
    setManualPurpose('');
    setManualNotes('');
    setShowManual(false);
    setSaving(false);
    hapticMedium();
    await load();
  };

  const handleDelete = (drive: Drive) => {
    hapticHeavy();
    Alert.alert('Delete drive?', `${fmtDist(drive.distance_km)} — this cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await deleteDrive(drive.id); await load(); },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />

      <FlatList
        data={drives}
        keyExtractor={(d) => String(d.id)}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={[styles.header, { paddingTop: 52 + insets.top }]}>
              <View style={styles.headerTop}>
                <View style={[styles.headerIcon, { backgroundColor: t.cta + '22' }]}>
                  <MaterialCommunityIcons name="car" size={22} color={t.cta} />
                </View>
                <View>
                  <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Drives</Text>
                  <Text style={[styles.headerSub, { color: t.textMuted }]}>
                    {summary.count} trip{summary.count !== 1 ? 's' : ''} · {fmtDist(summary.totalKm)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Summary card — dark surface with green accent on allowance */}
            <View style={[styles.summaryCard, { backgroundColor: t.surface, borderColor: t.border }]}>
              <View style={[styles.summaryRow, { backgroundColor: t.background, borderColor: t.border }]}>
                <View style={styles.summaryStat}>
                  <Text style={[styles.summaryValue, { color: t.textPrimary }]}>{fmtDist(summary.totalKm)}</Text>
                  <Text style={[styles.summaryLabel, { color: t.textMuted }]}>Total Distance</Text>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: t.border }]} />
                <View style={styles.summaryStat}>
                  <Text style={[styles.summaryValue, { color: t.textPrimary }]}>{summary.count}</Text>
                  <Text style={[styles.summaryLabel, { color: t.textMuted }]}>Trips</Text>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: t.border }]} />
                <View style={styles.summaryStat}>
                  <Text style={[styles.summaryValue, { color: t.cta }]}>{fmtAllowance(summary.totalKm)}</Text>
                  <Text style={[styles.summaryLabel, { color: t.textMuted }]}>HMRC Allowance</Text>
                </View>
              </View>
              <Text style={[styles.summaryNote, { color: t.textMuted }]}>
                At {ratePence(rate)}p/mile (HMRC {new Date().getFullYear()} rate)
              </Text>
            </View>

            {/* ── Live GPS tracker ──
                Hero CTA for the new feature: big green Start button that
                turns into a live distance/duration read-out + red Stop
                button while a session is active. */}
            {!tracking ? (
              <TouchableOpacity
                style={[styles.trackBtn, { backgroundColor: t.cta }]}
                onPress={handleStartTracking}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="map-marker-radius" size={20} color={t.ctaText} />
                <Text style={[styles.trackBtnText, { color: t.ctaText }]}>Start Drive</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.trackingCard, { backgroundColor: t.surface, borderColor: t.cta }]}>
                <View style={styles.trackingHeaderRow}>
                  <View style={[styles.liveDot, { backgroundColor: t.cta }]} />
                  <Text style={[styles.trackingHeader, { color: t.cta }]}>LIVE — TRACKING DRIVE</Text>
                </View>
                <View style={styles.trackingStatsRow}>
                  <View style={styles.trackingStat}>
                    <Text style={[styles.trackingValue, { color: t.textPrimary }]}>{fmtDist(liveKm)}</Text>
                    <Text style={[styles.trackingLabel, { color: t.textMuted }]}>Distance</Text>
                  </View>
                  <View style={[styles.trackingDivider, { backgroundColor: t.border }]} />
                  <View style={styles.trackingStat}>
                    <Text style={[styles.trackingValue, { color: t.textPrimary }]}>{fmtDuration(liveMs / 1000)}</Text>
                    <Text style={[styles.trackingLabel, { color: t.textMuted }]}>Duration</Text>
                  </View>
                  <View style={[styles.trackingDivider, { backgroundColor: t.border }]} />
                  <View style={styles.trackingStat}>
                    <Text style={[styles.trackingValue, { color: t.cta }]}>{fmtAllowance(liveKm)}</Text>
                    <Text style={[styles.trackingLabel, { color: t.textMuted }]}>Allowance</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.stopBtn, { backgroundColor: t.danger }]}
                  onPress={handleStopTracking}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="stop-circle" size={18} color="#fff" />
                  <Text style={styles.stopBtnText}>Stop & Save</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Add drive button */}
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: t.surface, borderColor: t.border }]}
              onPress={() => { setShowManual((v) => !v); hapticLight(); }}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="plus-circle-outline" size={22} color={t.cta} />
              <Text style={[styles.addBtnText, { color: t.textPrimary }]}>Log a drive</Text>
              <MaterialCommunityIcons
                name={showManual ? 'chevron-up' : 'chevron-down'}
                size={20} color={t.textMuted}
              />
            </TouchableOpacity>

            {/* Manual form */}
            {showManual && (
              <View style={[styles.manualForm, { backgroundColor: t.surface, borderColor: t.border }]}>
                <TextInput
                  value={manualDist}
                  onChangeText={setManualDist}
                  placeholder={`Distance in ${unit} (e.g. ${unit === 'mi' ? '7.5' : '12.1'})`}
                  placeholderTextColor={t.textSubtle}
                  keyboardType="decimal-pad"
                  style={[styles.input, { backgroundColor: t.surfaceElevated, borderColor: t.border, color: t.textPrimary }]}
                />
                <TextInput
                  value={manualPurpose}
                  onChangeText={setManualPurpose}
                  placeholder="Purpose (e.g. Client visit)"
                  placeholderTextColor={t.textSubtle}
                  style={[styles.input, { backgroundColor: t.surfaceElevated, borderColor: t.border, color: t.textPrimary }]}
                />
                <TextInput
                  value={manualNotes}
                  onChangeText={setManualNotes}
                  placeholder="Notes (optional)"
                  placeholderTextColor={t.textSubtle}
                  style={[styles.input, { backgroundColor: t.surfaceElevated, borderColor: t.border, color: t.textPrimary }]}
                />
                {/* Live allowance preview */}
                {parseFloat(manualDist) > 0 && (
                  <View style={[styles.previewRow, { backgroundColor: t.successBg, borderRadius: 10 }]}>
                    <MaterialCommunityIcons name="cash" size={16} color={t.success} />
                    <Text style={[styles.previewText, { color: t.success }]}>
                      HMRC allowance: {fmtAllowance(toKm(parseFloat(manualDist)))}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: t.cta }, saving && { opacity: 0.6 }]}
                  onPress={handleManualSave}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="check" size={18} color={t.ctaText} />
                  <Text style={[styles.saveBtnText, { color: t.ctaText }]}>{saving ? 'Saving…' : 'Save drive'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {drives.length > 0 && (
              <Text style={[styles.listLabel, { color: t.textSubtle }]}>ALL DRIVES</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="car-off" size={52} color={t.textSubtle} />
            <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>No drives yet</Text>
            <Text style={[styles.emptyBody, { color: t.textMuted }]}>
              Log your mileage to claim the HMRC {ratePence(rate)}p/mile allowance.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.driveCard, { backgroundColor: t.surface, borderColor: t.border }]}
            onLongPress={() => handleDelete(item)}
            delayLongPress={400}
            activeOpacity={0.85}
          >
            <View style={[styles.driveIcon, { backgroundColor: t.cta + '22' }]}>
              <MaterialCommunityIcons name="car" size={20} color={t.cta} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.driveKm, { color: t.textPrimary }]}>{fmtDist(item.distance_km)}</Text>
              <Text style={[styles.driveMeta, { color: t.textMuted }]}>
                {fmtDate(item.started_at)}{item.purpose ? ` · ${item.purpose}` : ''}
              </Text>
              {item.notes ? (
                <Text style={[styles.driveNotes, { color: t.textSubtle }]} numberOfLines={1}>
                  {item.notes}
                </Text>
              ) : null}
            </View>
            <View style={styles.driveRight}>
              <Text style={[styles.driveAllowance, { color: t.success }]}>{fmtAllowance(item.distance_km)}</Text>
              <Text style={[styles.driveMiles, { color: t.textSubtle }]}>long-press to delete</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Inter_800ExtraBold', fontSize: 28, letterSpacing: -0.8 },
  headerSub: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2 },

  summaryCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 18, padding: 18, borderWidth: 1 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, borderWidth: 1 },
  summaryStat: { flex: 1, alignItems: 'center' },
  summaryValue: { fontFamily: 'Inter_800ExtraBold', fontSize: 18, letterSpacing: -0.5 },
  summaryLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 3, textAlign: 'center' },
  summaryDivider: { width: 1, height: 36 },
  summaryNote: { fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'center', marginTop: 10 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 10, borderRadius: 16, borderWidth: 1, padding: 16,
  },
  addBtnText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 15 },

  manualForm: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  input: {
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: 'Inter_400Regular', fontSize: 14, minHeight: 44,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  previewText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 12, paddingVertical: 12,
  },
  saveBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14 },

  // GPS tracking UI
  trackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 12,
    paddingVertical: 16, borderRadius: 16,
    minHeight: 56,
  },
  trackBtnText: { fontFamily: 'Inter_800ExtraBold', fontSize: 16, letterSpacing: -0.2 },
  trackingCard: {
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 18, borderWidth: 2, padding: 16, gap: 14,
  },
  trackingHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 10, height: 10, borderRadius: 5 },
  trackingHeader: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.2 },
  trackingStatsRow: { flexDirection: 'row', alignItems: 'center' },
  trackingStat: { flex: 1, alignItems: 'center' },
  trackingValue: { fontFamily: 'Inter_800ExtraBold', fontSize: 18, letterSpacing: -0.4 },
  trackingLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 2 },
  trackingDivider: { width: 1, height: 36 },
  stopBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 12,
  },
  stopBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#fff' },

  listLabel: {
    fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 0.8,
    marginHorizontal: 20, marginTop: 4, marginBottom: 6,
  },
  driveCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 8, borderRadius: 14, borderWidth: 1, padding: 14,
  },
  driveIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  driveKm: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.3 },
  driveRight: { alignItems: 'flex-end', gap: 2 },
  driveAllowance: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  driveMiles: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  driveMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  driveNotes: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40, gap: 10 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.3 },
  emptyBody: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
