import type { ProductCard } from './productLookup';
import {
  buildNutrientRows,
  energyKcal,
  nutriScoreGrade,
  ecoScoreGrade,
  novaLabel,
  buildAlcoholInfo,
  formatUnits,
  parsePackSize,
  deriveBadges,
  NUTRIENT_LABEL,
  type NutrientKey,
} from './nutrition';

/**
 * Side-by-side product comparison.
 *
 * Pure functions, no network, no state — everything is derived from two
 * `ProductCard`s that scan history already stores in full, so comparing works
 * offline and instantly.
 *
 * ## The rule this file is built around
 *
 * A comparison screen is where a nutrition app is most tempted to start giving
 * advice, and where doing so would be least defensible. So the only claims made
 * here are arithmetic ones: 3 is less than 9, B comes before D in the
 * alphabet, one of these has an allergen the other doesn't. `better` below
 * means "lower number" or "earlier letter" — never "healthier", never
 * "the one you should buy".
 *
 * Two products the user chose to compare may not be comparable at all (a
 * lipstick and a lager). Rows simply omit themselves when neither side has the
 * figure, so an incomparable pair produces a short, honest screen rather than a
 * grid of dashes.
 */

/** Which side wins on a row, where winning is a defensible arithmetic fact. */
export type Winner = 'a' | 'b' | 'tie' | 'none';

export interface CompareRow {
  key: string;
  label: string;
  /** Display value for each side; null renders as "—" (not on file). */
  a: string | null;
  b: string | null;
  /**
   * Which side is lower/earlier. `none` means the row is not orderable —
   * either a value is missing, or the quantity has no meaningful direction.
   */
  winner: Winner;
  /**
   * What "winning" means on this row, shown to the user so the highlight is
   * never mistaken for a recommendation. e.g. "lower", "less processed".
   */
  betterMeans?: string;
}

export interface CompareSection {
  title: string;
  rows: CompareRow[];
}

/** Lower number wins. Returns `none` unless both sides have a figure. */
function lowerWins(a: number | null, b: number | null): Winner {
  if (a === null || b === null) return 'none';
  if (Math.abs(a - b) < 1e-9) return 'tie';
  return a < b ? 'a' : 'b';
}

/** Earlier letter wins (a–e scales: Nutri-Score, Eco-Score). */
function earlierGradeWins(a: string | null, b: string | null): Winner {
  if (!a || !b) return 'none';
  if (a === b) return 'tie';
  return a < b ? 'a' : 'b';
}

function num(n: number | null | undefined, suffix: string, dp = 1): string | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  // Whole numbers read better without a trailing .0 on a cramped two-column row.
  const rounded = Number(n.toFixed(dp));
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(dp)}${suffix}`;
}

/** Strip the language prefix OFF puts on every tag. */
function plainTag(tag: string): string {
  return tag.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ').trim().toLowerCase();
}

function nutrimentValue(card: ProductCard, key: NutrientKey): number | null {
  const isDrink = card.kind === 'drink' || card.kind === 'alcohol';
  const pack = parsePackSize(card.quantity);
  const row = buildNutrientRows(card.nutriments, isDrink, pack?.total).find((r) => r.key === key);
  return row ? row.per100 : null;
}

/**
 * Build the full comparison.
 *
 * Sections come back already filtered: a section with no surviving rows is
 * dropped entirely rather than rendering an empty heading.
 */
export function buildComparison(a: ProductCard, b: ProductCard): CompareSection[] {
  const sections: CompareSection[] = [];

  const bothDrinks =
    (a.kind === 'drink' || a.kind === 'alcohol') && (b.kind === 'drink' || b.kind === 'alcohol');
  const perUnit = bothDrinks ? 'per 100ml' : 'per 100g';

  /* ---- Scores ---- */
  const aNutri = nutriScoreGrade(a.nutriscoreGrade);
  const bNutri = nutriScoreGrade(b.nutriscoreGrade);
  const aEco = ecoScoreGrade(a.ecoscoreGrade);
  const bEco = ecoScoreGrade(b.ecoscoreGrade);

  const scoreRows: CompareRow[] = [
    {
      key: 'nutriscore',
      label: 'Nutri-Score',
      a: aNutri ? aNutri.toUpperCase() : null,
      b: bNutri ? bNutri.toUpperCase() : null,
      winner: earlierGradeWins(aNutri, bNutri),
      betterMeans: 'closer to A',
    },
    {
      key: 'ecoscore',
      label: 'Eco-Score',
      a: aEco ? aEco.toUpperCase() : null,
      b: bEco ? bEco.toUpperCase() : null,
      winner: earlierGradeWins(aEco, bEco),
      betterMeans: 'closer to A',
    },
    {
      key: 'nova',
      label: 'Processing (NOVA)',
      a: a.novaGroup ? `${a.novaGroup} — ${novaLabel(a.novaGroup)}` : null,
      b: b.novaGroup ? `${b.novaGroup} — ${novaLabel(b.novaGroup)}` : null,
      winner: lowerWins(a.novaGroup, b.novaGroup),
      betterMeans: 'less processed',
    },
  ].filter((r) => r.a !== null || r.b !== null);

  if (scoreRows.length) sections.push({ title: 'Scores', rows: scoreRows });

  /* ---- Nutrition ---- */
  const aKcal = energyKcal(a.nutriments);
  const bKcal = energyKcal(b.nutriments);

  const nutritionRows: CompareRow[] = [
    {
      key: 'energy',
      label: `Energy ${perUnit}`,
      a: num(aKcal, ' kcal', 0),
      b: num(bKcal, ' kcal', 0),
      winner: lowerWins(aKcal, bKcal),
      betterMeans: 'lower',
    },
    ...(['fat', 'saturates', 'sugars', 'salt'] as NutrientKey[]).map((key) => {
      const av = nutrimentValue(a, key);
      const bv = nutrimentValue(b, key);
      return {
        key,
        label: `${NUTRIENT_LABEL[key]} ${perUnit}`,
        a: num(av, 'g'),
        b: num(bv, 'g'),
        winner: lowerWins(av, bv),
        betterMeans: 'lower',
      };
    }),
  ].filter((r) => r.a !== null || r.b !== null);

  if (nutritionRows.length) sections.push({ title: 'Nutrition', rows: nutritionRows });

  /* ---- Alcohol ---- */
  const aAlc = buildAlcoholInfo(a.abv, a.quantity);
  const bAlc = buildAlcoholInfo(b.abv, b.quantity);
  if (aAlc || bAlc) {
    const alcoholRows: CompareRow[] = [
      {
        key: 'abv',
        label: 'ABV',
        a: num(aAlc?.abv ?? null, '%'),
        b: num(bAlc?.abv ?? null, '%'),
        winner: lowerWins(aAlc?.abv ?? null, bAlc?.abv ?? null),
        betterMeans: 'lower',
      },
      {
        key: 'units',
        label: 'UK units per container',
        a: aAlc?.unitsPerContainer != null ? formatUnits(aAlc.unitsPerContainer) : null,
        b: bAlc?.unitsPerContainer != null ? formatUnits(bAlc.unitsPerContainer) : null,
        winner: lowerWins(aAlc?.unitsPerContainer ?? null, bAlc?.unitsPerContainer ?? null),
        betterMeans: 'lower',
      },
    ].filter((r) => r.a !== null || r.b !== null);
    if (alcoholRows.length) sections.push({ title: 'Alcohol', rows: alcoholRows });
  }

  /* ---- Allergens and additives ---- *
   * Allergen counts are compared, but the *names* matter more than the count —
   * the screen lists which side carries what, because "2 vs 1" is useless to
   * someone avoiding one specific thing.                                     */
  const aAllergens = (a.allergensTags ?? []).map(plainTag);
  const bAllergens = (b.allergensTags ?? []).map(plainTag);
  const aAdditives = (a.additivesTags ?? []).length;
  const bAdditives = (b.additivesTags ?? []).length;

  const contentRows: CompareRow[] = [
    {
      key: 'allergens',
      label: 'Declared allergens',
      a: a.ingredientsText || aAllergens.length ? (aAllergens.join(', ') || 'None declared') : null,
      b: b.ingredientsText || bAllergens.length ? (bAllergens.join(', ') || 'None declared') : null,
      // Deliberately not ordered. Fewer allergens is not "better" — it depends
      // entirely on which allergen and which person.
      winner: 'none' as const,
    },
    {
      key: 'additives',
      label: 'Additives',
      a: a.ingredientsText || aAdditives ? String(aAdditives) : null,
      b: b.ingredientsText || bAdditives ? String(bAdditives) : null,
      winner: lowerWins(
        a.ingredientsText || aAdditives ? aAdditives : null,
        b.ingredientsText || bAdditives ? bAdditives : null
      ),
      betterMeans: 'fewer',
    },
  ].filter((r) => r.a !== null || r.b !== null);

  if (contentRows.length) sections.push({ title: 'Ingredients', rows: contentRows });

  /* ---- Certifications ---- */
  const aBadges = deriveBadges({
    labelsTags: a.labelsTags ?? [],
    ingredientsAnalysisTags: a.ingredientsAnalysisTags ?? [],
  });
  const bBadges = deriveBadges({
    labelsTags: b.labelsTags ?? [],
    ingredientsAnalysisTags: b.ingredientsAnalysisTags ?? [],
  });
  if (aBadges.length || bBadges.length) {
    sections.push({
      title: 'Diet & certification',
      rows: [
        {
          key: 'badges',
          label: 'Claimed',
          a: aBadges.length ? aBadges.map((x) => x.label).join(', ') : 'None on file',
          b: bBadges.length ? bBadges.map((x) => x.label).join(', ') : 'None on file',
          winner: 'none' as const,
        },
      ],
    });
  }

  /* ---- Pack ---- */
  const packRows: CompareRow[] = [
    {
      key: 'quantity',
      label: 'Pack size',
      a: a.quantity || null,
      b: b.quantity || null,
      winner: 'none' as const,
    },
    {
      key: 'country',
      label: 'Country',
      a: a.country || null,
      b: b.country || null,
      winner: 'none' as const,
    },
  ].filter((r) => r.a !== null || r.b !== null);

  if (packRows.length) sections.push({ title: 'Pack', rows: packRows });

  return sections;
}

/**
 * A one-line factual summary of where the two differ on ordered rows.
 *
 * Counts rows won, and says nothing else. No verdict, no recommendation — the
 * user is looking at the table and can draw their own conclusion, which on this
 * subject is the only conclusion that should be drawn.
 */
export function summariseComparison(
  sections: CompareSection[],
  nameA: string,
  nameB: string
): string {
  const ordered = sections.flatMap((s) => s.rows).filter((r) => r.winner === 'a' || r.winner === 'b');
  if (ordered.length === 0) {
    return 'Not enough shared data on file to compare these two on any measure.';
  }
  const aWins = ordered.filter((r) => r.winner === 'a').length;
  const bWins = ordered.length - aWins;

  if (aWins === bWins) {
    return `Evenly split: ${aWins} measure${aWins === 1 ? '' : 's'} each, of ${ordered.length} that could be compared.`;
  }
  const leader = aWins > bWins ? nameA : nameB;
  const lead = Math.max(aWins, bWins);
  return `${leader} is lower or earlier on ${lead} of ${ordered.length} comparable measures. That is arithmetic, not a recommendation — which measures matter is your call.`;
}
