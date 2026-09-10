import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  PanResponder,
  Alert,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeTokens, SemanticTokens } from '../src/theme';
import {
  getScanHistory,
  deleteScanFromHistory,
  restoreScanToHistory,
  clearScanHistory,
  type ScanHistoryEntry,
} from '../src/db/scanHistory';
import type { ProductKind } from '../src/services/productLookup';
import { hapticLight, hapticMedium } from '../src/utils/haptics';

/**
 * Scan history.
 *
 * Search covers name, brand and the barcode digits, because people remember
 * a scan in whichever of those three stuck — "that oat milk", "the Nivea one",
 * or the number they were comparing against a shelf label.
 */

const FILTERS: { value: ProductKind | 'all'; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: 'view-grid-outline' },
  { value: 'food', label: 'Food', icon: 'food-apple-outline' },
  { value: 'drink', label: 'Drink', icon: 'cup-outline' },
  { value: 'alcohol', label: 'Alcohol', icon: 'glass-wine' },
  { value: 'cosmetic', label: 'Beauty', icon: 'bottle-tonic-outline' },
  { value: 'petfood', label: 'Pet', icon: 'paw-outline' },
  { value: 'other', label: 'Other', icon: 'package-variant-closed' },
];

/** How far the row must travel before the delete commits. */
const SWIPE_THRESHOLD = 96;

function timeAgo(iso: string): string {
  // SQLite datetime('now') is UTC without a zone marker; JS would read it as
  // local time and show "in 1 hour" for a scan that just happened.
  const then = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z').getTime();
  if (!Number.isFinite(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}

function SwipeRow({
  entry,
  tokens,
  onDelete,
  onPress,
}: {
  entry: ScanHistoryEntry;
  tokens: SemanticTokens;
  onDelete: () => void;
  onPress: () => void;
}) {
  const dx = useRef(new Animated.Value(0)).current;
  const armed = useRef(false);

  const pan = useRef(
    PanResponder.create({
      // Only claim the gesture once it is clearly horizontal, so the list can
      // still be scrolled vertically through the rows.
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderMove: (_e, g) => {
        const next = Math.min(0, g.dx);
        dx.setValue(next);
        const nowArmed = next < -SWIPE_THRESHOLD;
        if (nowArmed !== armed.current) {
          armed.current = nowArmed;
          hapticLight();
        }
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dx < -SWIPE_THRESHOLD) {
          hapticMedium();
          Animated.timing(dx, { toValue: -500, duration: 160, useNativeDriver: true }).start(
            onDelete
          );
        } else {
          armed.current = false;
          Animated.spring(dx, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
      onPanResponderTerminate: () => {
        armed.current = false;
        Animated.spring(dx, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  return (
    <View style={styles.swipeWrap}>
      <View style={[styles.deleteBacking, { backgroundColor: tokens.danger }]}>
        <MaterialCommunityIcons name="delete-outline" size={22} color="#fff" />
        <Text style={styles.deleteBackingText}>Delete</Text>
      </View>
      <Animated.View style={{ transform: [{ translateX: dx }] }} {...pan.panHandlers}>
        <TouchableOpacity
          style={[styles.row, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
          onPress={onPress}
          activeOpacity={0.75}
        >
          {entry.imageUrl ? (
            <Image source={{ uri: entry.imageUrl }} style={styles.thumb} resizeMode="contain" />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: tokens.surfaceElevated }]}>
              <MaterialCommunityIcons
                name="barcode"
                size={20}
                color={tokens.textSubtle}
              />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: tokens.textPrimary }]} numberOfLines={2}>
              {entry.name || entry.barcode}
            </Text>
            {!!entry.brand && (
              <Text style={[styles.rowSub, { color: tokens.textMuted }]} numberOfLines={1}>
                {entry.brand}
              </Text>
            )}
            <Text style={[styles.rowMeta, { color: tokens.textSubtle }]} numberOfLines={1}>
              {entry.barcode} · {timeAgo(entry.scannedAt)}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={tokens.textSubtle} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export default function ScanHistoryScreen() {
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();

  const [entries, setEntries] = useState<ScanHistoryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<ProductKind | 'all'>('all');
  const [loading, setLoading] = useState(true);

  /** Rows removed from the list but not yet committed, for undo. */
  const [pending, setPending] = useState<ScanHistoryEntry | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const rows = await getScanHistory({ search, kind });
    setEntries(rows);
    setLoading(false);
  }, [search, kind]);

  useEffect(() => {
    // Debounced so typing doesn't fire a query per keystroke.
    const timer = setTimeout(load, search ? 220 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  const remove = (entry: ScanHistoryEntry) => {
    // Delete immediately so the row actually disappears, and keep the data in
    // hand for five seconds so Undo can put it back exactly as it was.
    setEntries((list) => list.filter((e) => e.id !== entry.id));
    deleteScanFromHistory(entry.id);
    setPending(entry);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setPending(null), 5000);
  };

  const undo = async () => {
    if (!pending) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    await restoreScanToHistory(pending);
    setPending(null);
    load();
  };

  const confirmClear = () => {
    Alert.alert(
      'Clear scan history?',
      'This removes every scan from the list. Your receipts are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearScanHistory();
            setEntries([]);
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <Stack.Screen
        options={{
          title: 'Scan history',
          headerRight: () =>
            entries.length > 0 ? (
              <TouchableOpacity onPress={confirmClear} hitSlop={10}>
                <MaterialCommunityIcons name="delete-sweep-outline" size={22} color={t.danger} />
              </TouchableOpacity>
            ) : null,
        }}
      />

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: t.surface, borderColor: t.border }]}>
        <MaterialCommunityIcons name="magnify" size={19} color={t.textSubtle} />
        <TextInput
          style={[styles.searchInput, { color: t.textPrimary }]}
          placeholder="Search name, brand or barcode"
          placeholderTextColor={t.textSubtle}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={10}>
            <MaterialCommunityIcons name="close-circle" size={17} color={t.textSubtle} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category filter */}
      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={(f) => f.value}
        showsHorizontalScrollIndicator={false}
        style={styles.filterList}
        contentContainerStyle={styles.filterContent}
        renderItem={({ item }) => {
          const on = kind === item.value;
          return (
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setKind(item.value);
              }}
              activeOpacity={0.75}
              style={[
                styles.filterChip,
                {
                  backgroundColor: on ? t.accent : t.surface,
                  borderColor: on ? t.accent : t.border,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={item.icon as any}
                size={14}
                color={on ? t.textInverse : t.textMuted}
              />
              <Text
                style={[styles.filterText, { color: on ? t.textInverse : t.textPrimary }]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={t.accent} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => String(e.id)}
          contentContainerStyle={{ paddingBottom: insets.bottom + 90, paddingTop: 4 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons
                name={search || kind !== 'all' ? 'magnify-close' : 'barcode-scan'}
                size={54}
                color={t.textSubtle}
              />
              <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>
                {search || kind !== 'all' ? 'Nothing matches' : 'No scans yet'}
              </Text>
              <Text style={[styles.emptyBody, { color: t.textMuted }]}>
                {search || kind !== 'all'
                  ? 'Try a different search or filter.'
                  : 'Scan a product barcode and it will appear here.'}
              </Text>
              {!search && kind === 'all' && (
                <TouchableOpacity
                  style={[styles.emptyBtn, { backgroundColor: t.cta }]}
                  onPress={() => router.push('/capture')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.emptyBtnText, { color: t.ctaText }]}>Open the scanner</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <SwipeRow
              entry={item}
              tokens={t}
              onDelete={() => remove(item)}
              onPress={() => router.push({ pathname: '/capture', params: { rescan: item.barcode } })}
            />
          )}
        />
      )}

      {/* Undo */}
      {pending && (
        <View
          style={[
            styles.snackbar,
            { backgroundColor: t.surfaceElevated, borderColor: t.border, bottom: insets.bottom + 16 },
          ]}
        >
          <Text style={[styles.snackText, { color: t.textPrimary }]} numberOfLines={1}>
            Deleted {pending.name || pending.barcode}
          </Text>
          <TouchableOpacity onPress={undo} hitSlop={10}>
            <Text style={[styles.snackAction, { color: t.cta }]}>UNDO</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },

  filterList: { flexGrow: 0, marginTop: 10 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    minHeight: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterText: { fontSize: 12.5, fontWeight: '600' },

  swipeWrap: { marginHorizontal: 16, marginTop: 8 },
  deleteBacking: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingRight: 20,
  },
  deleteBackingText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 74,
  },
  thumb: { width: 46, height: 46, borderRadius: 9 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14.5, fontWeight: '600', lineHeight: 19 },
  rowSub: { fontSize: 12.5, marginTop: 1 },
  rowMeta: { fontSize: 11, marginTop: 2 },

  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 40, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 10,
    paddingHorizontal: 24,
    minHeight: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtnText: { fontSize: 15, fontWeight: '700' },

  snackbar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    minHeight: 50,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  snackText: { flex: 1, fontSize: 13.5 },
  snackAction: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
});
