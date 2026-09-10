import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Share,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ProductCard as Product, Alternative } from '../services/productLookup';
import { SOURCE_LABEL, isOpenFactsSource, OPEN_FACTS_ATTRIBUTION } from '../services/productLookup';
import {
  buildNutrientRows,
  energyKcal,
  guidanceLine,
  matchFlags,
  novaLabel,
  nutriScoreGrade,
  NUTRISCORE_COLOR,
  isPoorNutriScore,
  buildAlcoholInfo,
  formatUnits,
  formatAdditives,
  parsePackSize,
  LIGHT_TEXT,
  NOT_ADVICE_FOOTER,
  type DietaryFlag,
  type Light,
} from '../services/nutrition';
import { hapticLight } from '../utils/haptics';

/**
 * The product card.
 *
 * Laid out differently per product kind, because a jar of Nutella and a bottle
 * of gin have almost nothing useful in common. What every variant shares:
 *
 *   - one neutral guidance line at the top, generated from the label
 *   - the user's own flags, if any matched, above everything else
 *   - a visible "not medical or dietary advice" footer, always
 *
 * Every number here is a restatement of the pack. Nothing on this card tells
 * the user what to do about it.
 */

const LIGHT_COLOR: Record<Light, string> = {
  green: '#2f9e44',
  amber: '#f08c00',
  red: '#e03131',
};

interface Props {
  card: Product;
  currency: string;
  userFlags: DietaryFlag[];
  /** Free AI scans left, or null when the user is Pro (unlimited). */
  scansLeft: number | null;
  onUse: () => void;
  onScanAnother: () => void;
  onReadIngredientsFromPack: () => void;
  readingIngredients: boolean;
  onShowAlternatives: () => void;
  alternatives: Alternative[] | null;
  loadingAlternatives: boolean;
}

export default function ProductCardView({
  card,
  currency,
  userFlags,
  scansLeft,
  onUse,
  onScanAnother,
  onReadIngredientsFromPack,
  readingIngredients,
  onShowAlternatives,
  alternatives,
  loadingAlternatives,
}: Props) {
  const [showIngredients, setShowIngredients] = useState(false);
  const [copied, setCopied] = useState(false);

  const isDrink = card.kind === 'drink' || card.kind === 'alcohol';
  const isFoodish = card.kind === 'food' || isDrink;

  const pack = useMemo(() => parsePackSize(card.quantity), [card.quantity]);
  const rows = useMemo(
    () => (isFoodish ? buildNutrientRows(card.nutriments, isDrink, pack?.total) : []),
    [card.nutriments, isDrink, isFoodish, pack?.total]
  );
  const flags = useMemo(
    () =>
      matchFlags(userFlags, {
        allergensTags: card.allergensTags,
        tracesTags: card.tracesTags,
        ingredientsText: card.ingredientsText,
      }),
    [userFlags, card.allergensTags, card.tracesTags, card.ingredientsText]
  );
  const guidance = useMemo(
    () => guidanceLine({ flags, rows, novaGroup: card.novaGroup }),
    [flags, rows, card.novaGroup]
  );

  const grade = nutriScoreGrade(card.nutriscoreGrade);
  const nova = novaLabel(card.novaGroup);
  const kcal = energyKcal(card.nutriments);
  const additives = formatAdditives(card.additivesTags);
  const alcohol = card.kind === 'alcohol' ? buildAlcoholInfo(card.abv, card.quantity) : null;

  const copyCode = async () => {
    hapticLight();
    await Clipboard.setStringAsync(card.barcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const shareProduct = () => {
    hapticLight();
    const lines = [card.name, card.brand, `Barcode: ${card.barcode}`].filter(Boolean);
    Share.share({ message: lines.join('\n') }).catch(() => {});
  };

  const searchWeb = () => {
    hapticLight();
    const q = encodeURIComponent(card.name ? `${card.brand} ${card.name}`.trim() : card.barcode);
    Linking.openURL(`https://duckduckgo.com/?q=${q}`).catch(() => {});
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ---- Header: photo, name, brand ---- */}
      <View style={styles.header}>
        {card.imageUrl ? (
          <Image source={{ uri: card.imageUrl }} style={styles.photo} resizeMode="contain" />
        ) : (
          <View style={[styles.photo, styles.photoEmpty]}>
            <MaterialCommunityIcons name="package-variant" size={26} color="rgba(255,255,255,0.3)" />
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={3}>
            {card.name || 'Not identified'}
          </Text>
          {!!card.brand && (
            <Text style={styles.brand} numberOfLines={1}>
              {card.brand}
            </Text>
          )}
          {!!card.quantity && <Text style={styles.quantity}>{card.quantity}</Text>}
        </View>
      </View>

      {/* ---- Guidance line ---- */}
      {!!guidance && (
        <View style={[styles.guidance, flags.length > 0 && styles.guidanceFlagged]}>
          <MaterialCommunityIcons
            name={flags.length ? 'alert-circle-outline' : 'information-outline'}
            size={16}
            color={flags.length ? '#ffb4b4' : 'rgba(255,255,255,0.75)'}
          />
          <Text style={[styles.guidanceText, flags.length > 0 && styles.guidanceTextFlagged]}>
            {guidance}
          </Text>
        </View>
      )}

      {/* ---- Matched flags, with how firm the match is ---- */}
      {flags.length > 0 && (
        <View style={styles.flagList}>
          {flags.map((f) => (
            <View key={f.key} style={styles.flagChip}>
              <Text style={styles.flagChipText}>{f.label}</Text>
              <Text style={styles.flagBasis}>
                {f.basis === 'declared'
                  ? 'on the label'
                  : f.basis === 'traces'
                    ? 'may contain'
                    : 'found in ingredients'}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ---- Food & drink: scores + traffic lights ---- */}
      {isFoodish && (grade || nova || rows.length > 0) && (
        <View style={styles.section}>
          <View style={styles.scoreRow}>
            {grade && (
              <View style={styles.scoreBlock}>
                <View style={[styles.gradeBadge, { backgroundColor: NUTRISCORE_COLOR[grade] }]}>
                  <Text style={styles.gradeText}>{grade.toUpperCase()}</Text>
                </View>
                <Text style={styles.scoreCaption}>Nutri-Score</Text>
              </View>
            )}
            {nova && (
              <View style={styles.scoreBlock}>
                <View style={styles.novaBadge}>
                  <Text style={styles.novaNumber}>{card.novaGroup}</Text>
                </View>
                <Text style={styles.scoreCaption} numberOfLines={2}>
                  {nova}
                </Text>
              </View>
            )}
            {kcal !== null && (
              <View style={styles.scoreBlock}>
                <View style={styles.kcalBadge}>
                  <Text style={styles.kcalNumber}>{Math.round(kcal)}</Text>
                </View>
                <Text style={styles.scoreCaption}>kcal / 100{isDrink ? 'ml' : 'g'}</Text>
              </View>
            )}
          </View>

          {rows.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>
                PER 100{isDrink ? 'ML' : 'G'}
              </Text>
              <View style={styles.lightRow}>
                {rows.map((r) => (
                  <View
                    key={r.key}
                    style={[styles.lightCell, { borderColor: LIGHT_COLOR[r.light] }]}
                  >
                    <Text style={styles.lightNutrient}>{r.label}</Text>
                    <Text style={[styles.lightValue, { color: LIGHT_COLOR[r.light] }]}>
                      {r.per100 < 1 ? r.per100.toFixed(2) : r.per100.toFixed(1)}g
                    </Text>
                    <View style={[styles.lightPill, { backgroundColor: LIGHT_COLOR[r.light] }]}>
                      <Text style={styles.lightPillText}>{LIGHT_TEXT[r.light]}</Text>
                    </View>
                  </View>
                ))}
              </View>
              {rows.some((r) => r.portionForcedRed) && (
                <Text style={styles.footnote}>
                  Marked high because of the amount in one {isDrink ? 'serving' : 'portion'}, under
                  the UK front-of-pack rules.
                </Text>
              )}
            </>
          )}
        </View>
      )}

      {/* ---- Alcohol: ABV and UK units ---- */}
      {alcohol && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ALCOHOL</Text>
          <View style={styles.abvRow}>
            <View style={styles.abvBlock}>
              <Text style={styles.abvNumber}>{alcohol.abv}%</Text>
              <Text style={styles.scoreCaption}>ABV</Text>
            </View>
            {alcohol.unitsPerContainer !== null && (
              <View style={styles.abvBlock}>
                <Text style={styles.abvNumber}>{formatUnits(alcohol.unitsPerContainer)}</Text>
                <Text style={styles.scoreCaption}>
                  UK units{alcohol.volumeMl ? ` / ${alcohol.volumeMl}ml` : ''}
                </Text>
              </View>
            )}
            {alcohol.unitsPerPack !== null && alcohol.count > 1 && (
              <View style={styles.abvBlock}>
                <Text style={styles.abvNumber}>{formatUnits(alcohol.unitsPerPack)}</Text>
                <Text style={styles.scoreCaption}>units in {alcohol.count}-pack</Text>
              </View>
            )}
          </View>
          {alcohol.unitsPerContainer === null && (
            <Text style={styles.footnote}>
              No container size on file, so units can't be worked out from the database alone.
            </Text>
          )}
          <Text style={styles.footnote}>
            Units are ABV × volume ÷ 1,000, the NHS formula.
          </Text>
        </View>
      )}

      {/* ---- Ingredients ---- */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>INGREDIENTS</Text>
        {card.ingredientsText ? (
          <>
            <Text
              style={styles.ingredients}
              numberOfLines={showIngredients ? undefined : 4}
            >
              {card.ingredientsText}
            </Text>
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setShowIngredients((v) => !v);
              }}
              hitSlop={8}
            >
              <Text style={styles.linkText}>
                {showIngredients ? 'Show less' : 'Show full list'}
              </Text>
            </TouchableOpacity>
            {card.ingredientsOrigin === 'photo' && (
              <Text style={styles.footnote}>Read from your photo of the pack.</Text>
            )}
          </>
        ) : (
          <>
            <Text style={styles.emptyNote}>
              No ingredient list on file for this product yet.
            </Text>
            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={onReadIngredientsFromPack}
              disabled={readingIngredients}
              activeOpacity={0.85}
            >
              {readingIngredients ? (
                <ActivityIndicator size="small" color="rgba(255,255,255,0.9)" />
              ) : (
                <>
                  <MaterialCommunityIcons name="camera-outline" size={16} color="white" />
                  <Text style={styles.outlineBtnText}>Photograph the ingredients</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.footnote}>
              {scansLeft === null
                ? 'Included in your subscription.'
                : `Uses one of your ${scansLeft} free AI scans this month.`}
            </Text>
          </>
        )}

        {card.allergensTags.length > 0 && (
          <Text style={styles.allergenLine}>
            Declared allergens:{' '}
            {card.allergensTags
              .map((t) => t.replace(/^[a-z]{2}:/, '').replace(/-/g, ' '))
              .join(', ')}
          </Text>
        )}
        {additives.length > 0 && (
          <Text style={styles.allergenLine}>
            Additives ({additives.length}): {additives.join(', ')}
          </Text>
        )}
      </View>

      {/* ---- Alternatives ---- */}
      {isFoodish && isPoorNutriScore(card.nutriscoreGrade) && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ALTERNATIVES</Text>
          {alternatives === null ? (
            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={onShowAlternatives}
              disabled={loadingAlternatives}
              activeOpacity={0.85}
            >
              {loadingAlternatives ? (
                <ActivityIndicator size="small" color="rgba(255,255,255,0.9)" />
              ) : (
                <>
                  <MaterialCommunityIcons name="compare-horizontal" size={16} color="white" />
                  <Text style={styles.outlineBtnText}>Show better-scoring products</Text>
                </>
              )}
            </TouchableOpacity>
          ) : alternatives.length === 0 ? (
            <Text style={styles.emptyNote}>
              No A-grade products found in this category right now.
            </Text>
          ) : (
            <>
              <Text style={styles.footnote}>
                Nutri-Score A products from the same Open Food Facts category.
              </Text>
              {alternatives.map((alt) => (
                <View key={alt.barcode} style={styles.altRow}>
                  {alt.imageUrl ? (
                    <Image source={{ uri: alt.imageUrl }} style={styles.altPhoto} />
                  ) : (
                    <View style={[styles.altPhoto, styles.photoEmpty]} />
                  )}
                  <View style={styles.altText}>
                    <Text style={styles.altName} numberOfLines={2}>
                      {alt.name}
                    </Text>
                    {!!alt.brand && <Text style={styles.altBrand}>{alt.brand}</Text>}
                  </View>
                  <View
                    style={[
                      styles.altGrade,
                      { backgroundColor: NUTRISCORE_COLOR[alt.nutriscoreGrade] },
                    ]}
                  >
                    <Text style={styles.altGradeText}>{alt.nutriscoreGrade.toUpperCase()}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {/* ---- The decoded value, always visible, always actionable ---- */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>BARCODE</Text>
        <Text style={styles.barcodeValue} selectable>
          {card.barcode}
        </Text>
        <Text style={styles.footnote}>
          {card.barcodeType.toUpperCase().replace(/_/g, '-')}
          {card.source ? ` · ${SOURCE_LABEL[card.source]}` : ''}
          {card.fromCache ? ' · saved on this phone' : ''}
          {card.source === 'ai' ? ` · ${Math.round(card.confidence * 100)}% confident` : ''}
        </Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={copyCode} activeOpacity={0.8}>
            <MaterialCommunityIcons
              name={copied ? 'check' : 'content-copy'}
              size={17}
              color="white"
            />
            <Text style={styles.actionText}>{copied ? 'Copied' : 'Copy'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={shareProduct} activeOpacity={0.8}>
            <MaterialCommunityIcons name="share-variant" size={17} color="white" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={searchWeb} activeOpacity={0.8}>
            <MaterialCommunityIcons name="web" size={17} color="white" />
            <Text style={styles.actionText}>Search</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ---- Footer ---- */}
      <Text style={styles.disclaimer}>{NOT_ADVICE_FOOTER}</Text>
      {isOpenFactsSource(card.source) && (
        <Text style={styles.attribution}>{OPEN_FACTS_ATTRIBUTION}</Text>
      )}

      <TouchableOpacity style={styles.primaryBtn} onPress={onUse} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>Add to a receipt</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={onScanAnother} activeOpacity={0.7}>
        <Text style={styles.secondaryBtnText}>Scan another</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // No height of its own: the card wrapper carries a maxHeight in pixels, and
  // flexShrink lets this collapse into whatever that leaves rather than
  // pushing the wrapper past it. A percentage height here would resolve
  // against a parent whose own height is content-driven, i.e. against nothing.
  scroll: { flexShrink: 1 },
  scrollContent: { paddingBottom: 4 },

  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  photo: { width: 68, height: 68, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' },
  photoEmpty: { alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: 2 },
  name: { color: 'white', fontSize: 17, fontWeight: '700', lineHeight: 22 },
  brand: { color: 'rgba(255,255,255,0.7)', fontSize: 13.5 },
  quantity: { color: 'rgba(255,255,255,0.45)', fontSize: 12 },

  guidance: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  guidanceFlagged: {
    backgroundColor: 'rgba(224,49,49,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,120,120,0.45)',
  },
  guidanceText: {
    flex: 1,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  guidanceTextFlagged: { color: '#ffd9d9' },

  flagList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  flagChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: 'rgba(224,49,49,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,120,120,0.4)',
  },
  flagChipText: { color: '#ffd9d9', fontSize: 12, fontWeight: '700' },
  flagBasis: { color: 'rgba(255,190,190,0.75)', fontSize: 10 },

  section: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 10,
  },

  scoreRow: { flexDirection: 'row', gap: 16, marginBottom: 14 },
  scoreBlock: { alignItems: 'center', gap: 5, flex: 1 },
  gradeBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeText: { color: 'white', fontSize: 21, fontWeight: '900' },
  novaBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  novaNumber: { color: 'white', fontSize: 19, fontWeight: '800' },
  kcalBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  kcalNumber: { color: 'white', fontSize: 15, fontWeight: '800' },
  scoreCaption: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10.5,
    textAlign: 'center',
    lineHeight: 13,
  },

  lightRow: { flexDirection: 'row', gap: 6 },
  lightCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  lightNutrient: { color: 'rgba(255,255,255,0.7)', fontSize: 10.5, fontWeight: '600' },
  lightValue: { fontSize: 14, fontWeight: '800' },
  lightPill: { paddingHorizontal: 7, paddingVertical: 1.5, borderRadius: 7 },
  lightPillText: { color: 'white', fontSize: 9.5, fontWeight: '800' },

  abvRow: { flexDirection: 'row', gap: 18 },
  abvBlock: { alignItems: 'center', gap: 3, flex: 1 },
  abvNumber: { color: 'white', fontSize: 22, fontWeight: '800' },

  ingredients: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12.5,
    lineHeight: 18,
  },
  linkText: {
    color: '#f59e0b',
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 6,
    paddingVertical: 4,
  },
  emptyNote: { color: 'rgba(255,255,255,0.5)', fontSize: 12.5, lineHeight: 18, marginBottom: 10 },
  allergenLine: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
  },
  footnote: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 8,
  },

  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  outlineBtnText: { color: 'white', fontSize: 13.5, fontWeight: '600' },

  altRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  altPhoto: { width: 38, height: 38, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.06)' },
  altText: { flex: 1 },
  altName: { color: 'white', fontSize: 13, fontWeight: '600', lineHeight: 17 },
  altBrand: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  altGrade: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  altGradeText: { color: 'white', fontSize: 12, fontWeight: '900' },

  barcodeValue: {
    color: 'white',
    fontSize: 17,
    letterSpacing: 2,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  actionText: { color: 'white', fontSize: 12.5, fontWeight: '600' },

  disclaimer: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 11,
    marginTop: 16,
    fontStyle: 'italic',
  },
  attribution: { color: 'rgba(255,255,255,0.32)', fontSize: 10, marginTop: 4 },

  primaryBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 14,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  primaryBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
  secondaryBtn: { alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: 2 },
  secondaryBtnText: { color: 'rgba(255,255,255,0.65)', fontSize: 13.5 },
});
