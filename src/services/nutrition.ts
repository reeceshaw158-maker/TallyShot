/**
 * Nutrition, allergen and alcohol maths.
 *
 * Everything in here is a pure function over data we already fetched — no
 * network, no state. That matters because this is the part of the product
 * card a user could reasonably act on, so it has to be checkable by reading it.
 *
 * The house rule for every string this file produces: **restate the label,
 * never diagnose the person.** "High in sugar" is a fact about the jar.
 * "This will harm you" is a medical claim and we never make one.
 */

/* ------------------------------------------------------------------ *
 * UK front-of-pack traffic lights
 * ------------------------------------------------------------------ */

/**
 * Official FSA/DHSC cut-offs, transcribed from Tables 2 and 3 of
 * "Guide to creating a front of pack (FoP) nutrition label for pre-packed
 * products sold through retail outlets" (gov.uk, Annex 3).
 *
 * Note the two traps in the real table, both of which secondary sources
 * routinely get wrong:
 *   - Sugars high is 22.5g/100g, not 15g (15g belongs to a different scheme).
 *   - Drinks salt is 0.75g/100ml, NOT the same 1.5g as food.
 */
export type Light = 'green' | 'amber' | 'red';

export type NutrientKey = 'fat' | 'saturates' | 'sugars' | 'salt';

interface Threshold {
  /** Upper bound of green (inclusive). */
  low: number;
  /** Upper bound of amber (inclusive). Above this is red. */
  high: number;
  /** Per-portion figure that forces red regardless of the per-100 value. */
  portion: number;
}

const FOOD_THRESHOLDS: Record<NutrientKey, Threshold> = {
  fat: { low: 3.0, high: 17.5, portion: 21 },
  saturates: { low: 1.5, high: 5.0, portion: 6 },
  sugars: { low: 5.0, high: 22.5, portion: 27 },
  salt: { low: 0.3, high: 1.5, portion: 1.8 },
};

const DRINK_THRESHOLDS: Record<NutrientKey, Threshold> = {
  fat: { low: 1.5, high: 8.75, portion: 10.5 },
  saturates: { low: 0.75, high: 2.5, portion: 3 },
  sugars: { low: 2.5, high: 11.25, portion: 13.5 },
  salt: { low: 0.3, high: 0.75, portion: 0.9 },
};

/** Portion rules only kick in above these sizes (grams for food, ml for drink). */
const FOOD_PORTION_MIN_G = 100;
const DRINK_PORTION_MIN_ML = 150;

export const NUTRIENT_LABEL: Record<NutrientKey, string> = {
  fat: 'Fat',
  saturates: 'Saturates',
  sugars: 'Sugars',
  salt: 'Salt',
};

export const LIGHT_TEXT: Record<Light, string> = {
  green: 'Low',
  amber: 'Med',
  red: 'High',
};

export interface NutrientRow {
  key: NutrientKey;
  label: string;
  /** Grams per 100g (food) or per 100ml (drink). */
  per100: number;
  light: Light;
  /** True when the per-portion rule forced red despite an amber/green per-100. */
  portionForcedRed: boolean;
}

/**
 * Colour one nutrient.
 *
 * Step 3 of the official method: for a portion over the size floor, any
 * nutrient meeting the per-portion red criterion is red whatever its
 * per-100 figure says.
 */
export function trafficLight(
  key: NutrientKey,
  per100: number,
  isDrink: boolean,
  portionAmount?: number
): { light: Light; portionForcedRed: boolean } {
  const t = (isDrink ? DRINK_THRESHOLDS : FOOD_THRESHOLDS)[key];

  let light: Light;
  if (per100 <= t.low) light = 'green';
  else if (per100 <= t.high) light = 'amber';
  else light = 'red';

  const floor = isDrink ? DRINK_PORTION_MIN_ML : FOOD_PORTION_MIN_G;
  let portionForcedRed = false;
  if (portionAmount && portionAmount > floor) {
    const perPortion = (per100 * portionAmount) / 100;
    if (perPortion > t.portion && light !== 'red') {
      light = 'red';
      portionForcedRed = true;
    }
  }

  return { light, portionForcedRed };
}

/** OFF nutriment keys, in the order the FoP label presents them. */
const NUTRIMENT_KEYS: Record<NutrientKey, string> = {
  fat: 'fat_100g',
  saturates: 'saturated-fat_100g',
  sugars: 'sugars_100g',
  salt: 'salt_100g',
};

/**
 * Build the traffic-light row set from an Open Food Facts `nutriments` object.
 * Nutrients the database has no figure for are omitted rather than shown as
 * zero — "0g of salt" and "we don't know" are very different claims.
 */
export function buildNutrientRows(
  nutriments: Record<string, unknown> | null | undefined,
  isDrink: boolean,
  portionAmount?: number
): NutrientRow[] {
  if (!nutriments) return [];
  const rows: NutrientRow[] = [];

  (Object.keys(NUTRIMENT_KEYS) as NutrientKey[]).forEach((key) => {
    const raw = nutriments[NUTRIMENT_KEYS[key]];
    const per100 = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(per100) || per100 < 0) return;
    const { light, portionForcedRed } = trafficLight(key, per100, isDrink, portionAmount);
    rows.push({ key, label: NUTRIENT_LABEL[key], per100, light, portionForcedRed });
  });

  return rows;
}

/** Energy in kcal per 100g/ml, when the database has it. */
export function energyKcal(nutriments: Record<string, unknown> | null | undefined): number | null {
  if (!nutriments) return null;
  const v = Number(nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal']);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/* ------------------------------------------------------------------ *
 * NOVA processing level
 * ------------------------------------------------------------------ */

/**
 * NOVA classifies by *degree of processing*, not by how healthy something is —
 * so the wording stays descriptive. Tinned tomatoes are group 3 and perfectly
 * good food.
 */
export const NOVA_LABEL: Record<number, string> = {
  1: 'Unprocessed or minimally processed',
  2: 'Processed culinary ingredient',
  3: 'Processed food',
  4: 'Ultra-processed',
};

export function novaLabel(group: number | null | undefined): string | null {
  if (!group || !NOVA_LABEL[group]) return null;
  return NOVA_LABEL[group];
}

/* ------------------------------------------------------------------ *
 * Nutri-Score
 * ------------------------------------------------------------------ */

export const NUTRISCORE_COLOR: Record<string, string> = {
  a: '#038141',
  b: '#85bb2f',
  c: '#fecb02',
  d: '#ee8100',
  e: '#e63e11',
};

export function nutriScoreGrade(grade: string | null | undefined): string | null {
  const g = (grade ?? '').trim().toLowerCase();
  return /^[a-e]$/.test(g) ? g : null;
}

/** D and E are the grades we offer alternatives for. */
export function isPoorNutriScore(grade: string | null | undefined): boolean {
  const g = nutriScoreGrade(grade);
  return g === 'd' || g === 'e';
}

/* ------------------------------------------------------------------ *
 * Pack size parsing
 * ------------------------------------------------------------------ */

export interface PackSize {
  /** Millilitres for liquids, grams for solids. */
  amount: number;
  unit: 'ml' | 'g';
  /** Number of items in a multipack, e.g. "4 x 440ml" → 4. */
  count: number;
  /** amount × count. */
  total: number;
}

/**
 * Open Food Facts `quantity` is free text typed by contributors. Real examples
 * seen in the wild: "330 ml", "250ml", "400 g e", "70cl", "1L", "4 x 440 ml".
 *
 * Returns null rather than guessing — an unparseable pack size means we show
 * no unit count at all, which is far better than showing a wrong one.
 */
export function parsePackSize(quantity: string | null | undefined): PackSize | null {
  const q = (quantity ?? '').trim().toLowerCase();
  if (!q) return null;

  // Multipack prefix: "4 x 440 ml", "6x33cl"
  let count = 1;
  const multi = q.match(/^(\d{1,2})\s*[x×]\s*/);
  let rest = q;
  if (multi) {
    count = parseInt(multi[1], 10);
    rest = q.slice(multi[0].length);
  }

  const m = rest.match(/(\d+(?:[.,]\d+)?)\s*(ml|cl|l|litre|liter|g|kg|gr|grams?)\b/);
  if (!m) return null;

  const value = parseFloat(m[1].replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;

  const raw = m[2];
  let amount: number;
  let unit: 'ml' | 'g';

  switch (raw) {
    case 'ml':
      amount = value;
      unit = 'ml';
      break;
    case 'cl':
      amount = value * 10;
      unit = 'ml';
      break;
    case 'l':
    case 'litre':
    case 'liter':
      amount = value * 1000;
      unit = 'ml';
      break;
    case 'kg':
      amount = value * 1000;
      unit = 'g';
      break;
    default:
      amount = value;
      unit = 'g';
  }

  if (count < 1 || count > 60) count = 1;
  return { amount, unit, count, total: amount * count };
}

/* ------------------------------------------------------------------ *
 * UK alcohol units
 * ------------------------------------------------------------------ */

export interface AlcoholInfo {
  /** % alcohol by volume. */
  abv: number;
  /** Units in one container, when the pack size parsed. */
  unitsPerContainer: number | null;
  /** Units in the whole pack (multipacks). */
  unitsPerPack: number | null;
  /** Container volume in ml, when known. */
  volumeMl: number | null;
  count: number;
}

/**
 * UK units = ABV × volume(ml) ÷ 1000.
 * NHS worked example: 5.2% × 568ml ÷ 1000 = 2.95 units.
 * https://www.nhs.uk/live-well/alcohol-advice/calculating-alcohol-units/
 */
export function alcoholUnits(abv: number, volumeMl: number): number {
  return (abv * volumeMl) / 1000;
}

export function buildAlcoholInfo(
  abv: number | null | undefined,
  quantity: string | null | undefined
): AlcoholInfo | null {
  const v = Number(abv);
  if (!Number.isFinite(v) || v <= 0) return null;

  const pack = parsePackSize(quantity);
  // Only volume makes sense for units; a bottle measured in grams can't be
  // converted without a density we don't have.
  const volumeMl = pack && pack.unit === 'ml' ? pack.amount : null;
  const count = pack?.count ?? 1;

  const unitsPerContainer = volumeMl ? alcoholUnits(v, volumeMl) : null;
  const unitsPerPack = unitsPerContainer !== null ? unitsPerContainer * count : null;

  return { abv: v, unitsPerContainer, unitsPerPack, volumeMl, count };
}

export function formatUnits(units: number): string {
  return units >= 10 ? units.toFixed(0) : units.toFixed(1);
}

/* ------------------------------------------------------------------ *
 * Dietary flags
 * ------------------------------------------------------------------ */

/**
 * What a user can ask us to watch for. The first 14 are the UK/EU declarable
 * allergens (so Open Food Facts has structured tags for them); the rest are
 * cosmetic-ingredient concerns matched from INCI text.
 */
export type DietaryFlag =
  | 'gluten'
  | 'crustaceans'
  | 'eggs'
  | 'fish'
  | 'peanuts'
  | 'soybeans'
  | 'milk'
  | 'nuts'
  | 'celery'
  | 'mustard'
  | 'sesame'
  | 'sulphites'
  | 'lupin'
  | 'molluscs'
  | 'fragrance'
  | 'parabens'
  | 'sulphates'
  | 'alcohol_denat'
  | 'silicones'
  | 'formaldehyde_releasers';

export interface FlagDef {
  key: DietaryFlag;
  label: string;
  /** Compact form for the one-line guidance sentence. */
  short: string;
  /** Food allergens come from OFF's structured tags; cosmetics from INCI text. */
  group: 'food' | 'cosmetic';
  /** OFF `allergens_tags` / `traces_tags` values that mean this flag. */
  tags: string[];
  /** Case-insensitive patterns matched against ingredient text. */
  patterns: RegExp[];
}

export const FLAG_DEFS: FlagDef[] = [
  {
    key: 'gluten',
    label: 'Gluten',
    short: 'gluten',
    group: 'food',
    tags: ['en:gluten'],
    patterns: [/\b(wheat|barley|rye|spelt|gluten)\b/i],
  },
  {
    key: 'milk',
    label: 'Dairy / milk',
    short: 'dairy',
    group: 'food',
    tags: ['en:milk'],
    patterns: [/\b(milk|lactose|whey|casein|butter|cream|cheese)\b/i],
  },
  {
    key: 'eggs',
    label: 'Eggs',
    short: 'eggs',
    group: 'food',
    tags: ['en:eggs'],
    patterns: [/\begg\b|\beggs\b|\balbumen\b/i],
  },
  {
    key: 'peanuts',
    label: 'Peanuts',
    short: 'peanuts',
    group: 'food',
    tags: ['en:peanuts'],
    patterns: [/\bpeanuts?\b|\bgroundnuts?\b|\barachis\b/i],
  },
  {
    key: 'nuts',
    label: 'Tree nuts',
    short: 'tree nuts',
    group: 'food',
    tags: ['en:nuts'],
    patterns: [/\b(almond|hazelnut|walnut|cashew|pecan|pistachio|macadamia|brazil nut)s?\b/i],
  },
  {
    key: 'soybeans',
    label: 'Soya',
    short: 'soya',
    group: 'food',
    tags: ['en:soybeans'],
    patterns: [/\bsoya?\b|\bsoybeans?\b|\blecithins?\s*\(soya?\)/i],
  },
  {
    key: 'fish',
    label: 'Fish',
    short: 'fish',
    group: 'food',
    tags: ['en:fish'],
    patterns: [/\b(fish|anchov|salmon|tuna|cod|haddock)\w*\b/i],
  },
  {
    key: 'crustaceans',
    label: 'Crustaceans',
    short: 'crustaceans',
    group: 'food',
    tags: ['en:crustaceans'],
    patterns: [/\b(prawn|shrimp|crab|lobster|crayfish|langoustine)s?\b/i],
  },
  {
    key: 'molluscs',
    label: 'Molluscs',
    short: 'molluscs',
    group: 'food',
    tags: ['en:molluscs'],
    patterns: [/\b(mussel|oyster|squid|octopus|scallop|clam|snail|whelk)s?\b/i],
  },
  {
    key: 'celery',
    label: 'Celery',
    short: 'celery',
    group: 'food',
    tags: ['en:celery'],
    patterns: [/\bcelery\b|\bceleriac\b/i],
  },
  {
    key: 'mustard',
    label: 'Mustard',
    short: 'mustard',
    group: 'food',
    tags: ['en:mustard'],
    patterns: [/\bmustard\b/i],
  },
  {
    key: 'sesame',
    label: 'Sesame',
    short: 'sesame',
    group: 'food',
    tags: ['en:sesame-seeds', 'en:sesame'],
    patterns: [/\bsesame\b|\btahini\b/i],
  },
  {
    key: 'sulphites',
    label: 'Sulphites',
    short: 'sulphites',
    group: 'food',
    tags: ['en:sulphur-dioxide-and-sulphites'],
    patterns: [/\bsulphites?\b|\bsulfites?\b|sulphur dioxide|\bE22[0-8]\b/i],
  },
  {
    key: 'lupin',
    label: 'Lupin',
    short: 'lupin',
    group: 'food',
    tags: ['en:lupin'],
    patterns: [/\blupin\b/i],
  },
  {
    key: 'fragrance',
    label: 'Fragrance / parfum',
    short: 'fragrance',
    group: 'cosmetic',
    tags: [],
    // The named ones are the 26 EU declarable fragrance allergens (the common subset).
    patterns: [
      /\b(parfum|fragrance|aroma)\b/i,
      /\b(limonene|linalool|citronellol|geraniol|eugenol|coumarin|citral|isoeugenol|farnesol)\b/i,
    ],
  },
  {
    key: 'parabens',
    label: 'Parabens',
    short: 'parabens',
    group: 'cosmetic',
    tags: [],
    patterns: [/\b\w*paraben\b/i],
  },
  {
    key: 'sulphates',
    label: 'Sulphates (SLS/SLES)',
    short: 'sulphates',
    group: 'cosmetic',
    tags: [],
    patterns: [/\b\w*(lauryl|laureth)\s+sul[fp]ate\b/i, /\bsodium\s+coco[- ]?sul[fp]ate\b/i],
  },
  {
    key: 'alcohol_denat',
    label: 'Denatured alcohol',
    short: 'denatured alcohol',
    group: 'cosmetic',
    tags: [],
    patterns: [/\balcohol\s*denat\w*\b/i, /\bsd alcohol\b/i],
  },
  {
    key: 'silicones',
    label: 'Silicones',
    short: 'silicones',
    group: 'cosmetic',
    tags: [],
    patterns: [/\b\w*(methicone|siloxane)\b/i],
  },
  {
    key: 'formaldehyde_releasers',
    label: 'Formaldehyde releasers',
    short: 'formaldehyde releasers',
    group: 'cosmetic',
    tags: [],
    patterns: [
      /\bdmdm\s+hydantoin\b/i,
      /\bimidazolidinyl\s+urea\b/i,
      /\bdiazolidinyl\s+urea\b/i,
      /\bquaternium-15\b/i,
    ],
  },
];

export const FLAG_LABEL: Record<DietaryFlag, string> = FLAG_DEFS.reduce(
  (acc, d) => ({ ...acc, [d.key]: d.label }),
  {} as Record<DietaryFlag, string>
);

/**
 * Words that turn a mention of an ingredient into a promise it's absent.
 *
 * This exists because of a real false positive: Nutella's ingredient text ends
 * "Sans gluten" — French for gluten-FREE — and a naive search for "gluten"
 * told a coeliac user the jar contained it. Telling someone a safe product is
 * unsafe is only marginally better than the reverse, and it destroys trust in
 * every other flag we raise.
 *
 * Multilingual on purpose: Open Food Facts is a worldwide database and a UK
 * shopper routinely scans imported packs with French, Spanish, German or
 * Italian ingredient text.
 */
const NEGATORS_BEFORE =
  /(?:without|free\s+from|free\s+of|no\s+added|\bno\b|non|sans|sin|senza|ohne|zonder|utan|libre\s+de|privo\s+di)\s*[-:]?\s*$/i;

const NEGATORS_AFTER = /^\s*[-‑–]?\s*(?:free|frei|frey)\b/i;

/**
 * True when a matched ingredient term is actually a "free from" declaration.
 * Looks at a small window either side — enough to catch "sans gluten" and
 * "gluten-free", short enough not to swallow a real mention two clauses away.
 */
function isNegated(text: string, matchStart: number, matchEnd: number): boolean {
  const before = text.slice(Math.max(0, matchStart - 24), matchStart);
  if (NEGATORS_BEFORE.test(before)) return true;
  const after = text.slice(matchEnd, matchEnd + 12);
  return NEGATORS_AFTER.test(after);
}

/**
 * Run one pattern over the text and report a hit only if at least one
 * occurrence is *not* negated. "Contains wheat flour. Gluten free." should
 * still flag gluten — so a single un-negated mention is enough.
 */
function matchesUnnegated(pattern: RegExp, text: string): boolean {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    if (!isNegated(text, m.index, m.index + m[0].length)) return true;
  }
  return false;
}

export interface FlagMatch {
  key: DietaryFlag;
  label: string;
  /** Compact form for the guidance sentence. */
  short: string;
  /**
   * `declared` — the database's structured allergen list says so (strongest).
   * `traces`   — "may contain" only.
   * `text`     — we matched the ingredient text ourselves (weakest; a word
   *              like "butter" appears in "shea butter" too).
   */
  basis: 'declared' | 'traces' | 'text';
}

/**
 * Match the user's flags against a product.
 *
 * Deliberately conservative about *strength*, not about *coverage*: we report
 * the weak text matches too, but label them as such in the UI, because a
 * missed allergen matters more than a redundant one. The card always tells the
 * user to check the pack — this is a prompt to look, not a substitute for it.
 *
 * Known limitation: the `patterns` above are English. A Spanish pack listing
 * "leche" won't match on text alone. It is still caught, because Open Food
 * Facts normalises every language's allergen declaration into the same
 * `en:milk` tag — so `declared` carries non-English products and `text` is
 * only ever a bonus layer on top. This is why we never rely on text alone for
 * the 14 declarable allergens.
 */
export function matchFlags(
  userFlags: DietaryFlag[],
  opts: {
    allergensTags?: string[] | null;
    tracesTags?: string[] | null;
    ingredientsText?: string | null;
  }
): FlagMatch[] {
  if (!userFlags.length) return [];

  const allergens = new Set((opts.allergensTags ?? []).map((t) => t.toLowerCase()));
  const traces = new Set((opts.tracesTags ?? []).map((t) => t.toLowerCase()));
  const text = (opts.ingredientsText ?? '').trim();

  const out: FlagMatch[] = [];

  for (const key of userFlags) {
    const def = FLAG_DEFS.find((d) => d.key === key);
    if (!def) continue;

    // Structured tags are curated data, not prose — no negation risk.
    if (def.tags.some((t) => allergens.has(t))) {
      out.push({ key, label: def.label, short: def.short, basis: 'declared' });
      continue;
    }
    if (def.tags.some((t) => traces.has(t))) {
      out.push({ key, label: def.label, short: def.short, basis: 'traces' });
      continue;
    }
    // Free text is prose, so every hit goes through the "free from" guard.
    if (text && def.patterns.some((p) => matchesUnnegated(p, text))) {
      out.push({ key, label: def.label, short: def.short, basis: 'text' });
    }
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Additives
 * ------------------------------------------------------------------ */

/**
 * "en:e322i" → "E322i". Presented as a plain list of codes, no verdict — an
 * additive being present is a fact; whether it matters isn't ours to say.
 *
 * OFF lists both the parent and the sub-variant ("en:e322" *and* "en:e322i"),
 * which would show a single emulsifier as two additives and overstate the
 * count. We keep the more specific code and drop the parent it extends.
 */
export function formatAdditives(tags: string[] | null | undefined): string[] {
  if (!tags?.length) return [];

  const codes: string[] = [];
  for (const tag of tags) {
    const raw = tag.replace(/^[a-z]{2}:/, '').trim();
    const m = raw.match(/^e(\d{3,4})([a-z]*)$/i);
    if (!m) continue;
    const code = `E${m[1]}${m[2].toLowerCase()}`;
    if (!codes.includes(code)) codes.push(code);
  }

  // Drop any code that another, longer code starts with (E322 vs E322i).
  return codes.filter((c) => !codes.some((other) => other !== c && other.startsWith(c)));
}

/* ------------------------------------------------------------------ *
 * The guidance line
 * ------------------------------------------------------------------ */

/**
 * One short neutral sentence for the top of the card.
 *
 * Rules, in priority order:
 *   1. The user's own flags come first — it's why they set them.
 *   2. Then the strongest factual observation from the label.
 *   3. Never a health outcome, never a recommendation, never "you should".
 */
export function guidanceLine(opts: {
  flags: FlagMatch[];
  rows: NutrientRow[];
  novaGroup?: number | null;
}): string | null {
  const { flags, rows, novaGroup } = opts;

  if (flags.length) {
    // "May contain" is a weaker claim than an ingredient list, so it only
    // leads the line when there's nothing firmer to report.
    const firm = flags.filter((f) => f.basis !== 'traces');
    const use = firm.length ? firm : flags;
    const traceOnly = firm.length === 0;
    const list = use.map((f) => f.short);

    const shown =
      list.length === 1
        ? list[0]
        : list.length === 2
          ? `${list[0]} and ${list[1]}`
          : `${list.slice(0, 2).join(', ')} and ${list.length - 2} more`;

    if (traceOnly) return `May contain ${shown} — on your flag list.`;
    return list.length === 1
      ? `Contains ${shown} — on your flag list.`
      : `Contains ${list.length} things you flagged: ${shown}.`;
  }

  const reds = rows.filter((r) => r.light === 'red');
  if (reds.length) {
    const names = reds.map((r) => r.label.toLowerCase());
    if (names.length === 1) return `High in ${names[0]}.`;
    const last = names.pop();
    return `High in ${names.join(', ')} and ${last}.`;
  }

  if (novaGroup === 4) return 'Ultra-processed (NOVA group 4).';

  if (rows.length && rows.every((r) => r.light === 'green')) {
    return 'Low in fat, saturates, sugar and salt.';
  }

  return null;
}

/** Fixed footer. Shown on every product card, no exceptions. */
export const NOT_ADVICE_FOOTER = 'Not medical or dietary advice. Always check the pack.';

/* ------------------------------------------------------------------ *
 * Diet, certification and eco badges
 * ------------------------------------------------------------------ */

/**
 * A badge on the product card.
 *
 * `certainty` is the point of this type. Open Food Facts carries two very
 * different kinds of claim and they must not be shown as if they were the same
 * thing:
 *
 *   - `declared` — the producer has claimed the certification and it is in
 *     `labels_tags`. This is what is printed on the pack.
 *   - `derived`  — OFF worked it out by reading the ingredient list
 *     (`ingredients_analysis_tags`). Useful, frequently right, and absolutely
 *     not something to put in front of someone with an allergy as fact.
 *
 * Anyone avoiding an ingredient for medical or religious reasons needs to know
 * which of the two they are looking at, so `derived` badges render quieter and
 * carry a "from the ingredients" note.
 */
export type BadgeCertainty = 'declared' | 'derived';
export type BadgeTone = 'good' | 'neutral' | 'watch';

export interface ProductBadge {
  key: string;
  label: string;
  icon: string;
  tone: BadgeTone;
  certainty: BadgeCertainty;
}

/** Tag matching is prefix-based because OFF prefixes by language (`en:`, `fr:`). */
function hasTag(tags: string[], ...needles: string[]): boolean {
  return tags.some((raw) => {
    const tag = raw.toLowerCase().replace(/^[a-z]{2}:/, '');
    return needles.some((n) => tag === n);
  });
}

/**
 * Certifications a producer has actively claimed. Never inferred.
 *
 * Ordered by how often the claim is the reason someone picked the product up.
 */
const LABEL_BADGES: { key: string; label: string; icon: string; tags: string[] }[] = [
  { key: 'organic', label: 'Organic', icon: 'sprout', tags: ['organic', 'eu-organic', 'ab-agriculture-biologique', 'usda-organic'] },
  { key: 'vegan', label: 'Vegan', icon: 'leaf', tags: ['vegan'] },
  { key: 'vegetarian', label: 'Vegetarian', icon: 'food-apple-outline', tags: ['vegetarian'] },
  { key: 'gluten-free', label: 'Gluten free', icon: 'barley-off', tags: ['gluten-free', 'no-gluten'] },
  { key: 'halal', label: 'Halal', icon: 'check-decagram-outline', tags: ['halal'] },
  { key: 'kosher', label: 'Kosher', icon: 'check-decagram-outline', tags: ['kosher'] },
  { key: 'cruelty-free', label: 'Cruelty free', icon: 'rabbit', tags: ['cruelty-free', 'not-tested-on-animals', 'leaping-bunny'] },
  { key: 'fairtrade', label: 'Fairtrade', icon: 'handshake-outline', tags: ['fairtrade', 'fair-trade', 'max-havelaar'] },
  { key: 'palm-oil-free', label: 'No palm oil', icon: 'palm-tree', tags: ['palm-oil-free', 'no-palm-oil', 'without-palm-oil'] },
];

/**
 * Build the badge row for a product.
 *
 * Declared beats derived: if a producer has claimed "vegan" there is no reason
 * to also show OFF's reading of the ingredient list, and showing both reads as
 * two separate findings rather than one fact.
 */
export function deriveBadges(opts: {
  labelsTags: string[];
  ingredientsAnalysisTags: string[];
}): ProductBadge[] {
  const labels = opts.labelsTags ?? [];
  const analysis = opts.ingredientsAnalysisTags ?? [];
  const badges: ProductBadge[] = [];
  const claimed = new Set<string>();

  for (const def of LABEL_BADGES) {
    if (hasTag(labels, ...def.tags)) {
      badges.push({
        key: def.key,
        label: def.label,
        icon: def.icon,
        tone: 'good',
        certainty: 'declared',
      });
      claimed.add(def.key);
    }
  }

  // OFF's own derivation, only where the producer has not already said so.
  if (!claimed.has('vegan') && hasTag(analysis, 'vegan')) {
    badges.push({ key: 'vegan', label: 'Vegan', icon: 'leaf', tone: 'good', certainty: 'derived' });
    claimed.add('vegan');
  }
  if (!claimed.has('vegetarian') && !claimed.has('vegan') && hasTag(analysis, 'vegetarian')) {
    badges.push({
      key: 'vegetarian',
      label: 'Vegetarian',
      icon: 'food-apple-outline',
      tone: 'good',
      certainty: 'derived',
    });
  }

  // Palm oil is the one badge that is a warning rather than a credential, so it
  // is stated as a fact about the ingredients and nothing more. "May contain"
  // is reported at the same weight, because the honest answer there is
  // "possibly", not silence.
  if (!claimed.has('palm-oil-free')) {
    if (hasTag(analysis, 'palm-oil')) {
      badges.push({
        key: 'palm-oil',
        label: 'Contains palm oil',
        icon: 'palm-tree',
        tone: 'watch',
        certainty: 'derived',
      });
    } else if (hasTag(analysis, 'may-contain-palm-oil')) {
      badges.push({
        key: 'palm-oil-maybe',
        label: 'May contain palm oil',
        icon: 'palm-tree',
        tone: 'watch',
        certainty: 'derived',
      });
    }
  }

  return badges;
}

/** Eco-Score uses the same a-e scale and colours as Nutri-Score. */
export function ecoScoreGrade(grade: string | null | undefined): string | null {
  const g = String(grade ?? '').toLowerCase();
  return /^[a-e]$/.test(g) ? g : null;
}

/**
 * Energy per UK alcohol unit.
 *
 * Pure ethanol is 7 kcal/g at a density of 0.789 g/ml, and a UK unit is 10ml of
 * it — so a unit carries about 55 kcal before anything else in the drink is
 * counted. Stated as "from alcohol alone" for exactly that reason: a sweet
 * cider's real figure is higher and this number must not be read as the total.
 */
export const KCAL_PER_UK_UNIT = Math.round(10 * 0.789 * 7);

/* ------------------------------------------------------------------ *
 * Per-serving figures
 * ------------------------------------------------------------------ */

export interface ServingRow {
  key: NutrientKey | 'energy';
  label: string;
  /** Already scaled to one serving. Grams, except energy which is kcal. */
  perServing: number;
  unit: 'g' | 'kcal';
}

/**
 * Scale the per-100 panel to one serving.
 *
 * Only ever derived from `serving_quantity` — the number Open Food Facts has
 * already parsed out of the free-text serving size. Parsing "about 3 biscuits
 * (30g)" ourselves would be guesswork, and a wrong serving size silently
 * multiplies every figure on the panel by the wrong amount, which is worse than
 * showing no serving column at all.
 *
 * Returns an empty list when there is no serving to scale to, so the caller
 * simply renders the per-100 panel alone.
 */
export function buildServingRows(
  nutriments: Record<string, unknown> | null | undefined,
  servingQuantity: number | null | undefined,
  isDrink: boolean
): ServingRow[] {
  const grams = Number(servingQuantity);
  if (!nutriments || !Number.isFinite(grams) || grams <= 0) return [];

  const factor = grams / 100;
  const rows: ServingRow[] = [];

  const kcal = energyKcal(nutriments);
  if (kcal !== null) {
    rows.push({
      key: 'energy',
      label: 'Energy',
      perServing: kcal * factor,
      unit: 'kcal',
    });
  }

  for (const row of buildNutrientRows(nutriments, isDrink)) {
    rows.push({
      key: row.key,
      label: row.label,
      perServing: row.per100 * factor,
      unit: 'g',
    });
  }

  return rows;
}

/** Serving figures are small numbers; one decimal place unless it is whole. */
export function formatServing(row: ServingRow): string {
  const dp = row.unit === 'kcal' ? 0 : 1;
  const value = Number(row.perServing.toFixed(dp));
  return `${Number.isInteger(value) ? value : value.toFixed(dp)}${row.unit === 'kcal' ? ' kcal' : 'g'}`;
}
