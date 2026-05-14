/**
 * Report detail screen — shows all receipts in a report with totals summary.
 */
import { useState, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, TouchableOpacity, Alert, StatusBar, ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import {
  getReportById, getReportSummary, getReceiptsForReport, ReportSummary,
} from '../../src/db/reports';
import { Report, Receipt } from '../../src/types';
import { useThemeTokens, useActiveScheme } from '../../src/theme';
import { useAppStore } from '../../src/stores/appStore';
import { MerchantAvatar } from '../../src/components/MerchantAvatar';

export default function ReportDetailScreen() {
  const t = useThemeTokens();
  const scheme = useActiveScheme();
  const insets = useSafeAreaInsets();
  const currency = useAppStore((s) => s.currency);
  const { id } = useLocalSearchParams<{ id: string }>();

  const [report, setReport] = useState<Report | null>(null);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const rid = Number(id);
    const [r, s, rows] = await Promise.all([
      getReportById(rid),
      getReportSummary(rid),
      getReceiptsForReport(rid),
    ]);
    setReport(r);
    setSummary(s);
    setReceipts(rows as any as Receipt[]);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const fmt = (n: number, cur?: string) => {
    const c = cur ?? currency;
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n); }
    catch { return `${c} ${n.toFixed(2)}`; }
  };

  const handleExportCsv = async () => {
    if (!report || receipts.length === 0) {
      Alert.alert('No receipts', 'Add receipts to this report before exporting.');
      return;
    }
    try {
      const headers = ['Date', 'Merchant', 'Category', 'Subtotal', 'Tax', 'Total', 'Currency', 'Deductible', 'Reimbursable', 'Notes'];
      const lines = [headers.join(',')];
      for (const r of receipts) {
        lines.push([
          r.date,
          `"${(r.merchant ?? '').replace(/"/g, '""')}"`,
          `"${(r.category ?? '').replace(/"/g, '""')}"`,
          r.subtotal?.toFixed(2) ?? '0.00',
          r.tax?.toFixed(2) ?? '0.00',
          r.total?.toFixed(2) ?? '0.00',
          r.currency ?? '',
          r.is_tax_deductible ? 'Yes' : 'No',
          r.is_reimbursable ? 'Yes' : 'No',
          `"${(r.notes ?? '').replace(/"/g, '""')}"`,
        ].join(','));
      }
      const csv = lines.join('\n');
      const filename = `${(report.name ?? 'report').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
      const path = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: `Export ${report.name}` });
      }
    } catch (err: any) {
      Alert.alert('Export failed', err?.message ?? 'Could not generate CSV.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: t.background }]}>
        <ActivityIndicator color={t.cta} style={{ marginTop: 80 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: 52 + insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={t.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.pageTitle, { color: t.textPrimary }]} numberOfLines={1}>
            {report?.name ?? 'Report'}
          </Text>
          {report?.description ? (
            <Text style={[styles.pageSub, { color: t.textMuted }]} numberOfLines={1}>{report.description}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={handleExportCsv}
          style={[styles.exportBtn, { backgroundColor: t.cta }]}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="export-variant" size={16} color="#fff" />
          <Text style={styles.exportBtnText}>CSV</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={receipts}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={receipts.length === 0 ? { flex: 1 } : { paddingBottom: 40 }}
        ListHeaderComponent={
          summary && summary.receiptCount > 0 ? (
            <View style={[styles.summaryCard, { backgroundColor: t.cta }]}>
              <View style={styles.summaryRow}>
                <SummaryPill label="Receipts" value={String(summary.receiptCount)} />
                <SummaryPill label="Net" value={fmt(summary.subtotal)} />
                <SummaryPill label="VAT" value={fmt(summary.totalVat)} />
                <SummaryPill label="Total" value={fmt(summary.total)} />
              </View>
              {summary.reimbursable > 0 && (
                <Text style={styles.reimburseLine}>
                  Reimbursable: {fmt(summary.reimbursable)}
                  {summary.report.advance_amount > 0
                    ? `  ·  Due: ${fmt(Math.max(0, summary.reimbursable - summary.report.advance_amount))}`
                    : ''}
                </Text>
              )}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="receipt-text-outline" size={48} color={t.textSubtle} />
            <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>No receipts yet</Text>
            <Text style={[styles.emptyBody, { color: t.textMuted }]}>
              Assign receipts to this report from the receipt review screen.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}
            onPress={() => router.push(`/receipt/${item.id}`)}
            activeOpacity={0.7}
          >
            <MerchantAvatar
              merchant={item.merchant} category={item.category}
              size={42} iconColor={t.cta} backgroundColor={t.cta + '20'} borderRadius={11}
            />
            <View style={styles.cardMid}>
              <Text style={[styles.cardMerchant, { color: t.textPrimary }]} numberOfLines={1}>
                {item.merchant || 'Unknown merchant'}
              </Text>
              <Text style={[styles.cardMeta, { color: t.textMuted }]}>
                {item.date} · {item.category}
              </Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={[styles.cardAmount, { color: t.textPrimary }]}>
                {fmt(item.total, item.currency)}
              </Text>
              {item.is_tax_deductible && (
                <MaterialCommunityIcons name="check-decagram" size={14} color="#15803d" />
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryPill}>
      <Text style={styles.summaryPillValue}>{value}</Text>
      <Text style={styles.summaryPillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  pageTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.4 },
  pageSub: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 1 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  exportBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 13 },

  summaryCard: { margin: 12, borderRadius: 16, padding: 16 },
  summaryRow: { flexDirection: 'row', gap: 4 },
  summaryPill: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10, paddingVertical: 8 },
  summaryPillValue: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#fff' },
  summaryPillLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  reimburseLine: { fontFamily: 'Inter_500Medium', fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 10, textAlign: 'center' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 12, marginBottom: 8,
    borderRadius: 14, borderWidth: 1, padding: 12,
  },
  cardMid: { flex: 1 },
  cardMerchant: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  cardMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  cardAmount: { fontFamily: 'Inter_700Bold', fontSize: 15 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10, marginTop: 60 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  emptyBody: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
