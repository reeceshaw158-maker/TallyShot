import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
  TextInput,
} from 'react-native';
import { Text, Snackbar } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getAllReceipts,
  getNeedsReviewCount,
  archiveReceipt,
  restoreReceipt,
  permanentlyDeleteReceipt,
} from '../../src/db/receipts';
import { Receipt, CATEGORIES, ReceiptStatus } from '../../src/types';
import { useThemeTokens, useActiveScheme } from '../../src/theme';
import { useAppStore, FREE_SCAN_LIMIT } from '../../src/stores/appStore';
import { ReceiptStatusPill } from '../../src/components/ReceiptStatusPill';

const CATEGORY_ICONS: Record<string, string> = {
  'Food & Drink': 'food',
  'Travel': 'airplane',
  'Transport': 'car',
  'Accommodation': 'bed',
  'Office & Tech': 'laptop',
  'Utilities': 'lightning-bolt',
  'Healthcare': 'medical-bag',
  'Entertainment': 'ticket',
  'Shopping': 'shopping',
  'Other': 'tag',
};

type Filter =
  | { kind: 'all' }
  | { kind: 'category'; value: string }
  | { kind: 'needs_review' }
  | { kind: 'deductible' };

export default function ReceiptsScreen() {
  const t = useThemeTokens();
  const scheme = useActiveScheme();
  const insets = useSafeAreaInsets();
  const isPro = useAppStore((s) => s.isPro);
  const scansUsedThisMonth = useAppStore((s) => s.scansUsedThisMonth);
  const scansRemaining = Math.max(0, FREE_SCAN_LIMIT - scansUsedThisMonth);
  const pendingDeletion = useAppStore((s) => s.pendingDeletion);
  const setPendingDeletion = useAppStore((s) => s.setPendingDeletion);

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>({ kind: 'all' });
  const [needsReviewCount, setNeedsReviewCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // ── Multi-select ────────────────────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Undo / deletion ─────────────────────────────────────────────────────
  const [snackVisible, setSnackVisible] = useState(false);
  // Track whether undo was pressed so onDismiss knows not to permanently delete.
  const undoPressed = useRef(false);

  // Show snackbar whenever a pending deletion arrives.
  useEffect(() => {
    if (pendingDeletion) {
      undoPressed.current = false;
      setSnackVisible(true);
      load(); // hide the archived receipt(s) immediately
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDeletion]);

  const handleUndo = async () => {
    undoPressed.current = true;
    setSnackVisible(false);
    if (pendingDeletion) {
      for (const id of pendingDeletion.ids) {
        await restoreReceipt(id);
      }
      setPendingDeletion(null);
      load();
    }
  };

  const handleSnackDismiss = async () => {
    setSnackVisible(false);
    if (!undoPressed.current && pendingDeletion) {
      // Timer expired — permanently delete.
      // TODO v1.1: if receipts are synced to cloud, delete remote records here too.
      for (const id of pendingDeletion.ids) {
        await permanentlyDeleteReceipt(id);
      }
      setPendingDeletion(null);
      load();
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const label = ids.length === 1
      ? 'Receipt deleted'
      : `${ids.length} receipts deleted`;
    for (const id of ids) {
      await archiveReceipt(id);
    }
    exitSelectMode();
    setPendingDeletion({ ids, label });
  };

  // ── Data loading ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const opts: any = { search: search || undefined };
    if (filter.kind === 'category') opts.category = filter.value;
    if (filter.kind === 'needs_review') opts.status = 'needs_review' as ReceiptStatus;
    if (filter.kind === 'deductible') opts.deductibleOnly = true;
    const [data, count] = await Promise.all([
      getAllReceipts(opts),
      getNeedsReviewCount(),
    ]);
    setReceipts(data);
    setNeedsReviewCount(count);
  }, [search, filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const fmt = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  const monthTotal = receipts
    .filter((r) => r.status === 'complete' && r.date.startsWith(new Date().toLocaleDateString('en-CA').slice(0, 7)))
    .reduce((s, r) => s + r.total, 0);

  const filterChips: { id: string; label: string; active: boolean; onPress: () => void; icon: string; tinted?: boolean }[] = [
    {
      id: 'all',
      label: 'All',
      active: filter.kind === 'all',
      onPress: () => { setFilter({ kind: 'all' }); setTimeout(load, 0); },
      icon: 'view-list',
    },
  ];

  if (needsReviewCount > 0) {
    filterChips.push({
      id: 'needs_review',
      label: `Needs review (${needsReviewCount})`,
      active: filter.kind === 'needs_review',
      onPress: () => { setFilter({ kind: 'needs_review' }); setTimeout(load, 0); },
      icon: 'alert-circle-outline',
      tinted: true,
    });
  }

  filterChips.push({
    id: 'deductible',
    label: 'Tax deductible',
    active: filter.kind === 'deductible',
    onPress: () => { setFilter({ kind: 'deductible' }); setTimeout(load, 0); },
    icon: 'cash-multiple',
  });

  CATEGORIES.forEach((cat) => {
    filterChips.push({
      id: cat,
      label: cat,
      active: filter.kind === 'category' && filter.value === cat,
      onPress: () => { setFilter({ kind: 'category', value: cat }); setTimeout(load, 0); },
      icon: CATEGORY_ICONS[cat] ?? 'tag',
    });
  });

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />

      {/* HEADER — normal mode: brand + scan CTA.
               Select mode: selection count + Cancel + Delete. */}
      {selectMode ? (
        <View style={[styles.header, styles.selectHeader]}>
          <TouchableOpacity onPress={exitSelectMode} hitSlop={12}>
            <MaterialCommunityIcons name="close" size={24} color={t.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.selectCount, { color: t.textPrimary }]}>
            {selectedIds.size} selected
          </Text>
          <TouchableOpacity
            onPress={handleBulkDelete}
            disabled={selectedIds.size === 0}
            style={[
              styles.selectDeleteBtn,
              { backgroundColor: t.danger + (selectedIds.size === 0 ? '44' : 'ff') },
            ]}
          >
            <MaterialCommunityIcons name="delete-outline" size={18} color="#fff" />
            <Text style={styles.selectDeleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={[styles.brandMark, { backgroundColor: t.cta }]}>
              <MaterialCommunityIcons name="receipt" size={20} color={t.ctaText} />
            </View>
            <Text style={[styles.brandName, { color: t.textPrimary }]}>TallyShot</Text>
          </View>

          <View style={styles.headerBottom}>
            <View>
              <Text style={[styles.headerLabel, { color: t.textSubtle }]}>THIS MONTH</Text>
              <Text style={[styles.headerAmount, { color: t.textPrimary }]}>
                {fmt(monthTotal, 'GBP')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <TouchableOpacity
                style={[styles.scanBtn, { backgroundColor: t.cta }]}
                onPress={() => router.push('/capture')}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="camera-plus" size={20} color={t.ctaText} />
                <Text style={[styles.scanBtnText, { color: t.ctaText }]}>Scan</Text>
              </TouchableOpacity>
              {!isPro && (
                <Text style={[styles.scansLeft, { color: t.textSubtle }]}>
                  {scansRemaining} AI scans left
                </Text>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Home banner — interruptive notice for failed extractions. Counters
          Dext's silent-upload-failure review pattern: when something goes
          wrong with the AI we surface it loudly so the user never wonders
          "did that scan go through?". */}
      {needsReviewCount > 0 && filter.kind !== 'needs_review' && (
        <TouchableOpacity
          onPress={() => { setFilter({ kind: 'needs_review' }); setTimeout(load, 0); }}
          activeOpacity={0.85}
          style={[styles.homeBanner, { backgroundColor: t.needsReviewBg, borderColor: t.needsReview + '88' }]}
        >
          <MaterialCommunityIcons name="alert-circle" size={20} color={t.needsReview} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.homeBannerTitle, { color: t.needsReview }]}>
              {needsReviewCount} {needsReviewCount === 1 ? 'receipt needs' : 'receipts need'} review
            </Text>
            <Text style={[styles.homeBannerBody, { color: t.textPrimary }]}>
              The photo is safe. Tap to fix the extracted details.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={t.needsReview} />
        </TouchableOpacity>
      )}

      {/* Undo snackbar — appears after delete from detail screen or multi-select.
          Duration 5 s matches the permanent-delete delay. Sits above the tab
          bar by using the insets.bottom offset so it's never hidden. */}
      <Snackbar
        visible={snackVisible}
        duration={5000}
        onDismiss={handleSnackDismiss}
        action={{ label: 'Undo', onPress: handleUndo }}
        style={{ marginBottom: insets.bottom }}
      >
        {pendingDeletion?.label ?? 'Receipt deleted'}
      </Snackbar>

      <FlatList
        data={receipts}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View>
            {/* SEARCH */}
            <View style={[styles.searchWrap, { backgroundColor: t.surface, borderColor: t.border }]}>
              <MaterialCommunityIcons name="magnify" size={18} color={t.textMuted} />
              <TextInput
                placeholder="Search receipts..."
                placeholderTextColor={t.textSubtle}
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={load}
                style={[styles.searchInput, { color: t.textPrimary }]}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => { setSearch(''); setTimeout(load, 0); }} hitSlop={10}>
                  <MaterialCommunityIcons name="close-circle" size={18} color={t.textSubtle} />
                </TouchableOpacity>
              )}
            </View>

            {/* FILTER CHIPS */}
            <FlatList
              horizontal
              data={filterChips}
              keyExtractor={(c) => c.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              renderItem={({ item: c }) => {
                const activeBg = c.tinted ? t.warningBg : t.accent;
                const activeText = c.tinted ? t.needsReview : t.textInverse;
                return (
                  <TouchableOpacity
                    onPress={c.onPress}
                    activeOpacity={0.85}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: c.active ? activeBg : t.surface,
                        borderColor: c.active ? activeBg : t.border,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={c.icon as any}
                      size={14}
                      color={c.active ? activeText : t.textMuted}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        { color: c.active ? activeText : t.textMuted },
                      ]}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.accent}
            colors={[t.accent]}
          />
        }
        contentContainerStyle={
          receipts.length === 0
            ? styles.emptyContainer
            : { paddingBottom: 24 }
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: t.surfaceElevated }]}>
              <MaterialCommunityIcons name="receipt-text-outline" size={48} color={t.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>
              {filter.kind === 'all' ? 'No receipts yet' : 'Nothing matches'}
            </Text>
            <Text style={[styles.emptyBody, { color: t.textMuted }]}>
              {filter.kind === 'all'
                ? 'Tap Scan to photograph your first receipt'
                : 'Try a different filter or clear search'}
            </Text>
            {filter.kind === 'all' && (
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: t.cta }]}
                onPress={() => router.push('/capture')}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="camera-plus" size={18} color={t.ctaText} />
                <Text style={[styles.emptyBtnText, { color: t.ctaText }]}>Scan Receipt</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const isNeedsReview = item.status === 'needs_review';
          const isSelected = selectedIds.has(item.id);

          return (
            <TouchableOpacity
              style={[
                styles.card,
                { backgroundColor: t.surface, borderColor: t.border },
                isNeedsReview && { borderColor: t.needsReview, borderWidth: 1.5 },
                isSelected && { borderColor: t.accent, borderWidth: 1.5, backgroundColor: t.accent + '18' },
              ]}
              onPress={() => selectMode ? toggleSelect(item.id) : router.push(`/receipt/${item.id}`)}
              onLongPress={() => {
                if (!selectMode) {
                  setSelectMode(true);
                  setSelectedIds(new Set([item.id]));
                }
              }}
              delayLongPress={350}
              activeOpacity={0.7}
            >
              {selectMode && (
                <MaterialCommunityIcons
                  name={isSelected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                  size={22}
                  color={isSelected ? t.accent : t.textSubtle}
                  style={{ marginRight: 4 }}
                />
              )}
              <View
                style={[
                  styles.cardIcon,
                  {
                    backgroundColor: isNeedsReview
                      ? t.needsReviewBg
                      : t.accent + '22',
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={
                    isNeedsReview
                      ? 'alert-circle-outline'
                      : ((CATEGORY_ICONS[item.category] ?? 'tag') as any)
                  }
                  size={22}
                  color={isNeedsReview ? t.needsReview : t.accent}
                />
              </View>
              <View style={styles.cardMid}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text
                    style={[styles.cardMerchant, { color: t.textPrimary }]}
                    numberOfLines={1}
                  >
                    {item.merchant ||
                      (isNeedsReview ? 'Needs review' : 'Unknown merchant')}
                  </Text>
                  {item.is_tax_deductible && !isNeedsReview && (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.deductible }} />
                  )}
                </View>
                <Text
                  style={[
                    styles.cardMeta,
                    { color: isNeedsReview ? t.needsReview : t.textMuted },
                  ]}
                >
                  {isNeedsReview
                    ? `${item.date} · Failed`
                    : `${item.date} · ${item.category}`}
                </Text>
                {item.status !== 'complete' && (
                  <View style={{ marginTop: 6 }}>
                    <ReceiptStatusPill status={item.status} size="sm" />
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.cardAmount,
                  { color: isNeedsReview ? t.needsReview : t.textPrimary },
                ]}
              >
                {isNeedsReview && item.total === 0 ? '—' : fmt(item.total, item.currency)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Home banner — prominent failure notice (above the list)
  homeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  homeBannerTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, letterSpacing: -0.2 },
  homeBannerBody: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2, lineHeight: 16 },

  // Header
  header: {
    paddingTop: 56,
    paddingBottom: 24,
    paddingHorizontal: 20,
    gap: 24,
  },
  // Select-mode header replaces normal header
  selectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    gap: 12,
  },
  selectCount: {
    flex: 1,
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    letterSpacing: -0.3,
  },
  selectDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    minHeight: 40,
  },
  selectDeleteText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 32, height: 32, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  brandName: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 18,
    letterSpacing: -0.3,
  },
  headerBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  headerAmount: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 36,
    letterSpacing: -1,
    lineHeight: 40,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 100,
    minHeight: 44,
  },
  scanBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    letterSpacing: -0.1,
  },
  scansLeft: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    marginTop: 6,
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginVertical: 8,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    paddingVertical: 0,
  },

  // Chips
  chipRow: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 32,
  },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 12 },

  // Receipt card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    minHeight: 72,
  },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardMid: { flex: 1 },
  cardMerchant: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    letterSpacing: -0.1,
    marginBottom: 3,
  },
  cardMeta: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  cardAmount: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 17,
    marginLeft: 8,
    letterSpacing: -0.3,
  },

  // Empty state
  emptyContainer: { flex: 1 },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: 40,
    marginTop: 60,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    marginTop: 16,
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    minHeight: 48,
  },
  emptyBtnText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
});
