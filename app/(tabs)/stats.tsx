import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { Text } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getMonthlySummary, getMonthlyDeductibleTotal } from '../../src/db/receipts';
import { useAppStore } from '../../src/stores/appStore';
import { useThemeTokens, useActiveScheme } from '../../src/theme';
import { CATEGORY_ICONS } from '../../src/constants';

type Period = 'this' | 'last';

function getYearMonth(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString('en-CA').slice(0, 7);
}

export default function StatsScreen() {
  const t = useThemeTokens();
  const scheme = useActiveScheme();
  const [period, setPeriod] = useState<Period>('this');
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getMonthlySummary>> | null>(null);
  const [deductible, setDeductible] = useState<{ total: number; count: number }>({ total: 0, count: 0 });
  const currency = useAppStore((s) => s.currency);

  const load = useCallback(async () => {
    const ym = getYearMonth(period === 'this' ? 0 : -1);
    const [data, ded] = await Promise.all([
      getMonthlySummary(ym),
      getMonthlyDeductibleTotal(ym),
    ]);
    setSummary(data);
    setDeductible(ded);
  }, [period]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
    } catch {
      return `${currency} ${n.toFixed(2)}`;
    }
  };

  const total = summary?.total ?? 0;
  const byCategory = summary?.byCategory ?? [];
  const topMerchants = summary?.topMerchants ?? [];
  const maxCategory = Math.max(...byCategory.map((c) => c.total), 1);

  const monthLabel = period === 'this'
    ? new Date().toLocaleString('default', { month: 'long', year: 'numeric' })
    : new Date(new Date().setMonth(new Date().getMonth() - 1))
        .toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <ScrollView style={{ backgroundColor: t.background }} contentContainerStyle={styles.container}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Title */}
      <Text style={[styles.pageTitle, { color: t.textPrimary }]}>Overview</Text>

      {/* Period switcher */}
      <View style={[styles.segmentWrap, { backgroundColor: t.surface, borderColor: t.border }]}>
        {(['this', 'last'] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setPeriod(p)}
            activeOpacity={0.85}
            style={[
              styles.segmentBtn,
              period === p && { backgroundColor: t.surfaceElevated },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: period === p ? t.textPrimary : t.textMuted },
              ]}
            >
              {p === 'this' ? 'This month' : 'Last month'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Total card — hero */}
      <View style={[styles.heroCard, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Text style={[styles.totalLabel, { color: t.textSubtle }]}>{monthLabel.toUpperCase()}</Text>
        <Text style={[styles.totalAmount, { color: t.cta }]}>{fmt(total)}</Text>
        <Text style={[styles.totalSub, { color: t.textMuted }]}>
          {byCategory.length} {byCategory.length === 1 ? 'category' : 'categories'} · {topMerchants.reduce((s, m) => s + m.count, 0)} receipts
        </Text>
      </View>

      {/* Tax-deductible card */}
      {deductible.total > 0 && (
        <View style={[styles.deductibleCard, { backgroundColor: t.deductibleBg, borderColor: t.deductible + '55' }]}>
          <View style={[styles.deductibleIcon, { backgroundColor: t.deductible + '22' }]}>
            <MaterialCommunityIcons name="cash-multiple" size={26} color={t.deductible} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.deductibleLabel, { color: t.deductible }]}>TAX DEDUCTIBLE THIS PERIOD</Text>
            <Text style={[styles.deductibleAmount, { color: t.textPrimary }]}>{fmt(deductible.total)}</Text>
            <Text style={[styles.deductibleCount, { color: t.textMuted }]}>
              {deductible.count} receipt{deductible.count !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      )}

      {/* By category */}
      {byCategory.length > 0 ? (
        <View style={[styles.section, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.sectionTitle, { color: t.textMuted }]}>SPENDING BY CATEGORY</Text>
          <View style={{ gap: 16 }}>
            {byCategory.map((cat) => {
              const pct = (cat.total / maxCategory) * 100;
              return (
                <View key={cat.category} style={styles.barRow}>
                  <View style={[styles.barIcon, { backgroundColor: t.accent + '22' }]}>
                    <MaterialCommunityIcons
                      name={(CATEGORY_ICONS[cat.category] ?? 'tag') as any}
                      size={18}
                      color={t.accent}
                    />
                  </View>
                  <View style={styles.barContent}>
                    <View style={styles.barLabel}>
                      <Text style={[styles.barCategory, { color: t.textPrimary }]}>{cat.category}</Text>
                      <Text style={[styles.barAmount, { color: t.textPrimary }]}>{fmt(cat.total)}</Text>
                    </View>
                    <View style={[styles.barTrack, { backgroundColor: t.surfaceElevated }]}>
                      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: t.accent }]} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={[styles.section, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={styles.empty}>
            <MaterialCommunityIcons name="chart-pie" size={48} color={t.textSubtle} />
            <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>No receipts this period</Text>
            <Text style={[styles.emptyBody, { color: t.textMuted }]}>
              Scan some receipts to see stats
            </Text>
          </View>
        </View>
      )}

      {/* Top merchants */}
      {topMerchants.length > 0 && (
        <View style={[styles.section, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.sectionTitle, { color: t.textMuted }]}>TOP MERCHANTS</Text>
          <View style={{ gap: 14 }}>
            {topMerchants.map((m, i) => (
              <View key={`${m.merchant}-${i}`} style={styles.merchantRow}>
                <View style={[styles.rank, { backgroundColor: t.accent + '22' }]}>
                  <Text style={[styles.rankText, { color: t.accent }]}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.merchantName, { color: t.textPrimary }]} numberOfLines={1}>
                    {m.merchant || 'Unknown'}
                  </Text>
                  <Text style={[styles.merchantCount, { color: t.textMuted }]}>
                    {m.count} receipt{m.count !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Text style={[styles.merchantTotal, { color: t.textPrimary }]}>{fmt(m.total)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14, paddingBottom: 40, paddingTop: 56 },

  pageTitle: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 28,
    letterSpacing: -0.5,
    marginBottom: 4,
  },

  segmentWrap: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  segmentText: { fontFamily: 'Inter_500Medium', fontSize: 13 },

  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
  },
  totalLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  totalAmount: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 44,
    letterSpacing: -1.2,
    lineHeight: 48,
  },
  totalSub: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 8 },

  deductibleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  deductibleIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deductibleLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  deductibleAmount: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 24,
    letterSpacing: -0.5,
  },
  deductibleCount: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },

  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    paddingTop: 14,
  },
  sectionTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 14,
  },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  barIcon: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  barContent: { flex: 1 },
  barLabel: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  barCategory: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  barAmount: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  barTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },

  merchantRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rank: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  merchantName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  merchantCount: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 1 },
  merchantTotal: { fontFamily: 'Inter_700Bold', fontSize: 15 },

  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, marginTop: 12 },
  emptyBody: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 4 },
});
