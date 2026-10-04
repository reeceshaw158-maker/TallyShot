import { useEffect, useMemo, useRef, useState } from 'react';
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
  Animated,
  Easing,
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
  deriveBadges,
  ecoScoreGrade,
  buildServingRows,
  formatServing,
  KCAL_PER_UK_UNIT,
  type ProductBadge,
  type DietaryFlag,
  type Light,
} from '../services/nutrition';
import { hapticLight } from '../utils/haptics';
import { explainAdditives } from '../services/additives';

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

/** `en:tree-nuts` -> `Tree nuts`. OFF prefixes every tag by language. */
function titleCaseTag(tag: string): string {
  const clean = tag.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ').trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

const BADGE_TONE: Record<'good' | 'neutral' | 'watch', { bg: string; fg: string }> = {
  good: { bg: 'rgba(52,199,89,0.16)', fg: '#7ee2a0' },
  neutral: { bg: 'rgba(255,255,255,0.09)', fg: 'rgba(255,255,255,0.8)' },
  watch: { bg: 'rgba(245,158,11,0.16)', fg: '#f7c065' },
};

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

  /**
   * Entry animation.
   *
   * Keyed to the barcode rather than to mount, because the card component is
   * reused between scans — without the key a second scan would slide in the
   * first product's card and then swap its contents, which reads as a glitch.
   *
   * Spring for the movement and a linear fade over the top: a spring on opacity
   * overshoots past 1 and clips, which is invisible on paper and obvious on a
   * phone.
   */
  const enter = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    enter.setValue(0);
    fade.setValue(0);
    Animated.parallel([
      Animated.spring(enter, {
        toValue: 1,
        friction: 9,
        tension: 70,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [card.barcode, enter, fade]);

  const isDrink = card.kind === 'drink' || card.kind === 'alcohol';
  const isFoodish = card.kind === 'food' || isDrink;

  const pack = useMemo(() => parsePackSize(card.quantity), [card.quantity]);
  const badges = useMemo(
    () =>
      deriveBadges({
        labelsTags: card.labelsTags,
        ingredientsAnalysisTags: card.ingredientsAnalysisTags,
      }),
    [card.labelsTags, card.ingredientsAnalysisTags]
  );
  const ecoGrade = ecoScoreGrade(card.ecoscoreGrade);
  const servingRows = useMemo(
    () => (isFoodish ? buildServingRows(card.nutriments, card.servingQuantity, isDrink) : []),
    [card.nutriments, card.servingQuantity, isDrink, isFoodish]
  );
  const explained = useMemo(() => explainAdditives(card.additivesTags), [card.additivesTags]);
  const [showAdditives, setShowAdditives] = useState(false);
  /** True when any badge on show was inferred rather than claimed. */
  const anyDerived = badges.some((b) => b.certainty === 'derived');
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

  /**
   * Share the findings, not just the name.
   *
   * The old version sent name, brand and barcode — which tells the person
   * receiving it nothing they could not read off the packet themselves. What
   * is worth sending is the part they cannot see: the scores, the allergens,
   * the units.
   *
   * Text rather than an image card: rendering a view to PNG needs
   * react-native-view-shot, a native module that is not in Expo Go, and this
   * app's dev loop runs on Expo Go.
   */
  const shareProduct = () => {
    hapticLight();
    const lines: string[] = [];

    const title = [card.name, card.brand && card.brand !== card.name ? `— ${card.brand}` : '']
      .filter(Boolean)
      .join(' ');
    if (title) lines.push(title);
    if (card.quantity) lines.push(card.quantity);
    lines.push('');

    if (grade) lines.push(`Nutri-Score ${grade.toUpperCase()}`);
    if (ecoGrade) lines.push(`Eco-Score ${ecoGrade.toUpperCase()}`);
    if (nova) lines.push(`Processing: ${nova}`);
    if (kcal !== null) lines.push(`${Math.round(kcal)} kcal per 100${isDrink ? 'ml' : 'g'}`);

    for (const r of rows) {
      lines.push(
        `${r.label}: ${r.per100 < 1 ? r.per100.toFixed(2) : r.per100.toFixed(1)}g (${LIGHT_TEXT[r.light]})`
      );
    }

    if (alcohol) {
      lines.push(`${alcohol.abv}% ABV`);
      if (alcohol.unitsPerContainer !== null) {
        lines.push(`${formatUnits(alcohol.unitsPerContainer)} UK units per container`);
      }
    }

    if (card.allergensTags.length) {
      lines.push('');
      lines.push(`Allergens: ${card.allergensTags.map(titleCaseTag).join(', ')}`);
    }

    lines.push('');
    lines.push(`Barcode ${card.barcode}`);
    lines.push(NOT_ADVICE_FOOTER);
    if (isOpenFactsSource(card.source)) lines.push(OPEN_FACTS_ATTRIBUTION);
    lines.push('Scanned with TallyShot');

    Share.share({ message: lines.join('\n') }).catch(() => {});
  };

  const searchWeb = () => {
    hapticLight();
    const q = encodeURIComponent(card.name ? `${card.brand} ${card.name}`.trim() : card.barcode);
    Linking.openURL(`https://duckduckgo.com/?q=${q}`).catch(() => {});
  };

  return (
    <Animated.ScrollView
      style={[
        styles.scroll,
        {
          opacity: fade,
          transform: [
            {
              translateY: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [28, 0],
              }),
            },
            {
              scale: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [0.96, 1],
              }),
            },
          ],
        },
      ]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ---- Header: full-width hero photo, then name and brand ----
           Product photos are the one piece of a card a person recognises at a
           glance, and a 68px thumbnail wastes that. The hero is capped in
           height so a tall bottle cannot push the whole card off screen. */}
      {card.imageUrl ? (
        <Image source={{ uri: card.imageUrl }} style={styles.hero} resizeMode="contain" />
      ) : (
        <View style={[styles.hero, styles.photoEmpty]}>
          <MaterialCommunityIcons name="package-variant" size={38} color="rgba(255,255,255,0.25)" />
        </View>
      )}
      <View style={styles.header}>
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
            {ecoGrade && (
              <View style={styles.scoreBlock}>
                <View style={[styles.gradeBadge, { backgroundColor: NUTRISCORE_COLOR[ecoGrade] }]}>
                  <Text style={styles.gradeText}>{ecoGrade.toUpperCase()}</Text>
                </View>
                <Text style={styles.scoreCaption}>Eco-Score</Text>
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

              {/* Per-serving, only where the database has a serving to scale
                  to. Traffic lights are not repeated here: the FSA colours are
                  defined per 100g, and recolouring them against a serving
                  would be inventing a rating scheme. */}
              {servingRows.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>
                    PER SERVING{card.servingSize ? ` · ${card.servingSize.toUpperCase()}` : ''}
                  </Text>
                  <View style={styles.servingGrid}>
                    {servingRows.map((r) => (
                      <View key={r.key} style={styles.servingCell}>
                        <Text style={styles.servingValue}>{formatServing(r)}</Text>
                        <Text style={styles.servingLabel}>{r.label}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.footnote}>
                    Scaled from the per-100 figures using the serving size on file. Colours above
                    are the UK front-of-pack ratings, which are defined per 100
                    {isDrink ? 'ml' : 'g'}.
                  </Text>
                </>
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
          {alcohol.unitsPerContainer !== null && (
            <Text style={styles.footnote}>
              That is roughly {Math.round(alcohol.unitsPerContainer * KCAL_PER_UK_UNIT)} kcal from
              the alcohol alone ({KCAL_PER_UK_UNIT} kcal per unit). Anything sweet in the drink
              adds to that.
            </Text>
          )}
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

        {badges.length > 0 && (
          <View style={styles.allergenWrap}>
            <Text style={styles.allergenHeading}>DIET & CERTIFICATION</Text>
            <View style={styles.pillRow}>
              {badges.map((b: ProductBadge) => (
                <View
                  key={b.key}
                  style={[styles.badgePill, { backgroundColor: BADGE_TONE[b.tone].bg }]}
                >
                  <MaterialCommunityIcons
                    name={b.icon as any}
                    size={12}
                    color={BADGE_TONE[b.tone].fg}
                  />
                  <Text style={[styles.badgePillText, { color: BADGE_TONE[b.tone].fg }]}>
                    {b.label}
                  </Text>
                  {b.certainty === 'derived' && <Text style={styles.derivedMark}>*</Text>}
                </View>
              ))}
            </View>
            {anyDerived && (
              <Text style={styles.derivedNote}>
                * Read from the ingredient list rather than claimed on the pack. If you
                are avoiding something strictly, check the label itself.
              </Text>
            )}
          </View>
        )}

        {/* Pills, not a sentence. An allergen buried in a comma-separated line
            is findable; the same allergen as a row of amber chips is
            unmissable, which is the entire job of this part of the card. */}
        {card.allergensTags.length > 0 && (
          <View style={styles.allergenWrap}>
            <Text style={styles.allergenHeading}>DECLARED ALLERGENS</Text>
            <View style={styles.pillRow}>
              {card.allergensTags.map((t) => (
                <View key={t} style={styles.allergenPill}>
                  <MaterialCommunityIcons name="alert-circle" size={12} color="#f59e0b" />
                  <Text style={styles.allergenPillText}>
                    {titleCaseTag(t)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {explained.length > 0 && (
          <View style={styles.allergenWrap}>
            <Text style={styles.allergenHeading}>ADDITIVES ({explained.length})</Text>
            {(showAdditives ? explained : explained.slice(0, 3)).map((a) => (
              <View key={a.code} style={styles.additiveRow}>
                <Text style={styles.additiveCode}>{a.code}</Text>
                <View style={styles.additiveBody}>
                  {a.info ? (
                    <>
                      <Text style={styles.additiveName}>{a.info.name}</Text>
                      <Text style={styles.additiveRole}>{a.info.role}</Text>
                      {!!a.info.note && <Text style={styles.additiveNote}>{a.info.note}</Text>}
                    </>
                  ) : (
                    /* Listed even when unexplained — dropping it would
                       misrepresent what is actually in the product. */
                    <Text style={styles.additiveRole}>
                      Listed on the pack. We don&rsquo;t have a plain-English entry for this one yet.
                    </Text>
                  )}
                </View>
              </View>
            ))}
            {explained.length > 3 && (
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  setShowAdditives((v) => !v);
                }}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={styles.linkText}>
                  {showAdditives
                    ? 'Show fewer'
                    : `Show all ${explained.length} additives`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
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
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  // No height of its own: the card wrapper carries a maxHeight in pixels, and
  // flexShrink lets this collapse into whatever that leaves rather than
  // pushing the wrapper past it. A percentage height here would resolve
  // against a parent whose own height is content-driven, i.e. against nothing.
  scroll: { flexShrink: 1 },
  scrollContent: { paddingBottom: 4 },

  hero: {
    width: '100%',
    height: 150,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 12,
  },
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
    color: '#00C896',
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 6,
    paddingVertical: 4,
  },
  emptyNote: { color: 'rgba(255,255,255,0.5)', fontSize: 12.5, lineHeight: 18, marginBottom: 10 },
  allergenWrap: { marginTop: 12, gap: 7 },
  servingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  servingCell: {
    flexGrow: 1,
    minWidth: 68,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    gap: 2,
  },
  servingValue: { color: 'white', fontSize: 14.5, fontWeight: '700' },
  servingLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10.5, fontWeight: '600' },

  additiveRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  additiveCode: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11.5,
    fontWeight: '800',
    minWidth: 46,
    paddingTop: 1,
  },
  additiveBody: { flex: 1, gap: 1 },
  additiveName: { color: 'white', fontSize: 12.5, fontWeight: '600' },
  additiveRole: { color: 'rgba(255,255,255,0.62)', fontSize: 12, lineHeight: 16.5 },
  additiveNote: { color: '#f7c065', fontSize: 11.5, lineHeight: 16 },
  allergenHeading: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  allergenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(245,158,11,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  allergenPillText: { color: '#f7c065', fontSize: 12, fontWeight: '700' },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgePillText: { fontSize: 12, fontWeight: '600' },
  derivedMark: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700' },
  derivedNote: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    lineHeight: 15.5,
  },
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
    backgroundColor: '#00C896',
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
