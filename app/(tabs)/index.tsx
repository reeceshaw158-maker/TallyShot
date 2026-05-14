/**
 * Dashboard — home screen styled after Easy Expense.
 * Shows: monthly financials, quick-action circles, recent receipts.
 */
import { useCallback, useState } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAllReceipts, getMonthlySummary, getNeedsReviewCount, getMonthlyDeductibleTotal } from '../../src/db/receipts';
import { getDrivesSummary } from '../../src/db/drives';
import { useThemeTokens, useActiveScheme } from '../../src/theme';
import { useAppStore, FREE_SCAN_LIMIT } from '../../src/stores/appStore';
import { MerchantAvatar } from '../../src/components/MerchantAvatar';
import { Receipt } from '../../src/types';

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
  const [drivesKm, setDrivesKm] = useState(0);
  const [drivesCount, setDrivesCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const ym = currentYM();
    const [summary, ded, all, review, drv] = await Promise.all([
      getMonthlySummary(ym),
      getMonthlyDeductibleTotal(ym),
      getAllReceipts({ includeArchived: false }),
      getNeedsReviewCount(),
      getDrivesSummary(),
    ]);
    setMonthTotal(summary.total);
    setDeductibleTotal(ded.total);
    setReceiptCount(all.length);
    setNeedsReview(review);
    setRecent(all.slice(0, 5));
    setDrivesKm(drv.totalKm);
    setDrivesCount(drv.count);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
    } catch {
      return `${currency} ${n.toFixed(2)}`;
    }
  };

  const monthLabel = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  const quickActions = [
    {
      icon: 'camera-plus', label: 'Scan',
      color: t.cta, bg: t.cta + '20',
      onPress: () => router.push('/capture'),
    },
    {
      icon: 'car', label: 'Add Drive',
      color: '#3b82f6', bg: '#3b82f620',
      onPress: () => router.push('/(tabs)/drives'),
    },
    {
      icon: 'folder-outline', label: 'Reports',
      color: '#8b5cf6', bg: '#8b5cf620',
      onPress: () => router.push('/reports' as any),
    },
    {
      icon: 'export-variant', label: 'Export',
      color: '#6b7280', bg: '#6b728020',
      onPress: () => router.push('/export'),
    },
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
              <MaterialCommunityIcons name="receipt" size={18} color="#fff" />
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

        {/* ── Needs Review banner ── */}
        {needsReview > 0 && (
          <TouchableOpacity
            style={[styles.reviewBanner, { backgroundColor: '#fef3c7', borderColor: '#fbbf24' }]}
            onPress={() => router.push('/(tabs)/stats')}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="alert-circle" size={18} color="#b45309" />
            <Text style={[styles.reviewText, { color: '#b45309' }]}>
              {needsReview} receipt{needsReview !== 1 ? 's' : ''} need review — tap to fix
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color="#b45309" />
          </TouchableOpacity>
        )}

        {/* ── Financials card ── */}
        <View style={[styles.financialsCard, { backgroundColor: t.cta }]}>
          <Text style={styles.financialsLabel}>{monthLabel.toUpperCase()}</Text>
          <Text style={styles.financialsAmount}>{fmt(monthTotal)}</Text>
          <Text style={styles.financialsSub}>Total expenses</Text>
          <View style={styles.financialsRow}>
            <View style={styles.financialsStat}>
              <Text style={styles.financialsStatValue}>{fmt(deductibleTotal)}</Text>
              <Text style={styles.financialsStatLabel}>Tax Deductible</Text>
            </View>
            <View style={styles.financialsStatDivider} />
            <View style={styles.financialsStat}>
              <Text style={styles.financialsStatValue}>{receiptCount}</Text>
              <Text style={styles.financialsStatLabel}>Receipts</Text>
            </View>
            <View style={styles.financialsStatDivider} />
            <View style={styles.financialsStat}>
              <Text style={styles.financialsStatValue}>{drivesCount}</Text>
              <Text style={styles.financialsStatLabel}>Drives</Text>
            </View>
          </View>
        </View>

        {/* ── Scan limit pill (free users) ── */}
        {!isPro && (
          <TouchableOpacity
            style={[styles.limitPill, { backgroundColor: t.surface, borderColor: t.border }]}
            onPress={() => router.push('/paywall')}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="crown" size={14} color={t.cta} />
            <Text style={[styles.limitText, { color: t.textMuted }]}>
              {scansLeft} free AI scans left this month
            </Text>
            <Text style={[styles.limitUpgrade, { color: t.cta }]}>Upgrade →</Text>
          </TouchableOpacity>
        )}

        {/* ── Quick actions ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: t.textSubtle }]}>QUICK ACTIONS</Text>
        </View>
        <View style={styles.quickRow}>
          {quickActions.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={styles.quickItem}
              onPress={a.onPress}
              activeOpacity={0.8}
            >
              <View style={[styles.quickCircle, { backgroundColor: a.bg }]}>
                <MaterialCommunityIcons name={a.icon as any} size={24} color={a.color} />
              </View>
              <Text style={[styles.quickLabel, { color: t.textMuted }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Drives summary card ── */}
        {drivesCount > 0 && (
          <TouchableOpacity
            style={[styles.drivesCard, { backgroundColor: t.surface, borderColor: t.border }]}
            onPress={() => router.push('/(tabs)/drives')}
            activeOpacity={0.85}
          >
            <View style={[styles.drivesIcon, { backgroundColor: '#3b82f620' }]}>
              <MaterialCommunityIcons name="car" size={22} color="#3b82f6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.drivesTitle, { color: t.textPrimary }]}>
                {drivesCount} drive{drivesCount !== 1 ? 's' : ''} recorded
              </Text>
              <Text style={[styles.drivesSub, { color: t.textMuted }]}>
                {drivesKm.toFixed(1)} km · {(drivesKm * 0.621371).toFixed(1)} mi total
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={t.textMuted} />
          </TouchableOpacity>
        )}

        {/* ── Recent receipts ── */}
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
              <MaterialCommunityIcons name="camera-plus" size={16} color="#fff" />
              <Text style={styles.emptyBtnText}>Scan your first receipt</Text>
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
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1,
  },
  reviewText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13 },

  financialsCard: {
    marginHorizontal: 16, borderRadius: 20, padding: 22, marginBottom: 12,
  },
  financialsLabel: {
    fontFamily: 'Inter_600SemiBold', fontSize: 11,
    color: 'rgba(255,255,255,0.7)', letterSpacing: 1, marginBottom: 6,
  },
  financialsAmount: {
    fontFamily: 'Inter_800ExtraBold', fontSize: 42,
    color: '#fff', letterSpacing: -1.5, lineHeight: 48,
  },
  financialsSub: {
    fontFamily: 'Inter_400Regular', fontSize: 13,
    color: 'rgba(255,255,255,0.65)', marginBottom: 20,
  },
  financialsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14, padding: 14,
  },
  financialsStat: { flex: 1, alignItems: 'center' },
  financialsStatValue: {
    fontFamily: 'Inter_700Bold', fontSize: 16, color: '#fff', letterSpacing: -0.3,
  },
  financialsStatLabel: {
    fontFamily: 'Inter_400Regular', fontSize: 10,
    color: 'rgba(255,255,255,0.65)', marginTop: 3, textAlign: 'center',
  },
  financialsStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },

  limitPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1,
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
    flexDirection: 'row', justifyContent: 'space-around',
    paddingHorizontal: 12, marginBottom: 4,
  },
  quickItem: { alignItems: 'center', gap: 8, width: 72 },
  quickCircle: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  quickLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, textAlign: 'center' },

  drivesCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    borderRadius: 16, borderWidth: 1, padding: 14,
  },
  drivesIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  drivesTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  drivesSub: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },

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
  emptyBtnText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#fff' },
});
