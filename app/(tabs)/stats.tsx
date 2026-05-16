/**
 * Receipts list — searchable, filterable, grouped by month.
 */
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View, SectionList, StyleSheet, RefreshControl, TouchableOpacity,
  StatusBar, TextInput, ActivityIndicator, Modal, Pressable, ScrollView,
} from 'react-native';
import { Text, Snackbar } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getAllReceipts, getNeedsReviewCount, archiveReceipt,
  restoreReceipt, permanentlyDeleteReceipt,
} from '../../src/db/receipts';
import { getAllCategories } from '../../src/db/categories';
import { Receipt, ReceiptStatus } from '../../src/types';
import { DbCategory } from '../../src/types';
import { useThemeTokens, useActiveScheme, SemanticTokens } from '../../src/theme';
import { useAppStore } from '../../src/stores/appStore';
import { ReceiptStatusPill } from '../../src/components/ReceiptStatusPill';
import { MerchantAvatar } from '../../src/components/MerchantAvatar';
import { hapticLight, hapticMedium, hapticHeavy } from '../../src/utils/haptics';

type ActiveFilter =
  | { kind: 'all' }
  | { kind: 'needs_review' }
  | { kind: 'deductible' }
  | { kind: 'refund' }
  | { kind: 'category'; categoryId: number; label: string };

interface MonthSection {
  title: string;       // e.g. "May 2026"
  ym: string;          // e.g. "2026-05"
  total: number;
  data: Receipt[];
}

function groupByMonth(receipts: Receipt[]): MonthSection[] {
  const map = new Map<string, Receipt[]>();
  for (const r of receipts) {
    const ym = r.date?.slice(0, 7) ?? 'unknown';
    if (!map.has(ym)) map.set(ym, []);
    map.get(ym)!.push(r);
  }
  const sections: MonthSection[] = [];
  for (const [ym, items] of map) {
    const [year, month] = ym.split('-');
    const d = new Date(Number(year), Number(month) - 1, 1);
    const title = isNaN(d.getTime())
      ? ym
      : d.toLocaleString('default', { month: 'long', year: 'numeric' });
    const total = items.reduce((s, r) => s + (r.total ?? 0), 0);
    sections.push({ title, ym, total, data: items });
  }
  return sections;
}

export default function ReceiptsScreen() {
  const t = useThemeTokens();
  const scheme = useActiveScheme();
  const insets = useSafeAreaInsets();
  const currency = useAppStore((s) => s.currency);
  const pendingDeletion = useAppStore((s) => s.pendingDeletion);
  const setPendingDeletion = useAppStore((s) => s.setPendingDeletion);

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ActiveFilter>({ kind: 'all' });
  const [needsReviewCount, setNeedsReviewCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const firstLoadDone = useRef(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [snackVisible, setSnackVisible] = useState(false);
  const undoPressed = useRef(false);

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (pendingDeletion) {
      undoPressed.current = false;
      setSnackVisible(true);
      load();
    }
  }, [pendingDeletion]);

  const handleUndo = async () => {
    undoPressed.current = true;
    setSnackVisible(false);
    hapticMedium();
    if (pendingDeletion) {
      for (const id of pendingDeletion.ids) await restoreReceipt(id);
      setPendingDeletion(null);
      load();
    }
  };

  const handleSnackDismiss = async () => {
    setSnackVisible(false);
    if (!undoPressed.current && pendingDeletion) {
      for (const id of pendingDeletion.ids) await permanentlyDeleteReceipt(id);
      setPendingDeletion(null);
      load();
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    hapticHeavy();
    const ids = Array.from(selectedIds);
    const label = ids.length === 1 ? 'Receipt deleted' : `${ids.length} receipts deleted`;
    for (const id of ids) await archiveReceipt(id);
    exitSelectMode();
    setPendingDeletion({ ids, label });
  };

  const load = useCallback(async () => {
    try {
      setLoadError(false);
      const opts: Parameters<typeof getAllReceipts>[0] = {
        search: search || undefined,
      };
      if (filter.kind === 'category') {
        // filter by category_id — pass as raw query via search workaround
        // We'll filter client-side since getAllReceipts supports category by name
        // We'll fetch all and filter
      }
      if (filter.kind === 'needs_review') opts.status = 'needs_review';
      if (filter.kind === 'deductible') opts.deductibleOnly = true;

      const [data, count, cats] = await Promise.all([
        getAllReceipts(opts),
        getNeedsReviewCount(),
        getAllCategories(),
      ]);

      let filtered = data;
      if (filter.kind === 'category') {
        filtered = data.filter((r) => r.category_id === filter.categoryId);
      }
      if (filter.kind === 'refund') {
        filtered = data.filter((r) => r.refund);
      }

      setReceipts(filtered);
      setNeedsReviewCount(count);
      setCategories(cats);
    } catch {
      setLoadError(true);
    } finally {
      if (!firstLoadDone.current) { firstLoadDone.current = true; setInitialLoading(false); }
    }
  }, [search, filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const sections = useMemo(() => groupByMonth(receipts), [receipts]);

  const fmt = (amount: number, cur?: string) => {
    const c = cur ?? currency;
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(amount); }
    catch { return `${c} ${amount.toFixed(2)}`; }
  };

  const filterLabel: string =
    filter.kind === 'all' ? 'Filter'
    : filter.kind === 'needs_review' ? 'Needs Review'
    : filter.kind === 'deductible' ? 'Tax Deductible'
    : filter.kind === 'refund' ? 'Refunds'
    : filter.kind === 'category' ? filter.label
    : 'Filter';

  const isFiltered = filter.kind !== 'all';

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />

      {/* ── Header ── */}
      {selectMode ? (
        <View style={[styles.header, styles.selectHeader, { paddingTop: 52 + insets.top }]}>
          <TouchableOpacity onPress={exitSelectMode} hitSlop={12}>
            <MaterialCommunityIcons name="close" size={24} color={t.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.selectCount, { color: t.textPrimary }]}>{selectedIds.size} selected</Text>
          <TouchableOpacity
            onPress={handleBulkDelete}
            disabled={selectedIds.size === 0}
            style={[styles.deleteBtn, { backgroundColor: selectedIds.size === 0 ? t.danger + '55' : t.danger }]}
          >
            <MaterialCommunityIcons name="delete-outline" size={18} color="#fff" />
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.header, { paddingTop: 52 + insets.top }]}>
          <Text style={[styles.pageTitle, { color: t.textPrimary }]}>Receipts</Text>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: t.cta }]}
            onPress={() => router.push({ pathname: '/review/[id]', params: { id: 'new' } })}
          >
            <MaterialCommunityIcons name="plus" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      )}

      {initialLoading && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={t.cta} />
        </View>
      )}

      {!initialLoading && loadError && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 }}>
          <MaterialCommunityIcons name="database-alert-outline" size={56} color={t.textSubtle} />
          <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>Couldn't load receipts</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: t.cta }]} onPress={load}>
            <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {!initialLoading && !loadError && (
        <>
          <Snackbar
            visible={snackVisible} duration={5000}
            onDismiss={handleSnackDismiss}
            action={{ label: 'Undo', onPress: handleUndo }}
            style={{ marginBottom: insets.bottom }}
          >
            {pendingDeletion?.label ?? 'Receipt deleted'}
          </Snackbar>

          {/* ── Search + filter bar ── */}
          <View style={[styles.searchWrap, { backgroundColor: t.surface, borderColor: t.border }]}>
            <MaterialCommunityIcons name="magnify" size={18} color={t.textMuted} />
            <TextInput
              placeholder="Search receipts..."
              placeholderTextColor={t.textSubtle}
              value={search}
              onChangeText={(text) => {
                setSearch(text);
                if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                searchDebounceRef.current = setTimeout(() => load(), 300);
              }}
              onSubmitEditing={load}
              returnKeyType="search"
              style={[styles.searchInput, { color: t.textPrimary }]}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => { setSearch(''); setTimeout(load, 0); }} hitSlop={10}>
                <MaterialCommunityIcons name="close-circle" size={18} color={t.textSubtle} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.filterRow}>
            <TouchableOpacity
              onPress={() => { hapticLight(); setFilterOpen(true); }}
              style={[
                styles.filterBtn,
                { backgroundColor: isFiltered ? t.cta : t.surface, borderColor: isFiltered ? t.cta : t.border },
              ]}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="tune-variant"
                size={14}
                color={isFiltered ? '#fff' : t.textMuted}
              />
              <Text style={[styles.filterBtnText, { color: isFiltered ? '#fff' : t.textMuted }]}>
                {filterLabel}
              </Text>
              {isFiltered && (
                <TouchableOpacity
                  hitSlop={6}
                  onPress={() => { setFilter({ kind: 'all' }); setTimeout(load, 0); }}
                >
                  <MaterialCommunityIcons name="close" size={13} color="#fff" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            <Text style={[styles.countLabel, { color: t.textSubtle }]}>
              {receipts.length} receipt{receipts.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* ── Grouped list ── */}
          <SectionList
            sections={sections}
            keyExtractor={(item) => String(item.id)}
            style={{ flex: 1 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.cta} colors={[t.cta]} />}
            contentContainerStyle={sections.length === 0 ? { flex: 1 } : { paddingBottom: 24 }}
            stickySectionHeadersEnabled
            renderSectionHeader={({ section }) => (
              <View style={[styles.sectionHeader, { backgroundColor: t.background }]}>
                <Text style={[styles.sectionMonth, { color: t.textSubtle }]}>{section.title}</Text>
                <Text style={[styles.sectionTotal, { color: t.textMuted }]}>{fmt(section.total)}</Text>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <MaterialCommunityIcons name="receipt-text-outline" size={52} color={t.textSubtle} />
                <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>
                  {filter.kind === 'all' && !search ? 'No receipts yet' : 'Nothing matches'}
                </Text>
                <Text style={[styles.emptyBody, { color: t.textMuted }]}>
                  {filter.kind === 'all' && !search
                    ? 'Tap Scan to photograph your first receipt'
                    : 'Try a different filter or search term'}
                </Text>
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
                    isNeedsReview && { borderColor: t.warning, borderWidth: 1.5 },
                    isSelected && { borderColor: t.cta, borderWidth: 1.5, backgroundColor: t.cta + '14' },
                  ]}
                  onPress={() => selectMode ? toggleSelect(item.id) : router.push(`/receipt/${item.id}`)}
                  onLongPress={() => {
                    if (!selectMode) { hapticMedium(); setSelectMode(true); setSelectedIds(new Set([item.id])); }
                  }}
                  delayLongPress={350}
                  activeOpacity={0.7}
                >
                  {selectMode && (
                    <MaterialCommunityIcons
                      name={isSelected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                      size={22} color={isSelected ? t.cta : t.textSubtle}
                      style={{ marginRight: 4 }}
                    />
                  )}
                  {isNeedsReview ? (
                    <View style={[styles.cardIcon, { backgroundColor: t.warningBg }]}>
                      <MaterialCommunityIcons name="alert-circle-outline" size={22} color={t.warning} />
                    </View>
                  ) : (
                    <MerchantAvatar
                      merchant={item.merchant} category={item.category}
                      size={44} iconColor={t.cta} backgroundColor={t.cta + '20'}
                      borderRadius={12}
                    />
                  )}
                  <View style={styles.cardMid}>
                    <Text style={[styles.cardMerchant, { color: t.textPrimary }]} numberOfLines={1}>
                      {item.merchant || (isNeedsReview ? 'Needs review' : 'Unknown merchant')}
                    </Text>
                    <Text style={[styles.cardMeta, { color: isNeedsReview ? '#b45309' : t.textMuted }]}>
                      {isNeedsReview ? `${item.date} · Failed` : `${item.date} · ${item.category}`}
                    </Text>
                    {!isNeedsReview && (item.is_tax_deductible || item.is_reimbursable || item.refund) && (
                      <View style={{ flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                        {item.is_tax_deductible && (
                          <View style={[styles.badge, { backgroundColor: t.successBg }]}>
                            <MaterialCommunityIcons name="check-circle" size={10} color={t.success} />
                            <Text style={[styles.badgeText, { color: t.success }]}>Deductible</Text>
                          </View>
                        )}
                        {item.is_reimbursable && (
                          <View style={[styles.badge, { backgroundColor: t.cta + '18' }]}>
                            <MaterialCommunityIcons name="briefcase-outline" size={10} color={t.cta} />
                            <Text style={[styles.badgeText, { color: t.cta }]}>Reimburse</Text>
                          </View>
                        )}
                        {item.refund && (
                          <View style={[styles.badge, { backgroundColor: t.warningBg }]}>
                            <MaterialCommunityIcons name="cash-refund" size={10} color={t.warning} />
                            <Text style={[styles.badgeText, { color: t.warning }]}>Refund</Text>
                          </View>
                        )}
                      </View>
                    )}
                    {item.status !== 'complete' && (
                      <View style={{ marginTop: 5 }}><ReceiptStatusPill status={item.status} size="sm" /></View>
                    )}
                  </View>
                  <Text style={[styles.cardAmount, { color: isNeedsReview ? '#b45309' : t.textPrimary }]}>
                    {isNeedsReview && item.total === 0 ? '—' : fmt(item.total, item.currency)}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </>
      )}

      {/* ── Filter Sheet ── */}
      <FilterSheet
        visible={filterOpen}
        current={filter}
        categories={categories}
        needsReviewCount={needsReviewCount}
        tokens={t}
        insets={insets}
        onSelect={(f) => {
          hapticLight();
          setFilter(f);
          setFilterOpen(false);
          setTimeout(load, 0);
        }}
        onClose={() => setFilterOpen(false)}
      />
    </View>
  );
}

// ── Filter Sheet ─────────────────────────────────────────────────────────────

interface FilterSheetProps {
  visible: boolean;
  current: ActiveFilter;
  categories: DbCategory[];
  needsReviewCount: number;
  tokens: SemanticTokens;
  insets: { bottom: number };
  onSelect: (f: ActiveFilter) => void;
  onClose: () => void;
}

function FilterSheet({ visible, current, categories, needsReviewCount, tokens: t, insets, onSelect, onClose }: FilterSheetProps) {
  const activeCategories = categories.filter((c) => !c.archived_at);

  const presets: { label: string; icon: string; filter: ActiveFilter; tinted?: boolean }[] = [
    { label: 'All receipts', icon: 'view-list', filter: { kind: 'all' } },
    ...(needsReviewCount > 0
      ? [{ label: `Needs review (${needsReviewCount})`, icon: 'alert-circle-outline', filter: { kind: 'needs_review' as const }, tinted: true }]
      : []),
    { label: 'Tax deductible', icon: 'check-decagram-outline', filter: { kind: 'deductible' } },
    { label: 'Refunds', icon: 'cash-refund', filter: { kind: 'refund' } },
  ];

  const isActive = (f: ActiveFilter) => {
    if (f.kind !== current.kind) return false;
    if (f.kind === 'category' && current.kind === 'category') return f.categoryId === current.categoryId;
    return true;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: t.surface, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.sheetHandle, { backgroundColor: t.border }]} />
        <Text style={[styles.sheetTitle, { color: t.textPrimary }]}>Filter receipts</Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Preset filters */}
          {presets.map((p) => {
            const active = isActive(p.filter);
            const tintColor = p.tinted ? t.warning : t.accent;
            return (
              <TouchableOpacity
                key={p.label}
                onPress={() => onSelect(p.filter)}
                style={[
                  styles.filterOption,
                  { borderColor: t.border },
                  active && { backgroundColor: tintColor + '18' },
                ]}
                activeOpacity={0.7}
              >
                <View style={[styles.filterOptionIcon, { backgroundColor: active ? tintColor + '20' : t.surfaceElevated }]}>
                  <MaterialCommunityIcons name={p.icon as any} size={18} color={active ? tintColor : t.textMuted} />
                </View>
                <Text style={[styles.filterOptionLabel, { color: active ? tintColor : t.textPrimary }]}>{p.label}</Text>
                {active && <MaterialCommunityIcons name="check" size={18} color={tintColor} />}
              </TouchableOpacity>
            );
          })}

          {/* Category filters */}
          {activeCategories.length > 0 && (
            <>
              <Text style={[styles.filterSection, { color: t.textSubtle }]}>BY CATEGORY</Text>
              {activeCategories.map((cat) => {
                const catFilter: ActiveFilter = { kind: 'category', categoryId: cat.id, label: cat.name };
                const active = isActive(catFilter);
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => onSelect(catFilter)}
                    style={[
                      styles.filterOption,
                      { borderColor: t.border },
                      active && { backgroundColor: cat.color + '18' },
                    ]}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.filterOptionIcon, { backgroundColor: active ? cat.color + '30' : cat.color + '20' }]}>
                      <MaterialCommunityIcons name={cat.icon as any} size={18} color={cat.color} />
                    </View>
                    <Text style={[styles.filterOptionLabel, { color: active ? cat.color : t.textPrimary }]}>{cat.name}</Text>
                    {cat.tax_deductible ? (
                      <MaterialCommunityIcons name="check-decagram" size={14} color={t.success} style={{ marginRight: 4 }} />
                    ) : null}
                    {active && <MaterialCommunityIcons name="check" size={18} color={cat.color} />}
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectHeader: { gap: 12 },
  pageTitle: { fontFamily: 'Inter_800ExtraBold', fontSize: 28, letterSpacing: -0.8 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#fff' },
  selectCount: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.3 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  deleteBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 13 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginBottom: 8,
    paddingHorizontal: 14, height: 44, borderRadius: 14, borderWidth: 1,
  },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, paddingVertical: 0 },

  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, marginBottom: 8,
  },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, borderWidth: 1,
  },
  filterBtnText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  countLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, marginLeft: 'auto' },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  sectionMonth: { fontFamily: 'Inter_600SemiBold', fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase' },
  sectionTotal: { fontFamily: 'Inter_500Medium', fontSize: 12 },

  card: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginBottom: 8,
    borderRadius: 14, borderWidth: 1, padding: 14, minHeight: 72,
  },
  cardIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardMid: { flex: 1, marginLeft: 12 },
  cardMerchant: { fontFamily: 'Inter_600SemiBold', fontSize: 15, letterSpacing: -0.1, marginBottom: 2 },
  cardMeta: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  cardAmount: { fontFamily: 'Inter_800ExtraBold', fontSize: 16, marginLeft: 8, letterSpacing: -0.3 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontFamily: 'Inter_500Medium', fontSize: 10 },

  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.3 },
  emptyBody: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 18 },

  // Filter sheet
  sheetOverlay: { flex: 1, backgroundColor: '#00000055' },
  sheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 12,
    maxHeight: '80%',
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.3, marginBottom: 12 },
  filterSection: {
    fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 0.8,
    marginTop: 16, marginBottom: 6, marginLeft: 4,
  },
  filterOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 12, marginBottom: 4,
  },
  filterOptionIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  filterOptionLabel: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14 },
});
