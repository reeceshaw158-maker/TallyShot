/**
 * Reports screen — list of expense reports with summary cards.
 * Tap a report to view its receipts and export as CSV.
 */
import { useState, useCallback, useEffect } from 'react';
import {
  View, FlatList, StyleSheet, TouchableOpacity, Alert, TextInput,
  StatusBar, ActivityIndicator, Modal, Pressable, ScrollView,
} from 'react-native';
import { Text } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import {
  getAllReports, insertReport, updateReport, archiveReport,
  getReportSummary, getReceiptsForReport, ReportSummary,
} from '../src/db/reports';
import { Report, ReportDraft } from '../src/types';
import { useThemeTokens, useActiveScheme, SemanticTokens } from '../src/theme';
import { useAppStore } from '../src/stores/appStore';

export default function ReportsScreen() {
  const t = useThemeTokens();
  const scheme = useActiveScheme();
  const insets = useSafeAreaInsets();
  const currency = useAppStore((s) => s.currency);

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Report | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getAllReports();
    setReports(data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const fmt = (n: number, cur?: string) => {
    const c = cur ?? currency;
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n); }
    catch { return `${c} ${n.toFixed(2)}`; }
  };

  const handleSave = async (draft: ReportDraft) => {
    if (editing) {
      await updateReport(editing.id, draft);
    } else {
      await insertReport(draft);
    }
    setSheetOpen(false);
    setEditing(null);
    load();
  };

  const handleArchive = (r: Report) => {
    Alert.alert(
      'Archive report?',
      `"${r.name}" will be hidden. Receipts assigned to it are unaffected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            await archiveReport(r.id);
            load();
          },
        },
      ]
    );
  };

  const handleExport = async (r: Report) => {
    try {
      const rows = await getReceiptsForReport(r.id);
      if (rows.length === 0) {
        Alert.alert('No receipts', 'There are no receipts assigned to this report yet.');
        return;
      }

      const headers = ['Date', 'Merchant', 'Category', 'Subtotal', 'Tax', 'Total', 'Currency', 'Deductible', 'Reimbursable', 'Notes'];
      const lines = [headers.join(',')];
      for (const row of rows) {
        lines.push([
          row.date,
          `"${(row.merchant ?? '').replace(/"/g, '""')}"`,
          `"${(row.category ?? '').replace(/"/g, '""')}"`,
          row.subtotal?.toFixed(2) ?? '0.00',
          row.tax?.toFixed(2) ?? '0.00',
          row.total?.toFixed(2) ?? '0.00',
          row.currency ?? '',
          row.is_tax_deductible ? 'Yes' : 'No',
          row.is_reimbursable ? 'Yes' : 'No',
          `"${(row.notes ?? '').replace(/"/g, '""')}"`,
        ].join(','));
      }

      const csv = lines.join('\n');
      const filename = `${r.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toLocaleDateString('en-CA')}.csv`;
      const path = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: `Export ${r.name}` });
      } else {
        Alert.alert('Sharing not available', 'Your device does not support file sharing.');
      }
    } catch (err: any) {
      Alert.alert('Export failed', err?.message ?? 'Could not generate CSV.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: 52 + insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={t.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.pageTitle, { color: t.textPrimary }]}>Reports</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: t.cta }]}
          onPress={() => { setEditing(null); setSheetOpen(true); }}
        >
          <MaterialCommunityIcons name="plus" size={18} color="#fff" />
          <Text style={styles.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={t.cta} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={reports.length === 0 ? { flex: 1 } : { paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="folder-outline" size={52} color={t.textSubtle} />
              <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>No reports yet</Text>
              <Text style={[styles.emptyBody, { color: t.textMuted }]}>
                Group receipts into reports for easy export and reimbursement.
              </Text>
              <TouchableOpacity
                style={[styles.emptyAction, { backgroundColor: t.cta }]}
                onPress={() => { setEditing(null); setSheetOpen(true); }}
              >
                <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>Create report</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <ReportCard
              report={item}
              tokens={t}
              fmt={fmt}
              onEdit={() => { setEditing(item); setSheetOpen(true); }}
              onArchive={() => handleArchive(item)}
              onExport={() => handleExport(item)}
              onOpen={() => router.push({ pathname: '/report/[id]' as any, params: { id: String(item.id) } })}
            />
          )}
        />
      )}

      <ReportSheet
        visible={sheetOpen}
        report={editing}
        tokens={t}
        insets={insets}
        onSave={handleSave}
        onClose={() => { setSheetOpen(false); setEditing(null); }}
      />
    </View>
  );
}

// ── Report Card ───────────────────────────────────────────────────────────────

function ReportCard({
  report, tokens: t, fmt, onEdit, onArchive, onExport, onOpen,
}: {
  report: Report;
  tokens: SemanticTokens;
  fmt: (n: number) => string;
  onEdit: () => void;
  onArchive: () => void;
  onExport: () => void;
  onOpen: () => void;
}) {
  const [summary, setSummary] = useState<ReportSummary | null>(null);

  useEffect(() => {
    getReportSummary(report.id).then(setSummary);
  }, [report.id]);

  return (
    <TouchableOpacity
      style={[styles.reportCard, { backgroundColor: t.surface, borderColor: t.border }]}
      onPress={onOpen}
      activeOpacity={0.7}
    >
      {/* Title row */}
      <View style={styles.reportCardHeader}>
        <View style={[styles.reportIcon, { backgroundColor: t.cta + '18' }]}>
          <MaterialCommunityIcons name="folder-outline" size={22} color={t.cta} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.reportName, { color: t.textPrimary }]} numberOfLines={1}>{report.name}</Text>
          {report.description ? (
            <Text style={[styles.reportDesc, { color: t.textMuted }]} numberOfLines={1}>{report.description}</Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={onEdit} hitSlop={8} style={styles.cardAction}>
          <MaterialCommunityIcons name="pencil-outline" size={18} color={t.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      {summary && summary.receiptCount > 0 && (
        <View style={[styles.reportStats, { borderColor: t.border }]}>
          <Stat label="Receipts" value={String(summary.receiptCount)} tokens={t} />
          <Stat label="Total" value={fmt(summary.total)} tokens={t} />
          {summary.reimbursable > 0 && (
            <Stat label="Reimburse" value={fmt(summary.reimbursable)} tokens={t} accent />
          )}
        </View>
      )}

      {/* Action row */}
      <View style={styles.reportActions}>
        <TouchableOpacity
          style={[styles.actionPill, { backgroundColor: t.cta + '18' }]}
          onPress={onExport}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="export-variant" size={14} color={t.cta} />
          <Text style={[styles.actionPillText, { color: t.cta }]}>Export CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionPill, { backgroundColor: t.dangerBg }]}
          onPress={onArchive}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="archive-outline" size={14} color={t.danger} />
          <Text style={[styles.actionPillText, { color: t.danger }]}>Archive</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function Stat({ label, value, tokens: t, accent }: { label: string; value: string; tokens: SemanticTokens; accent?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: accent ? t.cta : t.textPrimary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: t.textMuted }]}>{label}</Text>
    </View>
  );
}

// ── Report Sheet ──────────────────────────────────────────────────────────────

function ReportSheet({
  visible, report, tokens: t, insets, onSave, onClose,
}: {
  visible: boolean;
  report: Report | null;
  tokens: SemanticTokens;
  insets: { bottom: number };
  onSave: (draft: ReportDraft) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [advance, setAdvance] = useState('');

  const handleOpen = () => {
    setName(report?.name ?? '');
    setDesc(report?.description ?? '');
    setAdvance(report ? String(report.advance_amount ?? 0) : '');
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) { Alert.alert('Name required', 'Please enter a report name.'); return; }
    onSave({
      name: trimmed,
      description: desc.trim(),
      advance_amount: parseFloat(advance) || 0,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      <Pressable style={styles.sheetOverlay} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: t.surface, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.sheetHandle, { backgroundColor: t.border }]} />
        <Text style={[styles.sheetTitle, { color: t.textPrimary }]}>
          {report ? 'Edit report' : 'New report'}
        </Text>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={[styles.fieldLabel, { color: t.textSubtle }]}>REPORT NAME *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Q2 2026 Expenses"
            placeholderTextColor={t.textSubtle}
            style={[styles.input, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.surfaceElevated ?? t.surface }]}
            autoFocus
          />

          <Text style={[styles.fieldLabel, { color: t.textSubtle }]}>DESCRIPTION (optional)</Text>
          <TextInput
            value={desc}
            onChangeText={setDesc}
            placeholder="e.g. April – June client expenses"
            placeholderTextColor={t.textSubtle}
            style={[styles.input, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.surfaceElevated ?? t.surface }]}
          />

          <Text style={[styles.fieldLabel, { color: t.textSubtle }]}>ADVANCE PAID (optional)</Text>
          <TextInput
            value={advance}
            onChangeText={setAdvance}
            placeholder="0.00"
            placeholderTextColor={t.textSubtle}
            keyboardType="decimal-pad"
            style={[styles.input, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.surfaceElevated ?? t.surface }]}
          />

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: t.cta }]}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>{report ? 'Save changes' : 'Create report'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
  },
  pageTitle: { fontFamily: 'Inter_800ExtraBold', fontSize: 24, letterSpacing: -0.5, flex: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#fff' },

  reportCard: {
    marginHorizontal: 12, marginBottom: 12,
    borderRadius: 16, borderWidth: 1,
    overflow: 'hidden',
  },
  reportCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  reportIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  reportName: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.2 },
  reportDesc: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  cardAction: { padding: 6 },

  reportStats: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },

  reportActions: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 14, paddingBottom: 14,
  },
  actionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18,
  },
  actionPillText: { fontFamily: 'Inter_500Medium', fontSize: 13 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.3 },
  emptyBody: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  emptyAction: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 8 },

  sheetOverlay: { flex: 1, backgroundColor: '#00000055' },
  sheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 12,
    maxHeight: '80%',
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.3, marginBottom: 16 },

  fieldLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 0.8, marginBottom: 6, marginTop: 12 },
  input: {
    height: 48, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, fontFamily: 'Inter_400Regular', fontSize: 15,
  },
  saveBtn: {
    height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20,
  },
  saveBtnText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 16 },
});
