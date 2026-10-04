import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeTokens, SemanticTokens } from '../src/theme';
import { getScanById } from '../src/db/scanHistory';
import { buildComparison, summariseComparison, type CompareSection } from '../src/services/compare';
import { NOT_ADVICE_FOOTER } from '../src/services/nutrition';
import { OPEN_FACTS_ATTRIBUTION, isOpenFactsSource, type ProductCard } from '../src/services/productLookup';
import { SkeletonPulse } from '../src/components/SkeletonPulse';

/**
 * Compare two scanned products.
 *
 * Both products come out of scan history, which stores each card in full — so
 * this screen makes no network calls and works on a plane. Reached from the
 * Compare action in scan history.
 *
 * Highlighting is strictly arithmetic. See `src/services/compare.ts` for why
 * the word "better" never appears on this screen.
 */
export default function CompareScreen() {
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();
  const { a: aId, b: bId } = useLocalSearchParams<{ a?: string; b?: string }>();

  const [cards, setCards] = useState<{ a: ProductCard; b: ProductCard } | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [ra, rb] = await Promise.all([
        getScanById(Number(aId)),
        getScanById(Number(bId)),
      ]);
      if (cancelled) return;
      if (ra?.card && rb?.card) setCards({ a: ra.card, b: rb.card });
      else setFailed(true);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [aId, bId]);

  const sections = useMemo<CompareSection[]>(
    () => (cards ? buildComparison(cards.a, cards.b) : []),
    [cards]
  );

  const summary = useMemo(
    () =>
      cards
        ? summariseComparison(sections, displayName(cards.a), displayName(cards.b))
        : '',
    [sections, cards]
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: t.background }]}>
        <Stack.Screen options={{ title: 'Compare' }} />
        <View style={{ padding: 16, gap: 10 }}>
          <SkeletonPulse
            style={{ height: 130, borderRadius: 16, backgroundColor: t.surfaceElevated }}
          />
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonPulse
              key={i}
              style={{ height: 46, borderRadius: 10, backgroundColor: t.surfaceElevated }}
            />
          ))}
        </View>
      </View>
    );
  }

  if (failed || !cards) {
    return (
      <View style={[styles.container, styles.centre, { backgroundColor: t.background }]}>
        <Stack.Screen options={{ title: 'Compare' }} />
        <MaterialCommunityIcons name="scale-balance" size={54} color={t.textSubtle} />
        <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>
          Couldn&rsquo;t open both products
        </Text>
        <Text style={[styles.emptyBody, { color: t.textMuted }]}>
          One of these scans no longer has its full details saved. Scan it again and it will be
          comparable.
        </Text>
        <TouchableOpacity
          style={[styles.cta, { backgroundColor: t.cta }]}
          onPress={() => router.back()}
          accessibilityRole="button"
        >
          <Text style={[styles.ctaText, { color: t.ctaText }]}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <Stack.Screen options={{ title: 'Compare' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
        {/* ---- Heads ---- */}
        <View style={styles.headRow}>
          <ProductHead card={cards.a} tokens={t} />
          <View style={[styles.vsWrap, { backgroundColor: t.surfaceElevated }]}>
            <Text style={[styles.vsText, { color: t.textMuted }]}>vs</Text>
          </View>
          <ProductHead card={cards.b} tokens={t} />
        </View>

        {/* ---- Summary ---- */}
        <View style={[styles.summary, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.summaryText, { color: t.textPrimary }]}>{summary}</Text>
        </View>

        {/* ---- Rows ---- */}
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: t.textSubtle }]}>
              {section.title.toUpperCase()}
            </Text>
            <View style={[styles.table, { backgroundColor: t.surface, borderColor: t.border }]}>
              {section.rows.map((row, i) => (
                <View
                  key={row.key}
                  style={[
                    styles.row,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
                  ]}
                >
                  <View style={styles.rowLabelWrap}>
                    <Text style={[styles.rowLabel, { color: t.textMuted }]}>{row.label}</Text>
                    {row.winner !== 'none' && row.winner !== 'tie' && !!row.betterMeans && (
                      <Text style={[styles.betterMeans, { color: t.textSubtle }]}>
                        ● {row.betterMeans}
                      </Text>
                    )}
                  </View>
                  <View style={styles.valuesRow}>
                    <CompareValue
                      value={row.a}
                      highlighted={row.winner === 'a'}
                      tokens={t}
                    />
                    <CompareValue
                      value={row.b}
                      highlighted={row.winner === 'b'}
                      tokens={t}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}

        <Text style={[styles.disclaimer, { color: t.textSubtle }]}>{NOT_ADVICE_FOOTER}</Text>
        {(isOpenFactsSource(cards.a.source) || isOpenFactsSource(cards.b.source)) && (
          <Text style={[styles.disclaimer, { color: t.textSubtle }]}>
            {OPEN_FACTS_ATTRIBUTION}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

function displayName(card: ProductCard): string {
  return card.name || card.brand || card.barcode;
}

function ProductHead({ card, tokens }: { card: ProductCard; tokens: SemanticTokens }) {
  return (
    <View style={styles.head}>
      {card.imageUrl ? (
        <Image source={{ uri: card.imageUrl }} style={styles.headImage} resizeMode="contain" />
      ) : (
        <View
          style={[
            styles.headImage,
            styles.headImageEmpty,
            { backgroundColor: tokens.surfaceElevated },
          ]}
        >
          <MaterialCommunityIcons name="barcode" size={24} color={tokens.textSubtle} />
        </View>
      )}
      <Text style={[styles.headName, { color: tokens.textPrimary }]} numberOfLines={3}>
        {displayName(card)}
      </Text>
      {!!card.brand && card.brand !== card.name && (
        <Text style={[styles.headBrand, { color: tokens.textMuted }]} numberOfLines={1}>
          {card.brand}
        </Text>
      )}
    </View>
  );
}

function CompareValue({
  value,
  highlighted,
  tokens,
}: {
  value: string | null;
  highlighted: boolean;
  tokens: SemanticTokens;
}) {
  return (
    <View
      style={[
        styles.valueCell,
        highlighted && { backgroundColor: tokens.successBg, borderRadius: 7 },
      ]}
    >
      <Text
        style={[
          styles.valueText,
          { color: value === null ? tokens.textSubtle : tokens.textPrimary },
          highlighted && { color: tokens.success, fontWeight: '700' },
        ]}
      >
        {value ?? '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centre: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },

  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  head: { flex: 1, alignItems: 'center', gap: 6 },
  headImage: { width: 74, height: 74, borderRadius: 12 },
  headImageEmpty: { alignItems: 'center', justifyContent: 'center' },
  headName: { fontSize: 13.5, fontWeight: '700', textAlign: 'center', lineHeight: 18 },
  headBrand: { fontSize: 11.5, textAlign: 'center' },
  vsWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  vsText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  summary: {
    marginTop: 16,
    padding: 13,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
  },
  summaryText: { fontSize: 13.5, lineHeight: 19.5 },

  section: { marginTop: 18, gap: 7 },
  sectionTitle: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.1 },
  table: { borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { paddingVertical: 10, paddingHorizontal: 12, gap: 6 },
  rowLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { fontSize: 11.5, fontWeight: '600', flexShrink: 1 },
  betterMeans: { fontSize: 10 },
  valuesRow: { flexDirection: 'row', gap: 8 },
  valueCell: { flex: 1, paddingVertical: 5, paddingHorizontal: 7, minHeight: 28, justifyContent: 'center' },
  valueText: { fontSize: 13.5, textAlign: 'center' },

  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  cta: {
    minWidth: 160,
    minHeight: 48,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  ctaText: { fontSize: 15, fontWeight: '700' },

  disclaimer: { fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 14 },
});
