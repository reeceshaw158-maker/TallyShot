/**
 * Dashboard — home screen styled after Easy Expense.
 * Shows: monthly financials, quick-action circles, recent receipts.
 */
import { useCallback, useState } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator, Image, Alert,
} from 'react-native';
import { Text } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAllReceipts, getMonthlySummary, getNeedsReviewCount, getMonthlyDeductibleTotal } from '../../src/db/receipts';
import { useThemeTokens, useActiveScheme } from '../../src/theme';
import { useAppStore, FREE_SCAN_LIMIT } from '../../src/stores/appStore';
import { MerchantAvatar } from '../../src/components/MerchantAvatar';
import { AnimatedNumber } from '../../src/components/AnimatedNumber';
import { FadeSlideCard } from '../../src/components/FadeSlideCard';
import { Receipt } from '../../src/types';
import { getRecentProducts, clearAllProductScans, deleteProductScan, ProductRecord } from '../../src/services/productCache';

function currentYM() {
  return new Date().toLocaleDateString('en-CA').slice(0, 7);
}

export default function DashboardScreen() {
  const t = useThemeTokens();
  const scheme = useActiveScheme();
  const insets = useSafeAreaInsets();
  const currency = useAppStore((s) => s.currency);
  const isPro = useAppStore((s) => s.isPro);
  const scansUsedThisMonth = useAppStore((s) => s.scansUsedThisMonth);
  const scansLeft = Math.max(0, FREE_SCAN_LIMIT - scansUsedThisMonth);

  const [loading, setLoading] = useState(true);
  const [monthTotal, setMonthTotal] = useState(0);
  const [deductibleTotal, setDeductibleTotal] = useState(0);
  const [receiptCount, setReceiptCount] = useState(0);
  const [needsReview, setNeedsReview] = useState(0);
  const [recent, setRecent] = useState<Receipt[]>([]);
  const [topCategory, setTopCategory] = useState<{ category: string; total: number } | null>(null);
  const [recentProducts, setRecentProducts] = useState<ProductRecord[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const ym = currentYM();
    const [summary, ded, all, review, products] = await Promise.all([
      getMonthlySummary(ym),
      getMonthlyDeductibleTotal(ym),
      getAllReceipts({ includeArchived: false }),
      getNeedsReviewCount(),
      getRecentProducts(8),
    ]);
    setMonthTotal(summary.total);
    setDeductibleTotal(ded.total);
    setReceiptCount(all.length);
    setNeedsReview(review);
    setRecent(all.slice(0, 5));
    setTopCategory(summary.byCategory[0] ?? null);
    setRecentProducts(products);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleClearRecentScans = () => {
    Alert.alert(
      'Clear recent scans?',
      'This removes your barcode scan history from this device. Your receipts are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: async () => {
            await clearAllProductScans();
            setRecentProducts([]);
          },
        },
      ]
    );
  };

  const handleDeleteScan = (barcode: string, name: string | null) => {
    Alert.alert(
      'Remove this scan?',
      name ? `Remove "${name}" from your recent scans?` : 'Remove this item from your recent scans?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteProductScan(barcode);
            setRecentProducts((prev) => prev.filter((p) => p.barcode !== barcode));
          },
        },
      ]
    );
  };

  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
    } catch {
      return `${currency} ${n.toFixed(2)}`;
    }
  };

  const monthLabel = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  // All quick actions use the primary green accent on a dark surface — brief
  // spec: "#1A1A1A background with #00C896 icons". Consistency over variety.
  const quickActions = [
    { icon: 'camera-outline',  label: 'Receipt',  onPress: () => router.push('/capture') },
    { icon: 'barcode-scan',    label: 'Barcode',  onPress: () => router.push('/scan/product') },
    { icon: 'folder-outline',             label: 'Reports',  onPress: () => router.push('/reports' as any) },
    { icon: 'export-variant',             label: 'Export',   onPress: () => router.push('/export') },
    { icon: 'archive-outline',            label: 'Archive',  onPress: () => router.push('/archived') },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: t.background }]}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: 52 + insets.top }]}>
          <View style={styles.headerLeft}>
            <View style={[styles.brandMark, { backgroundColor: t.cta }]}>
              <MaterialCommunityIcons name="receipt" size={18} color={t.ctaText} />
            </View>
            <Text style={[styles.brandName, { color: t.textPrimary }]}>TallyShot</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/settings')}
            style={[styles.headerBtn, { backgroundColor: t.surface, borderColor: t.border }]}
          >
            <MaterialCommunityIcons name="cog-outline" size={20} color={t.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ── Needs Review banner ── (left accent border per design spec) */}
        {needsReview > 0 && (
          <FadeSlideCard delay={60}>
          <TouchableOpacity
            style={[
              styles.reviewBanner,
              { backgroundColor: t.surface, borderLeftColor: t.warning, borderColor: t.border },
            ]}
            onPress={() => router.push('/(tabs)/stats')}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="alert-circle" size={18} color={t.warning} />
            <Text style={[styles.reviewText, { color: t.textPrimary }]}>
              {needsReview} receipt{needsReview !== 1 ? 's' : ''} need review — tap to fix
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={t.textMuted} />
          </TouchableOpacity>
          </FadeSlideCard>
        )}

        {/* ── Financials card ──
            Dark card with green accent highlights on the amount + stat values.
            Stats row separated by #2A2A2A dividers (border token). */}
        <FadeSlideCard delay={80}>
        <View style={[styles.financialsCard, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.financialsLabel, { color: t.textMuted }]}>{monthLabel.toUpperCase()}</Text>
          <AnimatedNumber
            value={monthTotal}
            formatter={fmt}
            style={[styles.financialsAmount, { color: t.textPrimary }]}
          />
          <Text style={[styles.financialsSub, { color: t.textMuted }]}>Total expenses</Text>
          <View style={[styles.financialsRow, { backgroundColor: t.background, borderColor: t.border }]}>
            <View style={styles.financialsStat}>
              <Text style={[styles.financialsStatValue, { color: t.cta }]}>{fmt(deductibleTotal)}</Text>
              <Text style={[styles.financialsStatLabel, { color: t.textMuted }]}>Tax Deductible</Text>
            </View>
            <View style={[styles.financialsStatDivider, { backgroundColor: t.border }]} />
            <View style={styles.financialsStat}>
              <Text style={[styles.financialsStatValue, { color: t.textPrimary }]}>{receiptCount}</Text>
              <Text style={[styles.financialsStatLabel, { color: t.textMuted }]}>Receipts</Text>
            </View>
          </View>
        </View>
        </FadeSlideCard>

        {/* ── Top category insight ── */}
        {topCategory && monthTotal > 0 && (
          <FadeSlideCard delay={140}>
          <TouchableOpacity
            style={[styles.insightCard, { backgroundColor: t.surface, borderColor: t.border }]}
            onPress={() => router.push('/(tabs)/stats')}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="chart-pie" size={18} color={t.accent} />
            <Text style={[styles.insightText, { color: t.textPrimary }]}>
              Top spend:{' '}
              <Text style={{ color: t.cta, fontFamily: 'Inter_600SemiBold' }}>
                {topCategory.category}
              </Text>
              {' '}· {fmt(topCategory.total)}
            </Text>
            <Text style={[styles.insightPct, { color: t.textMuted }]}>
              {Math.round((topCategory.total / monthTotal) * 100)}%
            </Text>
          </TouchableOpacity>
          </FadeSlideCard>
        )}

        {/* ── Scan limit banner (free users) ──
            Left green accent border, dark card body — visually distinct as required. */}
        {!isPro && (
          <FadeSlideCard delay={160}>
          <TouchableOpacity
            style={[
              styles.limitPill,
              { backgroundColor: t.surface, borderLeftColor: t.cta, borderColor: t.border },
            ]}
            onPress={() => router.push('/paywall')}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="crown" size={14} color={t.cta} />
            <Text style={[styles.limitText, { color: t.textPrimary }]}>
              {scansLeft} free AI scans left this month
            </Text>
            <Text style={[styles.limitUpgrade, { color: t.cta }]}>Upgrade →</Text>
          </TouchableOpacity>
          </FadeSlideCard>
        )}

        {/* ── Quick actions ── */}
        <FadeSlideCard delay={200}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: t.textSubtle }]}>QUICK ACTIONS</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
          {quickActions.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={styles.quickItem}
              onPress={a.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.quickCircle, { backgroundColor: t.surface, borderColor: t.border }]}>
                <MaterialCommunityIcons name={a.icon as any} size={22} color={t.cta} />
              </View>
              <Text style={[styles.quickLabel, { color: t.textMuted }]} numberOfLines={1}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        </FadeSlideCard>

        {/* ── Recently scanned products ── */}
        {recentProducts.length > 0 && (
          <FadeSlideCard delay={260}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: t.textSubtle }]}>RECENT SCANS</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <TouchableOpacity onPress={handleClearRecentScans} hitSlop={12}>
                <MaterialCommunityIcons name="delete-outline" size={18} color={t.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/scan/product')} hitSlop={12}>
                <Text style={[styles.seeAll, { color: t.cta }]}>Scan more</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productRow}>
            {recentProducts.map((p) => {
              const gradeColors: Record<string, string> = { a: '#00C896', b: '#85BB2F', c: '#FFCC00', d: '#FF8C00', e: '#FF4757' };
              const gradeColor = p.nutriscore ? gradeColors[p.nutriscore] : t.border;
              return (
                <TouchableOpacity
                  key={p.barcode}
                  style={[styles.productCard, { backgroundColor: t.surface, borderColor: t.border }]}
                  onPress={() => router.push(`/scan/result/${p.barcode}` as any)}
                  onLongPress={() => handleDeleteScan(p.barcode, p.name)}
                  delayLongPress={500}
                  activeOpacity={0.75}
                >
                  <View style={[styles.productImageWrap, { backgroundColor: t.surfaceElevated }]}>
                    {p.imageUrl ? (
                      <Image source={{ uri: p.imageUrl }} style={styles.productImage} resizeMode="contain" />
                    ) : (
                      <MaterialCommunityIcons name="package-variant" size={28} color={t.textSubtle} />
                    )}
                  </View>
                  {p.nutriscore && (
                    <View style={[styles.productGrade, { backgroundColor: gradeColor }]}>
                      <Text style={styles.productGradeText}>{p.nutriscore.toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={[styles.productName, { color: t.textPrimary }]} numberOfLines={2}>
                    {p.name ?? 'Product'}
                  </Text>
                  <Text style={[styles.productBrand, { color: t.textMuted }]} numberOfLines={1}>
                    {p.brand ?? p.quantity ?? ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          </FadeSlideCard>
        )}

        {/* ── Recent receipts ── */}
        <FadeSlideCard delay={280}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: t.textSubtle }]}>RECENT RECEIPTS</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/stats')} hitSlop={12}>
            <Text style={[styles.seeAll, { color: t.cta }]}>See all</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={t.cta} style={{ marginTop: 20 }} />
        ) : recent.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: t.surface, borderColor: t.border }]}>
            <MaterialCommunityIcons name="receipt-text-outline" size={40} color={t.textSubtle} />
            <Text style={[styles.emptyText, { color: t.textMuted }]}>No receipts yet</Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: t.cta }]}
              onPress={() => router.push('/capture')}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="camera-plus" size={16} color={t.ctaText} />
              <Text style={[styles.emptyBtnText, { color: t.ctaText }]}>Scan your first receipt</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.recentCard, { backgroundColor: t.surface, borderColor: t.border }]}>
            {recent.map((r, i) => {
              const isLast = i === recent.length - 1;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    styles.recentRow,
                    !isLast && { borderBottomWidth: 1, borderBottomColor: t.border },
                  ]}
                  onPress={() => router.push(`/receipt/${r.id}`)}
                  activeOpacity={0.7}
                >
                  <MerchantAvatar
                    merchant={r.merchant}
                    category={r.category}
                    size={38}
                    iconColor={t.cta}
                    backgroundColor={t.cta + '18'}
                    borderRadius={10}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.recentMerchant, { color: t.textPrimary }]} numberOfLines={1}>
                      {r.merchant || 'Unknown merchant'}
                    </Text>
                    <Text style={[styles.recentMeta, { color: t.textMuted }]}>
                      {r.date} · {r.category}
                    </Text>
                  </View>
                  <Text style={[styles.recentAmount, { color: t.textPrimary }]}>
                    {(() => {
                      try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: r.currency }).format(r.total); }
                      catch { return `${r.currency} ${r.total.toFixed(2)}`; }
                    })()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        </FadeSlideCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontFamily: 'Inter_800ExtraBold', fontSize: 20, letterSpacing: -0.4 },
  headerBtn: {
    width: 38, height: 38, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  reviewBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1, borderLeftWidth: 4,
  },
  reviewText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13 },

  financialsCard: {
    marginHorizontal: 16, borderRadius: 20, padding: 22, marginBottom: 12,
    borderWidth: 1,
  },
  financialsLabel: {
    fontFamily: 'Inter_600SemiBold', fontSize: 11,
    letterSpacing: 1, marginBottom: 6,
  },
  financialsAmount: {
    fontFamily: 'Inter_800ExtraBold', fontSize: 42,
    letterSpacing: -1.5, lineHeight: 48,
  },
  financialsSub: {
    fontFamily: 'Inter_400Regular', fontSize: 13,
    marginBottom: 20,
  },
  financialsRow: {
    flexDirection: 'row', borderRadius: 14, padding: 14, borderWidth: 1,
  },
  financialsStat: { flex: 1, alignItems: 'center' },
  financialsStatValue: {
    fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.3,
  },
  financialsStatLabel: {
    fontFamily: 'Inter_400Regular', fontSize: 10,
    marginTop: 3, textAlign: 'center',
  },
  financialsStatDivider: { width: 1 },

  insightCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: 14, borderWidth: 1,
  },
  insightText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13 },
  insightPct: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },

  limitPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1, borderLeftWidth: 4,
  },
  limitText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13 },
  limitUpgrade: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 20, marginTop: 20, marginBottom: 10,
  },
  sectionTitle: { fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 0.8 },
  seeAll: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },

  quickRow: {
    flexDirection: 'row',
    paddingHorizontal: 16, paddingBottom: 4, gap: 10,
  },
  quickItem: { alignItems: 'center', gap: 8, width: 64 },
  quickCircle: {
    width: 56, height: 56, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  quickLabel: { fontFamily: 'Inter_500Medium', fontSize: 10, textAlign: 'center' },

  productRow: {
    flexDirection: 'row',
    paddingHorizontal: 16, paddingBottom: 4, gap: 10,
  },
  productCard: {
    width: 120, borderRadius: 14, borderWidth: 1, padding: 10, gap: 6, position: 'relative',
  },
  productImageWrap: {
    width: '100%', aspectRatio: 1, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  productGrade: {
    position: 'absolute', top: 8, right: 8,
    width: 22, height: 22, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  productGradeText: { fontFamily: 'Inter_800ExtraBold', fontSize: 11, color: '#0F0F0F' },
  productImage: { width: '100%', height: '100%', borderRadius: 10 },
  productName: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 16 },
  productBrand: { fontFamily: 'Inter_400Regular', fontSize: 11 },

  recentCard: {
    marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  recentMerchant: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  recentMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  recentAmount: { fontFamily: 'Inter_700Bold', fontSize: 14, marginLeft: 8 },

  emptyCard: {
    marginHorizontal: 16, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', padding: 32, gap: 12,
  },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14,
  },
  emptyBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
});
