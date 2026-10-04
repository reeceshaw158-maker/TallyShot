import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Alert,
  RefreshControl,
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
import { SkeletonPulse } from '../src/components/SkeletonPulse';

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
  selectable = false,
  selected = false,
}: {
  entry: ScanHistoryEntry;
  tokens: SemanticTokens;
  onDelete: () => void;
  onPress: () => void;
  /** True while compare mode is picking, which changes what a tap means. */
  selectable?: boolean;
  selected?: boolean;
}) {
  const dx = useRef(new Animated.Value(0)).current;
  const armed = useRef(false);
  /**
   * The PanResponder is created once, so it closes over the first render's
   * props. A ref keeps it reading the live value instead of a stale one.
   */
  const selectableRef = useRef(selectable);
  selectableRef.current = selectable;

  const pan = useRef(
    PanResponder.create({
      // Only claim the gesture once it is clearly horizontal, so the list can
      // still be scrolled vertically through the rows.
      onMoveShouldSetPanResponder: (_e, g) =>
        !selectableRef.current &&
        Math.abs(g.dx) > 12 &&
        Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
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
          style={[
            styles.row,
            { backgroundColor: tokens.surface, borderColor: tokens.border },
            selected && { borderColor: tokens.accent, borderWidth: 1.5 },
          ]}
          onPress={onPress}
          activeOpacity={0.75}
          accessibilityRole={selectable ? 'checkbox' : 'button'}
          accessibilityState={selectable ? { checked: selected } : undefined}
          accessibilityLabel={
            selectable
              ? `${entry.name || entry.barcode}${selected ? ', selected for comparison' : ''}`
              : `Open ${entry.name || entry.barcode}`
          }
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
          <MaterialCommunityIcons
            name={
              selectable
                ? selected
                  ? 'checkbox-marked-circle'
                  : 'checkbox-blank-circle-outline'
                : 'chevron-right'
            }
            size={20}
            color={selectable && selected ? tokens.accent : tokens.textSubtle}
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

/**
 * Grid cell: the product photo is the hero.
 *
 * People remember a scan by what the packet looked like far more reliably than
 * by its name, so the grid leads with the image and the list leads with text.
 * No swipe-to-delete here — a swipe gesture on a two-column grid fights the
 * scroll, so deleting stays a list-view action.
 */
function GridCell({
  entry,
  tokens,
  onPress,
  selectable,
  selected,
}: {
  entry: ScanHistoryEntry;
  tokens: SemanticTokens;
  onPress: () => void;
  selectable: boolean;
  selected: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.gridCell,
        { backgroundColor: tokens.surface, borderColor: selected ? tokens.accent : tokens.border },
        selected && { borderWidth: 1.5 },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole={selectable ? 'checkbox' : 'button'}
      accessibilityState={selectable ? { checked: selected } : undefined}
      accessibilityLabel={entry.name || entry.barcode}
    >
      <View style={[styles.gridImageWrap, { backgroundColor: tokens.surfaceElevated }]}>
        {entry.imageUrl ? (
          <Image source={{ uri: entry.imageUrl }} style={styles.gridImage} resizeMode="contain" />
        ) : (
          <MaterialCommunityIcons name="barcode" size={28} color={tokens.textSubtle} />
        )}
        {selectable && (
          <View style={[styles.gridCheck, { backgroundColor: tokens.background }]}>
            <MaterialCommunityIcons
              name={selected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
              size={19}
              color={selected ? tokens.accent : tokens.textSubtle}
            />
          </View>
        )}
      </View>
      <Text style={[styles.gridTitle, { color: tokens.textPrimary }]} numberOfLines={2}>
        {entry.name || entry.barcode}
      </Text>
      {!!entry.brand && (
        <Text style={[styles.gridBrand, { color: tokens.textMuted }]} numberOfLines={1}>
          {entry.brand}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function ScanHistoryScreen() {
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();

  const [entries, setEntries] = useState<ScanHistoryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<ProductKind | 'all'>('all');
  const [loading, setLoading] = useState(true);
  /** Pull-to-refresh, tracked separately so it doesn't swap in skeleton rows. */
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Compare mode. Null when off; otherwise the ids picked so far.
   *
   * Two is the whole feature — a third column does not fit on a phone and a
   * three-way comparison is a spreadsheet, not a shopping decision. Picking a
   * third therefore replaces the older of the two rather than being refused,
   * which is what people actually mean by tapping it.
   */
  const [picking, setPicking] = useState<number[] | null>(null);
  const [view, setView] = useState<'list' | 'grid'>('list');

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

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const undo = async () => {
    if (!pending) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    await restoreScanToHistory(pending);
    setPending(null);
    load();
  };

  const togglePick = (id: number) => {
    hapticLight();
    setPicking((current) => {
      const list = current ?? [];
      if (list.includes(id)) return list.filter((x) => x !== id);
      const next = [...list, id];
      // Keep the two most recent picks.
      return next.slice(-2);
    });
  };

  // Two chosen — go, and leave compare mode behind so coming back is a clean
  // list rather than a half-finished selection.
  useEffect(() => {
    if (picking && picking.length === 2) {
      const [a, b] = picking;
      setPicking(null);
      router.push({ pathname: '/compare', params: { a: String(a), b: String(b) } });
    }
  }, [picking]);

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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <TouchableOpacity
                  onPress={() => {
                    hapticLight();
                    setView((v) => (v === 'list' ? 'grid' : 'list'));
                  }}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={
                    view === 'list' ? 'Switch to grid view' : 'Switch to list view'
                  }
                >
                  <MaterialCommunityIcons
                    name={view === 'list' ? 'view-grid-outline' : 'view-list-outline'}
                    size={22}
                    color={t.textMuted}
                  />
                </TouchableOpacity>
                {entries.length > 1 && (
                  <TouchableOpacity
                    onPress={() => {
                      hapticLight();
                      setPicking((p) => (p === null ? [] : null));
                    }}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={picking === null ? 'Compare two products' : 'Cancel comparing'}
                    accessibilityState={{ selected: picking !== null }}
                  >
                    <MaterialCommunityIcons
                      name={picking === null ? 'scale-balance' : 'close'}
                      size={22}
                      color={picking === null ? t.accent : t.textMuted}
                    />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={confirmClear}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Clear scan history"
                >
                  <MaterialCommunityIcons name="delete-sweep-outline" size={22} color={t.danger} />
                </TouchableOpacity>
              </View>
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
        /* Skeleton rows rather than a spinner: the list's shape is known before
           the query resolves, so showing it costs nothing and stops the screen
           jumping from "centred spinner" to "list" on every open. */
        <View style={{ paddingTop: 4, gap: 8, paddingHorizontal: 16 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={[styles.row, { backgroundColor: t.surface, borderColor: t.border }]}
            >
              <SkeletonPulse
                style={[styles.thumb, { backgroundColor: t.surfaceElevated }]}
              />
              <View style={{ flex: 1, gap: 7 }}>
                <SkeletonPulse
                  style={{
                    height: 13,
                    width: `${70 - (i % 3) * 12}%`,
                    borderRadius: 6,
                    backgroundColor: t.surfaceElevated,
                  }}
                />
                <SkeletonPulse
                  style={{
                    height: 10,
                    width: `${45 - (i % 2) * 10}%`,
                    borderRadius: 5,
                    backgroundColor: t.surfaceElevated,
                  }}
                />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => String(e.id)}
          contentContainerStyle={{ paddingBottom: insets.bottom + 90, paddingTop: 4 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={t.accent}
              colors={[t.accent]}
              progressBackgroundColor={t.surface}
            />
          }
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
          // Remounting the rows on a view change is the point — the two
          // renderers have different layouts, and FlatList reuses cells by
          // index otherwise.
          key={view}
          numColumns={view === 'grid' ? 2 : 1}
          columnWrapperStyle={view === 'grid' ? styles.gridRow : undefined}
          renderItem={({ item }) => {
            const onPress = () =>
              picking !== null
                ? togglePick(item.id)
                : router.push({ pathname: '/capture', params: { rescan: item.barcode } });

            return view === 'grid' ? (
              <GridCell
                entry={item}
                tokens={t}
                onPress={onPress}
                selectable={picking !== null}
                selected={!!picking?.includes(item.id)}
              />
            ) : (
              <SwipeRow
                entry={item}
                tokens={t}
                selectable={picking !== null}
                selected={!!picking?.includes(item.id)}
                onDelete={() => remove(item)}
                onPress={onPress}
              />
            );
          }}
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

  gridRow: { gap: 10, paddingHorizontal: 16 },
  gridCell: {
    flex: 1,
    maxWidth: '48.5%',
    padding: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    marginBottom: 10,
  },
  gridImageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gridImage: { width: '100%', height: '100%' },
  gridCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: 11,
    padding: 1,
  },
  gridTitle: { fontSize: 13, fontWeight: '600', lineHeight: 17 },
  gridBrand: { fontSize: 11.5 },

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
