import { useState, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity, TextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getReceiptsInRange } from '../src/db/receipts';
import { shareCSV, generatePDF, ReportTemplate, TEMPLATE_INFO } from '../src/services/export';
import { useAppStore } from '../src/stores/appStore';
import { useThemeTokens } from '../src/theme';

type Format = 'csv' | 'pdf';
type Range = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangeDates(r: Range): { from: string; to: string; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = ymd(now);

  switch (r) {
    case 'this_month': {
      const from = ymd(new Date(y, m, 1));
      return { from, to: today, label: now.toLocaleString('default', { month: 'long', year: 'numeric' }) };
    }
    case 'last_month': {
      const from = ymd(new Date(y, m - 1, 1));
      const to = ymd(new Date(y, m, 0));
      return { from, to, label: new Date(y, m - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' }) };
    }
    case 'this_quarter': {
      const qStart = Math.floor(m / 3) * 3;
      const from = ymd(new Date(y, qStart, 1));
      return { from, to: today, label: `Q${Math.floor(m / 3) + 1} ${y}` };
    }
    case 'this_year': {
      return { from: `${y}-01-01`, to: today, label: String(y) };
    }
    case 'custom': {
      return { from: ymd(new Date(y, m, 1)), to: today, label: 'Custom' };
    }
  }
}

export default function ExportScreen() {
  const t = useThemeTokens();
  const currency = useAppStore((s) => s.currency);

  const [range, setRange] = useState<Range>('this_month');
  const [customFrom, setCustomFrom] = useState(ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customTo, setCustomTo] = useState(ymd(new Date()));
  const [format, setFormat] = useState<Format>('pdf');
  const [template, setTemplate] = useState<ReportTemplate>('tax');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [dateError, setDateError] = useState('');

  const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

  const dates = useMemo(() => {
    if (range === 'custom') return { from: customFrom, to: customTo, label: `${customFrom} → ${customTo}` };
    return rangeDates(range);
  }, [range, customFrom, customTo]);

  const handleGenerate = async () => {
    // Validate custom date inputs before hitting the DB.
    if (range === 'custom') {
      if (!YMD_RE.test(customFrom) || !YMD_RE.test(customTo)) {
        setDateError('Dates must be in YYYY-MM-DD format (e.g. 2025-01-31).');
        return;
      }
      if (customFrom > customTo) {
        setDateError('"From" date must be on or before "To" date.');
        return;
      }
      setDateError('');
    }
    setLoading(true);
    try {
      const receipts = await getReceiptsInRange(dates.from, dates.to);
      if (receipts.length === 0) {
        Alert.alert('No receipts', 'No receipts found in the selected date range.');
        setLoading(false);
        return;
      }
      if (format === 'csv') {
        const filename = `tallyshot_${dates.from}_${dates.to}`;
        await shareCSV(receipts, filename);
        setLoading(false);
        return;
      }
      const uri = await generatePDF({
        receipts,
        template,
        dateRange: dates.label,
        currency,
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      router.push({
        pathname: '/preview',
        params: {
          uri,
          title: title.trim() || `${TEMPLATE_INFO[template].name} — ${dates.label}`,
          count: String(receipts.length),
          total: String(receipts.reduce((s, r) => s + r.total, 0)),
          deductible: String(receipts.filter((r) => r.is_tax_deductible).reduce((s, r) => s + r.total, 0)),
        },
      });
    } catch (err: any) {
      Alert.alert('Export failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const rangeOptions: { value: Range; label: string }[] = [
    { value: 'this_month', label: 'This month' },
    { value: 'last_month', label: 'Last month' },
    { value: 'this_quarter', label: 'This quarter' },
    { value: 'this_year', label: 'This year' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <ScrollView style={{ backgroundColor: t.background }} contentContainerStyle={styles.container}>
      {/* Date range */}
      <View>
        <Text style={[styles.sectionLabel, { color: t.textSubtle }]}>DATE RANGE</Text>
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {rangeOptions.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.pill,
                  {
                    backgroundColor: range === opt.value ? t.cta : t.surfaceElevated,
                    borderColor: range === opt.value ? t.cta : t.border,
                  },
                ]}
                onPress={() => setRange(opt.value)}
                activeOpacity={0.85}
              >
                <Text style={[styles.pillText, { color: range === opt.value ? t.ctaText : t.textMuted }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {range === 'custom' && (
            <View style={{ marginTop: 12 }}>
              <View style={styles.dateRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, { color: t.textMuted }]}>From</Text>
                  <TextInput
                    value={customFrom}
                    onChangeText={(v) => { setCustomFrom(v); setDateError(''); }}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={t.textSubtle}
                    keyboardType="numeric"
                    style={[
                      styles.input,
                      { backgroundColor: t.surfaceElevated, color: t.textPrimary,
                        borderColor: dateError ? t.danger : t.border },
                    ]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, { color: t.textMuted }]}>To</Text>
                  <TextInput
                    value={customTo}
                    onChangeText={(v) => { setCustomTo(v); setDateError(''); }}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={t.textSubtle}
                    keyboardType="numeric"
                    style={[
                      styles.input,
                      { backgroundColor: t.surfaceElevated, color: t.textPrimary,
                        borderColor: dateError ? t.danger : t.border },
                    ]}
                  />
                </View>
              </View>
              {dateError ? (
                <Text style={[styles.dateErrorText, { color: t.danger }]}>{dateError}</Text>
              ) : null}
            </View>
          )}

          <Text style={[styles.dateLabel, { color: t.textPrimary }]}>{dates.label}</Text>
        </View>
      </View>

      {/* Format toggle */}
      <View>
        <Text style={[styles.sectionLabel, { color: t.textSubtle }]}>FORMAT</Text>
        <View style={[styles.formatRow, { backgroundColor: t.surface, borderColor: t.border }]}>
          {(['pdf', 'csv'] as Format[]).map((fmt) => (
            <TouchableOpacity
              key={fmt}
              onPress={() => setFormat(fmt)}
              activeOpacity={0.85}
              style={[
                styles.formatBtn,
                format === fmt && { backgroundColor: t.surfaceElevated },
              ]}
            >
              <MaterialCommunityIcons
                name={fmt === 'pdf' ? 'file-pdf-box' : 'file-delimited'}
                size={18}
                color={format === fmt ? t.cta : t.textMuted}
              />
              <Text style={[styles.formatText, { color: format === fmt ? t.textPrimary : t.textMuted }]}>
                {fmt.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Template (PDF only) */}
      {format === 'pdf' && (
        <View>
          <Text style={[styles.sectionLabel, { color: t.textSubtle }]}>TEMPLATE</Text>
          <View style={{ gap: 8 }}>
            {(Object.keys(TEMPLATE_INFO) as ReportTemplate[]).map((key) => {
              const info = TEMPLATE_INFO[key];
              const active = template === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setTemplate(key)}
                  activeOpacity={0.85}
                  style={[
                    styles.templateRow,
                    {
                      backgroundColor: active ? t.accent + '14' : t.surface,
                      borderColor: active ? t.accent : t.border,
                    },
                  ]}
                >
                  <View style={[styles.templateIcon, { backgroundColor: active ? t.accent + '22' : t.surfaceElevated }]}>
                    <MaterialCommunityIcons name={info.icon as any} size={18} color={active ? t.accent : t.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.templateName, { color: t.textPrimary }, active && { color: t.accent }]}>
                      {info.name}
                    </Text>
                    <Text style={[styles.templateDesc, { color: t.textMuted }]}>{info.description}</Text>
                  </View>
                  {active && <MaterialCommunityIcons name="check-circle" size={20} color={t.accent} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Title + Notes (PDF only) */}
      {format === 'pdf' && (
        <View>
          <Text style={[styles.sectionLabel, { color: t.textSubtle }]}>CUSTOMISE (OPTIONAL)</Text>
          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, gap: 10 }]}>
            <View>
              <Text style={[styles.formLabel, { color: t.textMuted }]}>Report title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={`${TEMPLATE_INFO[template].name} — ${dates.label}`}
                placeholderTextColor={t.textSubtle}
                style={[styles.input, { backgroundColor: t.surfaceElevated, borderColor: t.border, color: t.textPrimary }]}
              />
            </View>
            <View>
              <Text style={[styles.formLabel, { color: t.textMuted }]}>Notes (shown on report)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional"
                placeholderTextColor={t.textSubtle}
                multiline
                numberOfLines={2}
                style={[styles.input, { backgroundColor: t.surfaceElevated, borderColor: t.border, color: t.textPrimary, minHeight: 60, textAlignVertical: 'top' }]}
              />
            </View>
          </View>
        </View>
      )}

      {/* Generate button */}
      <TouchableOpacity
        style={[styles.exportBtn, { backgroundColor: t.cta }, loading && { opacity: 0.6 }]}
        onPress={handleGenerate}
        disabled={loading}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name={format === 'pdf' ? 'eye' : 'export-variant'} size={20} color={t.ctaText} />
        <Text style={[styles.exportBtnText, { color: t.ctaText }]}>
          {loading ? 'Working...' : (format === 'pdf' ? 'Generate Preview' : 'Export & Share')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14, paddingBottom: 40 },
  sectionLabel: {
    fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 0.8,
    marginBottom: 8, marginLeft: 4,
  },
  card: { borderRadius: 14, borderWidth: 1, padding: 14 },

  pill: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1, minHeight: 36, justifyContent: 'center',
  },
  pillText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateErrorText: { fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 6, marginLeft: 2 },
  dateLabel: { fontFamily: 'Inter_700Bold', fontSize: 14, marginTop: 12, letterSpacing: -0.1 },

  formLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 0.4, marginBottom: 4, marginLeft: 2 },
  input: {
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: 'Inter_500Medium', fontSize: 14, minHeight: 44,
  },

  formatRow: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, padding: 4 },
  formatBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 9, minHeight: 44,
  },
  formatText: { fontFamily: 'Inter_700Bold', fontSize: 13 },

  templateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1.5, minHeight: 64,
  },
  templateIcon: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  templateName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  templateDesc: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2, lineHeight: 14 },

  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, padding: 16, marginTop: 8, minHeight: 52,
  },
  exportBtnText: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.2 },
});
