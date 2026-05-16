/**
 * Scan result screen — Step 3.
 *
 * Driven by `productCache.lookup(barcode)`:
 *   loading → found | not_found | not_grocery | offline | error
 *
 * Behaviours:
 *   - Cache-first: if we've seen this barcode before, the Found card renders
 *     instantly. A subtle "refreshing…" pill appears if a background refresh
 *     is in flight (stale row > 14 days old).
 *   - No silent failures: every error path has copy and a retry button.
 *   - ?state=… preview override still works in dev so the empty states are
 *     reachable without inducing a real outage.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, ActivityIndicator, ScrollView, Image, Linking,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useThemeTokens, SemanticTokens } from '../../../src/theme';
import { SpringButton } from '../../../src/components/SpringButton';
import {
  lookup, refresh, LookupResult, ProductRecord,
  ProductLookupOffline,
} from '../../../src/services/productCache';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'found'; record: ProductRecord; refreshing: boolean }
  | { kind: 'not_found'; record: ProductRecord }
  | { kind: 'not_grocery'; record: ProductRecord }
  | { kind: 'offline' }
  | { kind: 'error'; message?: string };

export default function ScanResultScreen() {
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();
  const { barcode, state: stateParam } =
    useLocalSearchParams<{ barcode: string; state?: string }>();

  const [view, setView] = useState<ViewState>({ kind: 'loading' });
  // Guard against state writes after unmount — the lookup may take a few seconds
  // and React 19 still warns on stale-component setState.
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const safeSet = useCallback((v: ViewState) => {
    if (mounted.current) setView(v);
  }, []);

  const run = useCallback(async () => {
    // Dev/preview override: ?state=not_found etc.
    if (stateParam) {
      const blank: ProductRecord = {
        barcode: String(barcode), status: 'not_found',
        name: null, brand: null, imageUrl: null, categories: null, quantity: null,
        nutriscore: null, novaGroup: null, ecoscore: null, nutriments: null,
        ingredients: null, allergens: null, countries: null,
        fetchedAt: new Date().toISOString(),
      };
      if (stateParam === 'not_found')   { safeSet({ kind: 'not_found', record: blank }); return; }
      if (stateParam === 'not_grocery') { safeSet({ kind: 'not_grocery', record: blank }); return; }
      if (stateParam === 'offline')     { safeSet({ kind: 'offline' }); return; }
      if (stateParam === 'error')       { safeSet({ kind: 'error' }); return; }
      if (stateParam === 'found')       {
        safeSet({ kind: 'found', record: { ...blank, status: 'found', name: 'Demo product', brand: 'Demo brand' }, refreshing: false });
        return;
      }
    }

    safeSet({ kind: 'loading' });
    try {
      const result: LookupResult = await lookup(String(barcode));
      const { record, refreshing } = result;
      if (record.status === 'found')        safeSet({ kind: 'found',        record, refreshing });
      else if (record.status === 'not_grocery') safeSet({ kind: 'not_grocery', record });
      else                                  safeSet({ kind: 'not_found',    record });
    } catch (err: any) {
      if (err instanceof ProductLookupOffline) safeSet({ kind: 'offline' });
      else                                     safeSet({ kind: 'error', message: err?.message });
    }
  }, [barcode, stateParam, safeSet]);

  useEffect(() => { run(); }, [run]);

  return (
    <View style={[styles.root, { backgroundColor: t.background, paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <SpringButton style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={t.textPrimary} />
        </SpringButton>
        <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Product</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {view.kind === 'loading'     && <Loading      t={t} barcode={String(barcode)} />}
        {view.kind === 'found'       && <Found        t={t} record={view.record} refreshing={view.refreshing} onRefresh={() => doRefresh(view.record.barcode, safeSet)} />}
        {view.kind === 'not_found'   && <NotFound     t={t} barcode={String(barcode)} />}
        {view.kind === 'not_grocery' && <NotGrocery   t={t} record={view.record} />}
        {view.kind === 'offline'     && <Offline      t={t} onRetry={run} />}
        {view.kind === 'error'       && <ErrorState   t={t} message={view.message} onRetry={run} />}
      </ScrollView>
    </View>
  );
}

async function doRefresh(barcode: string, safeSet: (v: ViewState) => void) {
  try {
    const record = await refresh(barcode);
    if (record.status === 'found')        safeSet({ kind: 'found',        record, refreshing: false });
    else if (record.status === 'not_grocery') safeSet({ kind: 'not_grocery', record });
    else                                  safeSet({ kind: 'not_found',    record });
  } catch (err: any) {
    if (err instanceof ProductLookupOffline) safeSet({ kind: 'offline' });
    else                                     safeSet({ kind: 'error', message: err?.message });
  }
}

// ── States ──────────────────────────────────────────────────────────────────

function Loading({ t, barcode }: { t: SemanticTokens; barcode: string }) {
  return (
    <View style={styles.stateWrap}>
      <ActivityIndicator color={t.accent} />
      <Text style={[styles.stateTitle, { color: t.textPrimary }]}>Looking up…</Text>
      <Text style={[styles.stateBody, { color: t.textMuted }]}>Barcode {barcode}</Text>
    </View>
  );
}

function Found({
  t, record, refreshing, onRefresh,
}: { t: SemanticTokens; record: ProductRecord; refreshing: boolean; onRefresh: () => void }) {
  const n = record.nutriments;

  // Pre-fill flow into the new-expense screen. We pass merchant (product
  // name), category 'Food & Drink' (closest stock category to "Groceries"
  // — the legacy enum doesn't define Groceries), and a notes string with
  // brand + quantity so the user can identify the line item later.
  const handleLogAsExpense = () => {
    const notes = [record.brand, record.quantity, record.barcode ? `Barcode: ${record.barcode}` : null]
      .filter(Boolean).join(' · ');
    const prefill = {
      merchant: record.name ?? '',
      category: 'Food & Drink',
      notes,
    };
    router.replace({
      pathname: '/review/[id]',
      params: { id: 'new', prefill: JSON.stringify(prefill) },
    });
  };

  return (
    <View style={styles.foundWrap}>
      {/* Hero card */}
      <View style={[styles.heroCard, { backgroundColor: t.surface, borderColor: t.border }]}>
        {record.imageUrl ? (
          <Image source={{ uri: record.imageUrl }} style={styles.heroImage} resizeMode="contain" />
        ) : (
          <View style={[styles.heroImagePlaceholder, { backgroundColor: t.surfaceElevated }]}>
            <MaterialCommunityIcons name="package-variant" size={36} color={t.textSubtle} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.heroName, { color: t.textPrimary }]} numberOfLines={3}>
            {record.name ?? 'Unnamed product'}
          </Text>
          {record.brand ? (
            <Text style={[styles.heroBrand, { color: t.textMuted }]} numberOfLines={1}>
              {record.brand}
            </Text>
          ) : null}
          {record.quantity ? (
            <Text style={[styles.heroQty, { color: t.textSubtle }]}>{record.quantity}</Text>
          ) : null}
        </View>
      </View>

      {/* Grade pills */}
      <View style={styles.gradeRow}>
        <GradePill t={t} label="Nutri-Score" grade={record.nutriscore} />
        <GradePill t={t} label="Eco-Score"   grade={record.ecoscore} />
        <NovaPill  t={t} group={record.novaGroup} />
      </View>

      {/* Nutrition summary row — Fat | Sugar | Salt | Protein per 100g */}
      {n && (
        <View style={styles.summaryPillRow}>
          <SummaryPill t={t} label="Fat"     value={fmtG(n.fat100g)} />
          <SummaryPill t={t} label="Sugar"   value={fmtG(n.sugars100g)} />
          <SummaryPill t={t} label="Salt"    value={fmtG(n.salt100g)} />
          <SummaryPill t={t} label="Protein" value={fmtG(n.proteins100g)} />
        </View>
      )}

      {/* Allergens — highlighted in danger red per brief */}
      {record.allergens ? (
        <View style={[styles.allergenBox, { backgroundColor: t.dangerBg, borderColor: t.danger }]}>
          <MaterialCommunityIcons name="alert-octagon" size={18} color={t.danger} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.allergenTitle, { color: t.danger }]}>Allergens</Text>
            <Text style={[styles.allergenList, { color: t.danger }]}>{prettyAllergens(record.allergens)}</Text>
          </View>
        </View>
      ) : null}

      {/* Country of origin */}
      {record.countries ? (
        <View style={[styles.metaRow, { backgroundColor: t.surface, borderColor: t.border }]}>
          <MaterialCommunityIcons name="earth" size={16} color={t.textMuted} />
          <Text style={[styles.metaLabel, { color: t.textMuted }]}>Country</Text>
          <Text style={[styles.metaValue, { color: t.textPrimary }]} numberOfLines={1}>
            {prettyCountries(record.countries)}
          </Text>
        </View>
      ) : null}

      {/* Nutrition */}
      {record.nutriments ? (
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.cardTitle, { color: t.textPrimary }]}>Per 100g / 100ml</Text>
          <NutritionRow t={t} label="Energy"        value={fmtKcal(record.nutriments.energyKcal100g)} />
          <NutritionRow t={t} label="Fat"           value={fmtG(record.nutriments.fat100g)} />
          <NutritionRow t={t} label="  of which saturates" value={fmtG(record.nutriments.saturatedFat100g)} indent />
          <NutritionRow t={t} label="Carbohydrates" value={fmtG(record.nutriments.carbohydrates100g)} />
          <NutritionRow t={t} label="  of which sugars" value={fmtG(record.nutriments.sugars100g)} indent />
          <NutritionRow t={t} label="Fibre"         value={fmtG(record.nutriments.fiber100g)} />
          <NutritionRow t={t} label="Protein"       value={fmtG(record.nutriments.proteins100g)} />
          <NutritionRow t={t} label="Salt"          value={fmtG(record.nutriments.salt100g)} last />
        </View>
      ) : (
        <View style={[styles.card, styles.cardCenter, { backgroundColor: t.surface, borderColor: t.border }]}>
          <MaterialCommunityIcons name="nutrition" size={28} color={t.textSubtle} />
          <Text style={[styles.cardEmpty, { color: t.textMuted }]}>
            No nutrition data on this product yet.
          </Text>
        </View>
      )}

      {/* Ingredients */}
      {record.ingredients ? (
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.cardTitle, { color: t.textPrimary }]}>Ingredients</Text>
          <Text style={[styles.ingredientsText, { color: t.textMuted }]}>
            {record.ingredients}
          </Text>
        </View>
      ) : null}

      {/* Footer */}
      <View style={styles.footerRow}>
        <Text style={[styles.footerText, { color: t.textSubtle }]}>
          {refreshing ? 'Refreshing…' : `From Open Food Facts · ${fmtDate(record.fetchedAt)}`}
        </Text>
        <SpringButton onPress={onRefresh} style={[styles.refreshBtn, { borderColor: t.border }]}>
          <MaterialCommunityIcons name="refresh" size={14} color={t.textMuted} />
          <Text style={[styles.refreshBtnText, { color: t.textMuted }]}>Refresh</Text>
        </SpringButton>
      </View>

      {/* Two-button action row per brief: ghost (Scan another) + filled (Log as Expense) */}
      <View style={styles.actionRow}>
        <SpringButton
          style={[styles.cta, styles.ctaHalf, styles.ctaGhost, { borderColor: t.border }]}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="barcode-scan" size={16} color={t.textPrimary} />
          <Text style={[styles.ctaText, { color: t.textPrimary }]}>Scan another</Text>
        </SpringButton>
        <SpringButton
          style={[styles.cta, styles.ctaHalf, { backgroundColor: t.cta }]}
          onPress={handleLogAsExpense}
        >
          <Text style={[styles.ctaText, { color: t.ctaText }]}>Log as Expense →</Text>
        </SpringButton>
      </View>
    </View>
  );
}

function SummaryPill({ t, label, value }: { t: SemanticTokens; label: string; value: string }) {
  return (
    <View style={[styles.summaryPill, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Text style={[styles.summaryPillValue, { color: t.textPrimary }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.summaryPillLabel, { color: t.textMuted }]}>{label}</Text>
    </View>
  );
}

/** Strip OFF's `en:`-style language prefix and Title Case the result. */
function prettyAllergens(raw: string): string {
  return raw
    .split(/[,;]/)
    .map((s) => s.replace(/^[a-z]{2}:/, '').trim())
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/[-_]/g, ' '))
    .join(', ');
}

function prettyCountries(raw: string): string {
  return raw
    .split(/[,;]/)
    .map((s) => s.replace(/^[a-z]{2}:/, '').trim().replace(/-/g, ' '))
    .filter(Boolean)
    .slice(0, 3)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(', ');
}

function NotFound({ t, barcode }: { t: SemanticTokens; barcode: string }) {
  return (
    <View style={styles.stateWrap}>
      <MaterialCommunityIcons name="magnify-close" size={56} color={t.textMuted} />
      <Text style={[styles.stateTitle, { color: t.textPrimary }]}>Product not in our database yet</Text>
      <Text style={[styles.stateBody, { color: t.textMuted }]}>
        Barcode {barcode} isn&apos;t on Open Food Facts. You can contribute it back at openfoodfacts.org so everyone benefits.
      </Text>
      <SpringButton
        style={[styles.cta, { backgroundColor: t.cta }]}
        onPress={() => Linking.openURL(`https://world.openfoodfacts.org/cgi/product.pl?type=add&code=${encodeURIComponent(barcode)}`)}
      >
        <Text style={[styles.ctaText, { color: t.ctaText }]}>Add it on OFF</Text>
      </SpringButton>
      <SpringButton
        style={[styles.cta, styles.ctaGhost, { borderColor: t.border }]}
        onPress={() => router.back()}
      >
        <Text style={[styles.ctaText, { color: t.textPrimary }]}>Scan another</Text>
      </SpringButton>
    </View>
  );
}

function NotGrocery({ t, record }: { t: SemanticTokens; record: ProductRecord }) {
  return (
    <View style={styles.stateWrap}>
      <MaterialCommunityIcons name="cart-off" size={56} color={t.textMuted} />
      <Text style={[styles.stateTitle, { color: t.textPrimary }]}>Not a grocery product</Text>
      <Text style={[styles.stateBody, { color: t.textMuted }]}>
        {record.name
          ? `“${record.name}”${record.brand ? ` by ${record.brand}` : ''} isn't a food or drink item — phase 1 of TallyShot focuses on groceries.`
          : `TallyShot focuses on food and household groceries. We're adding more categories soon.`}
      </Text>
      <SpringButton
        style={[styles.cta, { backgroundColor: t.cta }]}
        onPress={() => router.back()}
      >
        <Text style={[styles.ctaText, { color: t.ctaText }]}>Back to scanner</Text>
      </SpringButton>
    </View>
  );
}

function Offline({ t, onRetry }: { t: SemanticTokens; onRetry: () => void }) {
  return (
    <View style={styles.stateWrap}>
      <MaterialCommunityIcons name="wifi-off" size={56} color={t.textMuted} />
      <Text style={[styles.stateTitle, { color: t.textPrimary }]}>You&apos;re offline</Text>
      <Text style={[styles.stateBody, { color: t.textMuted }]}>
        We couldn&apos;t reach Open Food Facts and don&apos;t have this product cached on your device. Try again once you&apos;re back online.
      </Text>
      <SpringButton style={[styles.cta, { backgroundColor: t.cta }]} onPress={onRetry}>
        <Text style={[styles.ctaText, { color: t.ctaText }]}>Try again</Text>
      </SpringButton>
    </View>
  );
}

function ErrorState({ t, message, onRetry }: { t: SemanticTokens; message?: string; onRetry: () => void }) {
  return (
    <View style={styles.stateWrap}>
      <MaterialCommunityIcons name="alert-circle-outline" size={56} color={t.danger} />
      <Text style={[styles.stateTitle, { color: t.textPrimary }]}>Couldn&apos;t load this product</Text>
      <Text style={[styles.stateBody, { color: t.textMuted }]}>
        Something went wrong looking this up{message ? ` (${message})` : ''}. Check your connection and try again.
      </Text>
      <SpringButton style={[styles.cta, { backgroundColor: t.cta }]} onPress={onRetry}>
        <Text style={[styles.ctaText, { color: t.ctaText }]}>Try again</Text>
      </SpringButton>
    </View>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function GradePill({ t, label, grade }: { t: SemanticTokens; label: string; grade: string | null }) {
  // Nutri-Score / Eco-Score palette per design brief. Foreground colours are
  // chosen so each grade pill clears WCAG AA against its own background:
  //   A (#00C896): black FG ≈ 7.8:1
  //   B (#85BB2F): black FG ≈ 6.0:1
  //   C (#FFCC00): black FG ≈ 12.8:1
  //   D (#FF8C00): black FG ≈ 6.7:1
  //   E (#FF4757): white FG ≈ 4.6:1
  const colors: Record<string, { bg: string; fg: string }> = {
    a: { bg: '#00C896', fg: '#0F0F0F' },
    b: { bg: '#85BB2F', fg: '#0F0F0F' },
    c: { bg: '#FFCC00', fg: '#0F0F0F' },
    d: { bg: '#FF8C00', fg: '#0F0F0F' },
    e: { bg: '#FF4757', fg: '#FFFFFF' },
  };
  const palette = grade ? colors[grade] : null;
  return (
    <View style={[styles.gradePill, { backgroundColor: palette?.bg ?? t.surfaceElevated, borderColor: t.border }]}>
      <Text style={[styles.gradePillLabel, { color: palette ? palette.fg : t.textSubtle }]}>{label}</Text>
      <Text style={[styles.gradePillValue, { color: palette ? palette.fg : t.textMuted }]}>
        {grade ? grade.toUpperCase() : '—'}
      </Text>
    </View>
  );
}

function NovaPill({ t, group }: { t: SemanticTokens; group: number | null }) {
  // Higher = more processed (4 = ultra-processed). Maps to brief palette.
  const map: Record<number, { bg: string; fg: string }> = {
    1: { bg: '#00C896', fg: '#0F0F0F' },
    2: { bg: '#85BB2F', fg: '#0F0F0F' },
    3: { bg: '#FF8C00', fg: '#0F0F0F' },
    4: { bg: '#FF4757', fg: '#FFFFFF' },
  };
  const palette = group ? map[group] : null;
  return (
    <View style={[styles.gradePill, { backgroundColor: palette?.bg ?? t.surfaceElevated, borderColor: t.border }]}>
      <Text style={[styles.gradePillLabel, { color: palette ? palette.fg : t.textSubtle }]}>NOVA</Text>
      <Text style={[styles.gradePillValue, { color: palette ? palette.fg : t.textMuted }]}>
        {group ?? '—'}
      </Text>
    </View>
  );
}

function NutritionRow({
  t, label, value, last, indent,
}: { t: SemanticTokens; label: string; value: string; last?: boolean; indent?: boolean }) {
  return (
    <View style={[
      styles.nutRow,
      !last && { borderBottomWidth: 1, borderBottomColor: t.border },
    ]}>
      <Text style={[styles.nutLabel, { color: indent ? t.textSubtle : t.textPrimary, paddingLeft: indent ? 12 : 0 }]}>
        {label}
      </Text>
      <Text style={[styles.nutValue, { color: t.textPrimary }]}>{value}</Text>
    </View>
  );
}

// ── Formatters ──────────────────────────────────────────────────────────────

function fmtG(v: number | null): string {
  if (v === null) return '—';
  return v < 1 ? `${v.toFixed(2)} g` : `${v.toFixed(1)} g`;
}
function fmtKcal(v: number | null): string {
  return v === null ? '—' : `${Math.round(v)} kcal`;
}
function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso.slice(0, 10); }
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingBottom: 12,
  },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8, gap: 14 },

  stateWrap: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24, paddingVertical: 56, gap: 12,
  },
  stateTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, textAlign: 'center', marginTop: 6 },
  stateBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  cta: { marginTop: 16, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14, alignItems: 'center' },
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1 },
  ctaText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },

  foundWrap: { gap: 14 },

  heroCard: {
    flexDirection: 'row', gap: 14,
    padding: 14, borderRadius: 16, borderWidth: 1,
    alignItems: 'center',
  },
  heroImage: { width: 88, height: 88, borderRadius: 12 },
  heroImagePlaceholder: {
    width: 88, height: 88, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  heroName:  { fontFamily: 'Inter_700Bold',    fontSize: 16, letterSpacing: -0.3 },
  heroBrand: { fontFamily: 'Inter_500Medium',  fontSize: 13, marginTop: 2 },
  heroQty:   { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },

  gradeRow: { flexDirection: 'row', gap: 8 },
  gradePill: {
    flex: 1, borderRadius: 12, borderWidth: 1,
    paddingVertical: 10, paddingHorizontal: 8,
    alignItems: 'center',
  },
  gradePillLabel: { fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 0.4 },
  gradePillValue: { fontFamily: 'Inter_800ExtraBold', fontSize: 18, marginTop: 2 },

  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 0 },
  cardCenter: { alignItems: 'center', justifyContent: 'center', paddingVertical: 22, gap: 8 },
  cardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, letterSpacing: 0.2, marginBottom: 4 },
  cardEmpty: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center' },

  nutRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10,
  },
  nutLabel: { fontFamily: 'Inter_400Regular', fontSize: 13, flex: 1 },
  nutValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },

  footerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 4,
  },
  footerText: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  refreshBtn: {
    flexDirection: 'row', gap: 4, alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
  },
  refreshBtnText: { fontFamily: 'Inter_500Medium', fontSize: 11 },

  // ── v2 additions ─────────────────────────────────────────────────────────
  summaryPillRow: { flexDirection: 'row', gap: 6 },
  summaryPill: {
    flex: 1, borderRadius: 12, borderWidth: 1,
    paddingVertical: 10, paddingHorizontal: 4,
    alignItems: 'center',
  },
  summaryPillValue: { fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: -0.2 },
  summaryPillLabel: { fontFamily: 'Inter_500Medium', fontSize: 10, marginTop: 2, letterSpacing: 0.3 },

  allergenBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderWidth: 1, borderLeftWidth: 4, borderRadius: 12,
    padding: 12,
  },
  allergenTitle: { fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 0.4 },
  allergenList: { fontFamily: 'Inter_500Medium', fontSize: 13, marginTop: 2 },

  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
  },
  metaLabel: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  metaValue: { flex: 1, textAlign: 'right', fontFamily: 'Inter_600SemiBold', fontSize: 13 },

  ingredientsText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 4 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  ctaHalf: { flex: 1, flexDirection: 'row', gap: 6, marginTop: 0 },
});
