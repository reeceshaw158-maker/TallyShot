import { View, ScrollView, StyleSheet, Alert, TouchableOpacity, StatusBar, Switch } from 'react-native';
import { Text, ProgressBar } from 'react-native-paper';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore, FREE_SCAN_LIMIT } from '../../src/stores/appStore';
import { clearAllUserData } from '../../src/db/receipts';
import { useThemeTokens, SemanticTokens, useActiveScheme } from '../../src/theme';
import { REGION_PRESETS, REGION_ORDER, Region, TaxMode } from '../../src/types';
import { openManageSubscription } from '../../src/services/subscription';
import { SummaryMode, PhotoMode } from '../../src/stores/appStore';

const CURRENCIES = ['GBP', 'USD', 'EUR', 'AUD', 'NZD', 'CAD', 'JPY'];
const THEMES: { value: 'light' | 'dark' | 'system'; label: string; icon: string }[] = [
  { value: 'system', label: 'System default', icon: 'theme-light-dark' },
  { value: 'dark', label: 'Dark', icon: 'weather-night' },
  { value: 'light', label: 'Light', icon: 'weather-sunny' },
];

export default function SettingsScreen() {
  const t = useThemeTokens();
  const scheme = useActiveScheme();

  const isPro = useAppStore((s) => s.isPro);
  const scansUsedThisMonth = useAppStore((s) => s.scansUsedThisMonth);
  const currency = useAppStore((s) => s.currency);
  const themeMode = useAppStore((s) => s.theme);
  const quickScan = useAppStore((s) => s.quickScan);
  const region = useAppStore((s) => s.region);
  const taxMode = useAppStore((s) => s.taxMode);
  const taxLabel = useAppStore((s) => s.taxLabel);
  const summaryMode = useAppStore((s) => s.summaryMode);
  const photoMode = useAppStore((s) => s.photoMode);
  const setTheme = useAppStore((s) => s.setTheme);
  const setCurrency = useAppStore((s) => s.setCurrency);
  const setQuickScan = useAppStore((s) => s.setQuickScan);
  const setRegion = useAppStore((s) => s.setRegion);
  const setTaxMode = useAppStore((s) => s.setTaxMode);
  const setSummaryMode = useAppStore((s) => s.setSummaryMode);
  const setPhotoMode = useAppStore((s) => s.setPhotoMode);
  const scanProgress = Math.min(scansUsedThisMonth / FREE_SCAN_LIMIT, 1);
  const scansRemaining = Math.max(0, FREE_SCAN_LIMIT - scansUsedThisMonth);

  const handleDeleteAll = () => {
    Alert.alert(
      'Delete all data?',
      'This will permanently delete every receipt and photo. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Are you sure?', 'Last chance.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Yes, delete',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await clearAllUserData();
                    Alert.alert('Done', 'All your receipt data has been deleted.');
                  } catch (err: any) {
                    Alert.alert('Error', err?.message ?? 'Could not delete data.');
                  }
                },
              },
            ]);
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={{ backgroundColor: t.background }} contentContainerStyle={styles.container}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />

      <Text style={[styles.pageTitle, { color: t.textPrimary }]}>Settings</Text>

      {/* Plan card */}
      {!isPro ? (
        <View style={[styles.planCard, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={[styles.planHeader, { backgroundColor: t.surfaceElevated }]}>
            <Text style={[styles.planTitle, { color: t.textPrimary }]}>Free plan</Text>
            <Text style={[styles.planMeta, { color: t.textMuted }]}>
              {scansRemaining} of {FREE_SCAN_LIMIT} AI scans left this month
            </Text>
          </View>
          <View style={{ padding: 16 }}>
            <ProgressBar progress={scanProgress} color={t.cta} style={styles.progressBar} />
            <Text style={[styles.planHint, { color: t.textMuted }]}>
              Manual entry stays unlimited and free. No ads. No tracking. Ever.
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.planCard, { backgroundColor: t.deductibleBg, borderColor: t.deductible + '55' }]}>
          <View style={styles.proRow}>
            <MaterialCommunityIcons name="check-decagram" size={22} color={t.deductible} />
            <View>
              <Text style={[styles.proTitle, { color: t.deductible }]}>PRO</Text>
              <Text style={[styles.proSub, { color: t.textPrimary }]}>Unlimited AI scans</Text>
            </View>
          </View>
        </View>
      )}

      {/* Subscription — honest one-tap cancel via Play deep link.
          Visible to everyone, not just paid users: the deep link handles
          "no active subscription" gracefully and we'd rather pre-bake the
          pattern than retrofit it later. */}
      <Section tokens={t} title="SUBSCRIPTION">
        <TouchableOpacity
          onPress={() => openManageSubscription()}
          activeOpacity={0.7}
          style={styles.navRow}
        >
          <View style={[styles.optionIcon, { backgroundColor: t.surfaceElevated }]}>
            <MaterialCommunityIcons name="open-in-new" size={18} color={t.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.navTitle, { color: t.textPrimary }]}>Cancel subscription</Text>
            <Text style={[styles.navSub, { color: t.textMuted }]}>
              Opens your Google Play subscriptions. One tap. No retention pop-up, no questions.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={t.textSubtle} />
        </TouchableOpacity>
      </Section>

      {/* Region */}
      <Section tokens={t} title="REGION">
        {REGION_ORDER.map((r, i) => {
          const preset = REGION_PRESETS[r];
          const selected = region === r;
          return (
            <TouchableOpacity
              key={r}
              onPress={() => setRegion(r)}
              activeOpacity={0.7}
              style={[
                styles.regionRow,
                i < REGION_ORDER.length - 1 && {
                  borderBottomColor: t.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <Text style={styles.regionFlag}>{preset.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.regionName, { color: t.textPrimary }]}>{preset.name}</Text>
                <Text style={[styles.regionSub, { color: t.textMuted }]}>
                  {preset.currency} · {preset.taxLabel} {preset.taxMode}
                </Text>
              </View>
              {selected && <MaterialCommunityIcons name="check" size={20} color={t.accent} />}
            </TouchableOpacity>
          );
        })}
      </Section>

      {/* Tax mode override */}
      <Section tokens={t} title="TAX MODE">
        {(['inclusive', 'exclusive'] as TaxMode[]).map((mode, i) => (
          <OptionRow
            key={mode}
            tokens={t}
            icon={mode === 'inclusive' ? 'package-variant' : 'plus-box-outline'}
            label={mode === 'inclusive' ? `${taxLabel} included in total` : `${taxLabel} added on top`}
            selected={taxMode === mode}
            onPress={() => setTaxMode(mode)}
            isLast={i === 1}
          />
        ))}
      </Section>

      {/* Capture */}
      <Section tokens={t} title="CAPTURE">
        <ToggleRow
          tokens={t}
          icon="lightning-bolt"
          title="Quick Scan"
          subtitle="Save automatically when AI extraction is confident. Uncertain scans still go to Review."
          value={quickScan}
          onValueChange={setQuickScan}
        />
        <View style={[styles.divider, { backgroundColor: t.border }]} />
        <View style={styles.subSection}>
          <Text style={[styles.subSectionLabel, { color: t.textSubtle }]}>Photo mode</Text>
          {([
            { value: 'original' as PhotoMode, label: 'Original', icon: 'image-outline',
              sub: 'Recommended. No filters or auto-adjust — best OCR on thermal-paper receipts.' },
            { value: 'enhanced' as PhotoMode, label: 'Enhanced', icon: 'auto-fix',
              sub: 'Saves photos at higher quality so the AI sees more detail. Slightly larger uploads.' },
          ]).map((opt, i, arr) => {
            const selected = photoMode === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setPhotoMode(opt.value)}
                activeOpacity={0.7}
                style={[
                  styles.modeRow,
                  i < arr.length - 1 && { borderBottomColor: t.border, borderBottomWidth: StyleSheet.hairlineWidth },
                ]}
              >
                <View style={[styles.optionIcon, { backgroundColor: t.surfaceElevated }]}>
                  <MaterialCommunityIcons name={opt.icon as any} size={18} color={selected ? t.accent : t.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modeTitle, { color: t.textPrimary }]}>{opt.label}</Text>
                  <Text style={[styles.modeSub, { color: t.textMuted }]}>{opt.sub}</Text>
                </View>
                {selected && <MaterialCommunityIcons name="check" size={20} color={t.accent} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </Section>

      {/* Display — net/VAT/gross summary mode */}
      <Section tokens={t} title="DISPLAY">
        {([
          { value: 'lineItems' as SummaryMode, label: 'Show line items', icon: 'format-list-bulleted',
            sub: 'Default. See every item from each receipt.' },
          { value: 'totals' as SummaryMode, label: 'Net / VAT / Gross only', icon: 'calculator-variant-outline',
            sub: `The three numbers you need to file: net, ${taxLabel.toLowerCase()}, gross. Line items still saved and exported.` },
        ]).map((opt, i, arr) => {
          const selected = summaryMode === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setSummaryMode(opt.value)}
              activeOpacity={0.7}
              style={[
                styles.modeRow,
                i < arr.length - 1 && { borderBottomColor: t.border, borderBottomWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <View style={[styles.optionIcon, { backgroundColor: t.surfaceElevated }]}>
                <MaterialCommunityIcons name={opt.icon as any} size={18} color={selected ? t.accent : t.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modeTitle, { color: t.textPrimary }]}>{opt.label}</Text>
                <Text style={[styles.modeSub, { color: t.textMuted }]}>{opt.sub}</Text>
              </View>
              {selected && <MaterialCommunityIcons name="check" size={20} color={t.accent} />}
            </TouchableOpacity>
          );
        })}
      </Section>

      {/* Appearance */}
      <Section tokens={t} title="APPEARANCE">
        {THEMES.map((opt, i) => (
          <OptionRow
            key={opt.value}
            tokens={t}
            icon={opt.icon}
            label={opt.label}
            selected={themeMode === opt.value}
            onPress={() => setTheme(opt.value)}
            isLast={i === THEMES.length - 1}
          />
        ))}
      </Section>

      {/* Currency */}
      <Section tokens={t} title="DEFAULT CURRENCY">
        {CURRENCIES.map((c, i) => (
          <OptionRow
            key={c}
            tokens={t}
            icon="currency-usd"
            label={c}
            selected={currency === c}
            onPress={() => setCurrency(c)}
            isLast={i === CURRENCIES.length - 1}
          />
        ))}
      </Section>

      {/* Export */}
      <Section tokens={t}>
        <NavRow
          tokens={t}
          icon="export-variant"
          title="Export receipts"
          subtitle="Generate CSV or PDF report"
          onPress={() => router.push('/export')}
        />
      </Section>

      {/* Archived */}
      <Section tokens={t}>
        <NavRow
          tokens={t}
          icon="archive-outline"
          title="Archived receipts"
          subtitle="View, restore, or permanently delete archived receipts"
          onPress={() => router.push('/archived')}
        />
      </Section>

      {/* Privacy */}
      <Section tokens={t} title="PRIVACY & DATA">
        <View style={styles.privacyBody}>
          <PrivacyLine tokens={t} icon="shield-check-outline" text="Receipts and photos stay on your device. Nothing syncs anywhere." />
          <PrivacyLine tokens={t} icon="cloud-off-outline" text="Receipt photos go to our AI proxy for extraction only — never logged or saved." />
          <PrivacyLine tokens={t} icon="cancel" text="No ads. No tracking. No analytics SDKs." />
          <PrivacyLine tokens={t} icon="account-off-outline" text="No account required." />
        </View>
      </Section>

      {/* Danger zone */}
      <View style={[styles.dangerCard, { backgroundColor: t.dangerBg, borderColor: t.danger + '55' }]}>
        <TouchableOpacity onPress={handleDeleteAll} style={styles.dangerRow} activeOpacity={0.7}>
          <MaterialCommunityIcons name="delete-forever" size={22} color={t.danger} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.dangerTitle, { color: t.danger }]}>Delete all data</Text>
            <Text style={[styles.dangerSub, { color: t.textPrimary }]}>
              Permanently remove every receipt and photo
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={t.danger} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ── components ───────────────────────────────────────────────────────────

function Section({ tokens, title, children }: { tokens: SemanticTokens; title?: string; children: React.ReactNode }) {
  return (
    <View>
      {title && <Text style={[styles.sectionLabel, { color: tokens.textSubtle }]}>{title}</Text>}
      <View style={[styles.sectionCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
        {children}
      </View>
    </View>
  );
}

function OptionRow({
  tokens, icon, label, selected, onPress, isLast,
}: {
  tokens: SemanticTokens; icon: string; label: string; selected: boolean; onPress: () => void; isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.optionRow,
        !isLast && { borderBottomColor: tokens.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <View style={[styles.optionIcon, { backgroundColor: tokens.surfaceElevated }]}>
        <MaterialCommunityIcons name={icon as any} size={18} color={tokens.textMuted} />
      </View>
      <Text style={[styles.optionLabel, { color: tokens.textPrimary }]}>{label}</Text>
      {selected && <MaterialCommunityIcons name="check" size={20} color={tokens.accent} />}
    </TouchableOpacity>
  );
}

function ToggleRow({
  tokens, icon, title, subtitle, value, onValueChange,
}: {
  tokens: SemanticTokens; icon: string; title: string; subtitle: string; value: boolean; onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={[styles.optionIcon, { backgroundColor: tokens.surfaceElevated }]}>
        <MaterialCommunityIcons name={icon as any} size={18} color={tokens.cta} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.toggleTitle, { color: tokens.textPrimary }]}>{title}</Text>
        <Text style={[styles.toggleSub, { color: tokens.textMuted }]}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: tokens.surfaceElevated, true: tokens.accent }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

function NavRow({
  tokens, icon, title, subtitle, onPress,
}: {
  tokens: SemanticTokens; icon: string; title: string; subtitle?: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.navRow}>
      <View style={[styles.optionIcon, { backgroundColor: tokens.surfaceElevated }]}>
        <MaterialCommunityIcons name={icon as any} size={18} color={tokens.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.navTitle, { color: tokens.textPrimary }]}>{title}</Text>
        {subtitle && <Text style={[styles.navSub, { color: tokens.textMuted }]}>{subtitle}</Text>}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={tokens.textSubtle} />
    </TouchableOpacity>
  );
}

function PrivacyLine({ tokens, icon, text }: { tokens: SemanticTokens; icon: string; text: string }) {
  return (
    <View style={styles.privacyLine}>
      <MaterialCommunityIcons name={icon as any} size={16} color={tokens.accent} />
      <Text style={[styles.privacyText, { color: tokens.textMuted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14, paddingBottom: 40, paddingTop: 56 },
  pageTitle: { fontFamily: 'Inter_800ExtraBold', fontSize: 28, letterSpacing: -0.5, marginBottom: 4 },

  planCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  planHeader: { padding: 16, paddingBottom: 12 },
  planTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.2 },
  planMeta: { fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 4 },
  progressBar: { height: 6, borderRadius: 3, marginTop: 4 },
  planHint: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 10, lineHeight: 17 },
  proRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  proTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, letterSpacing: 0.4 },
  proSub: { fontFamily: 'Inter_500Medium', fontSize: 14, marginTop: 2 },

  sectionLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  sectionCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },

  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 52 },
  optionIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14 },

  regionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, minHeight: 56 },
  regionFlag: { fontSize: 24 },
  regionName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  regionSub: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  toggleTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginBottom: 2 },
  toggleSub: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 },

  divider: { height: StyleSheet.hairlineWidth, width: '100%' },
  subSection: { paddingTop: 12 },
  subSectionLabel: {
    fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 0.8,
    marginLeft: 16, marginBottom: 4,
  },
  modeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, minHeight: 56,
  },
  modeTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginBottom: 2 },
  modeSub: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 },

  navRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, minHeight: 56 },
  navTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginBottom: 2 },
  navSub: { fontFamily: 'Inter_400Regular', fontSize: 12 },

  privacyBody: { padding: 16, gap: 10 },
  privacyLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  privacyText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, flex: 1 },

  dangerCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  dangerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 56 },
  dangerTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, marginBottom: 2 },
  dangerSub: { fontFamily: 'Inter_400Regular', fontSize: 12 },
});
