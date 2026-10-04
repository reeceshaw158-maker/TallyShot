import { formatAdditives } from './nutrition';

/**
 * E-numbers in plain English.
 *
 * Deliberately a curated table rather than an AI call. Three reasons, in order
 * of importance:
 *
 *  1. A hallucinated additive description is a safety problem, not a cosmetic
 *     one. This is the part of the card a person with a sulphite sensitivity or
 *     a vegetarian actually acts on.
 *  2. It works offline and costs nothing, so it can be on every card rather
 *     than behind a button and a scan credit.
 *  3. These facts do not change. An additive's function is fixed by the
 *     regulation that authorises it.
 *
 * Every entry states what the substance *is* and what job it does in food.
 * Nothing here says whether it is good or bad for the reader — consistent with
 * the rest of the app, and because that question has no general answer.
 *
 * `note` carries only facts that are themselves label statements or sourcing
 * facts a reader may be choosing on: the warning six colours legally require,
 * which additives are animal-derived, and which are declarable allergens.
 */
export interface AdditiveInfo {
  /** e.g. "Tartrazine" */
  name: string;
  /** What job it does, in plain English. */
  role: string;
  /** A label-statement or sourcing fact, where one applies. */
  note?: string;
}

/**
 * The six colours that, under assimilated Regulation (EC) No 1333/2008, must
 * carry "may have an adverse effect on activity and attention in children" on
 * the label. Restating a legally required label statement, not adding a claim.
 */
const SOUTHAMPTON_NOTE =
  'Label must warn: may have an adverse effect on activity and attention in children.';

const SULPHITE_NOTE = 'Sulphites are a declarable allergen above 10mg/kg.';

export const ADDITIVE_INFO: Record<string, AdditiveInfo> = {
  // ---- Colours ----
  E100: { name: 'Curcumin', role: 'Yellow colour, from turmeric root.' },
  E101: { name: 'Riboflavin', role: 'Yellow colour. It is vitamin B2.' },
  E102: { name: 'Tartrazine', role: 'Synthetic yellow colour.', note: SOUTHAMPTON_NOTE },
  E104: { name: 'Quinoline Yellow', role: 'Synthetic yellow colour.', note: SOUTHAMPTON_NOTE },
  E110: { name: 'Sunset Yellow FCF', role: 'Synthetic orange-yellow colour.', note: SOUTHAMPTON_NOTE },
  E120: {
    name: 'Cochineal / Carmine',
    role: 'Red colour.',
    note: 'Made from insects — not vegetarian or vegan.',
  },
  E122: { name: 'Carmoisine', role: 'Synthetic red colour.', note: SOUTHAMPTON_NOTE },
  E124: { name: 'Ponceau 4R', role: 'Synthetic red colour.', note: SOUTHAMPTON_NOTE },
  E129: { name: 'Allura Red AC', role: 'Synthetic red colour.', note: SOUTHAMPTON_NOTE },
  E131: { name: 'Patent Blue V', role: 'Synthetic blue colour.' },
  E132: { name: 'Indigotine', role: 'Synthetic blue colour.' },
  E133: { name: 'Brilliant Blue FCF', role: 'Synthetic blue colour.' },
  E140: { name: 'Chlorophylls', role: 'Green colour, from plants.' },
  E141: { name: 'Copper complexes of chlorophylls', role: 'Stable green colour.' },
  E150: { name: 'Caramel colour', role: 'Brown colour, made by heating sugar.' },
  E150a: { name: 'Plain caramel', role: 'Brown colour, made by heating sugar.' },
  E150b: { name: 'Caustic sulphite caramel', role: 'Brown colour.' },
  E150c: { name: 'Ammonia caramel', role: 'Brown colour.' },
  E150d: { name: 'Sulphite ammonia caramel', role: 'Brown colour. The one in most colas.' },
  E153: { name: 'Vegetable carbon', role: 'Black colour, from charred plant material.' },
  E160a: { name: 'Carotenes', role: 'Orange-yellow colour. The pigment in carrots.' },
  E160b: { name: 'Annatto', role: 'Orange colour, from achiote seeds.' },
  E160c: { name: 'Paprika extract', role: 'Orange-red colour, from peppers.' },
  E160d: { name: 'Lycopene', role: 'Red colour. The pigment in tomatoes.' },
  E161b: { name: 'Lutein', role: 'Yellow colour, from marigold or leafy greens.' },
  E162: { name: 'Beetroot red', role: 'Red-purple colour, from beetroot.' },
  E163: { name: 'Anthocyanins', role: 'Red-purple colour, from berries and grape skins.' },
  E170: { name: 'Calcium carbonate', role: 'White colour and a calcium source. Chalk.' },
  E171: {
    name: 'Titanium dioxide',
    role: 'White colour.',
    note: 'No longer authorised as a food additive in the EU (since 2022); still permitted in GB.',
  },
  E172: { name: 'Iron oxides', role: 'Yellow, red and black colours.' },

  // ---- Preservatives ----
  E200: { name: 'Sorbic acid', role: 'Preservative — slows mould and yeast.' },
  E202: { name: 'Potassium sorbate', role: 'Preservative — slows mould and yeast.' },
  E210: { name: 'Benzoic acid', role: 'Preservative, mainly in acidic foods and drinks.' },
  E211: { name: 'Sodium benzoate', role: 'Preservative, mainly in soft drinks.' },
  E212: { name: 'Potassium benzoate', role: 'Preservative.' },
  E220: { name: 'Sulphur dioxide', role: 'Preservative and antioxidant.', note: SULPHITE_NOTE },
  E221: { name: 'Sodium sulphite', role: 'Preservative.', note: SULPHITE_NOTE },
  E222: { name: 'Sodium bisulphite', role: 'Preservative.', note: SULPHITE_NOTE },
  E223: { name: 'Sodium metabisulphite', role: 'Preservative.', note: SULPHITE_NOTE },
  E224: { name: 'Potassium metabisulphite', role: 'Preservative, common in wine.', note: SULPHITE_NOTE },
  E228: { name: 'Potassium bisulphite', role: 'Preservative.', note: SULPHITE_NOTE },
  E234: { name: 'Nisin', role: 'Preservative, produced by bacterial fermentation.' },
  E235: { name: 'Natamycin', role: 'Surface preservative on cheese and cured meats.' },
  E249: { name: 'Potassium nitrite', role: 'Curing salt for meat — colour and preservation.' },
  E250: { name: 'Sodium nitrite', role: 'Curing salt for meat. What makes bacon pink.' },
  E251: { name: 'Sodium nitrate', role: 'Curing salt for meat.' },
  E252: { name: 'Potassium nitrate', role: 'Curing salt. Traditional saltpetre.' },
  E260: { name: 'Acetic acid', role: 'Acid. Vinegar.' },
  E270: { name: 'Lactic acid', role: 'Acid, from fermentation. Gives yoghurt its tang.' },
  E280: { name: 'Propionic acid', role: 'Preservative — slows mould in bread.' },
  E282: { name: 'Calcium propionate', role: 'Preservative — slows mould in bread.' },
  E290: { name: 'Carbon dioxide', role: 'The gas in fizzy drinks; also a packaging gas.' },
  E296: { name: 'Malic acid', role: 'Sharp acid. The sourness in apples.' },

  // ---- Antioxidants and acidity regulators ----
  E300: { name: 'Ascorbic acid', role: 'Antioxidant. It is vitamin C.' },
  E301: { name: 'Sodium ascorbate', role: 'Antioxidant, a salt of vitamin C.' },
  E306: { name: 'Tocopherol-rich extract', role: 'Antioxidant. Natural vitamin E.' },
  E307: { name: 'Alpha-tocopherol', role: 'Antioxidant. Vitamin E.' },
  E316: { name: 'Sodium erythorbate', role: 'Antioxidant, keeps cured meat red.' },
  E320: { name: 'BHA', role: 'Synthetic antioxidant, stops fats going rancid.' },
  E321: { name: 'BHT', role: 'Synthetic antioxidant, stops fats going rancid.' },
  E322: {
    name: 'Lecithins',
    role: 'Emulsifier — keeps fat and water mixed.',
    note: 'Usually from soya or sunflower. Soya lecithin is a declarable allergen.',
  },
  E325: { name: 'Sodium lactate', role: 'Acidity regulator, and keeps food moist.' },
  E330: { name: 'Citric acid', role: 'Acid. The sourness in citrus fruit.' },
  E331: { name: 'Sodium citrates', role: 'Acidity regulator; also an emulsifying salt in cheese.' },
  E332: { name: 'Potassium citrates', role: 'Acidity regulator.' },
  E333: { name: 'Calcium citrates', role: 'Acidity regulator and firming agent.' },
  E334: { name: 'Tartaric acid', role: 'Acid, from grapes.' },
  E338: { name: 'Phosphoric acid', role: 'Acid. The sharpness in cola.' },
  E339: { name: 'Sodium phosphates', role: 'Acidity regulator and stabiliser.' },
  E340: { name: 'Potassium phosphates', role: 'Acidity regulator and stabiliser.' },
  E341: { name: 'Calcium phosphates', role: 'Raising agent, firming agent, anti-caking.' },
  E392: { name: 'Rosemary extract', role: 'Antioxidant, stops fats going rancid.' },

  // ---- Thickeners, stabilisers, emulsifiers ----
  E400: { name: 'Alginic acid', role: 'Thickener, from brown seaweed.' },
  E401: { name: 'Sodium alginate', role: 'Thickener, from seaweed.' },
  E406: { name: 'Agar', role: 'Gelling agent, from seaweed. A plant-based gelatine.' },
  E407: { name: 'Carrageenan', role: 'Thickener and gelling agent, from red seaweed.' },
  E410: { name: 'Locust bean gum', role: 'Thickener, from carob seeds.' },
  E412: { name: 'Guar gum', role: 'Thickener, from guar beans.' },
  E414: { name: 'Acacia gum', role: 'Thickener and glazing agent. Gum arabic.' },
  E415: { name: 'Xanthan gum', role: 'Thickener, made by fermentation.' },
  E418: { name: 'Gellan gum', role: 'Gelling agent, made by fermentation.' },
  E420: { name: 'Sorbitol', role: 'Sweetener; also keeps food moist.' },
  E421: { name: 'Mannitol', role: 'Sweetener and anti-caking agent.' },
  E422: { name: 'Glycerol', role: 'Humectant — keeps food soft and moist.' },
  E440: { name: 'Pectin', role: 'Gelling agent, from fruit. What sets jam.' },
  E450: { name: 'Diphosphates', role: 'Raising agent and stabiliser.' },
  E451: { name: 'Triphosphates', role: 'Stabiliser, holds water in meat and fish.' },
  E452: { name: 'Polyphosphates', role: 'Stabiliser and emulsifying salt.' },
  E460: { name: 'Cellulose', role: 'Bulking and anti-caking agent. Plant fibre.' },
  E461: { name: 'Methyl cellulose', role: 'Thickener, from plant fibre.' },
  E464: { name: 'Hydroxypropyl methyl cellulose', role: 'Thickener and emulsifier.' },
  E466: { name: 'Carboxymethyl cellulose', role: 'Thickener, common in ice cream.' },
  E471: {
    name: 'Mono- and diglycerides of fatty acids',
    role: 'Emulsifier — keeps fat and water mixed.',
    note: 'Can be from plant or animal fat; the label rarely says which.',
  },
  E472: { name: 'Esters of mono- and diglycerides', role: 'Emulsifier and dough conditioner.' },
  E476: { name: 'PGPR', role: 'Emulsifier — thins melted chocolate so it moulds cleanly.' },
  E481: { name: 'Sodium stearoyl-2-lactylate', role: 'Emulsifier and dough conditioner.' },
  E500: { name: 'Sodium carbonates', role: 'Raising agent. Bicarbonate of soda.' },
  E501: { name: 'Potassium carbonates', role: 'Raising agent and acidity regulator.' },
  E503: { name: 'Ammonium carbonates', role: 'Raising agent, traditional in biscuits.' },
  E504: { name: 'Magnesium carbonates', role: 'Anti-caking agent and acidity regulator.' },
  E508: { name: 'Potassium chloride', role: 'Salt substitute and stabiliser.' },
  E509: { name: 'Calcium chloride', role: 'Firming agent; also used in cheesemaking.' },
  E516: { name: 'Calcium sulphate', role: 'Firming agent and dough conditioner. Gypsum.' },
  E524: { name: 'Sodium hydroxide', role: 'Acidity regulator. What gives pretzels their crust.' },
  E551: { name: 'Silicon dioxide', role: 'Anti-caking agent — stops powders clumping.' },
  E553b: { name: 'Talc', role: 'Anti-caking and release agent.' },
  E575: { name: 'Glucono delta-lactone', role: 'Slow-acting acid, used in tofu and cured meats.' },

  // ---- Flavour enhancers ----
  E620: { name: 'Glutamic acid', role: 'Flavour enhancer — savoury depth (umami).' },
  E621: { name: 'Monosodium glutamate', role: 'Flavour enhancer — savoury depth (umami). MSG.' },
  E627: { name: 'Disodium guanylate', role: 'Flavour enhancer, usually paired with MSG.' },
  E631: {
    name: 'Disodium inosinate',
    role: 'Flavour enhancer, usually paired with MSG.',
    note: 'Often derived from fish or meat.',
  },
  E635: { name: 'Disodium ribonucleotides', role: 'Flavour enhancer — a blend of E627 and E631.' },

  // ---- Glazing agents ----
  E901: { name: 'Beeswax', role: 'Glazing agent.', note: 'From bees — not vegan.' },
  E903: { name: 'Carnauba wax', role: 'Glazing agent, from palm leaves.' },
  E904: { name: 'Shellac', role: 'Glazing agent.', note: 'From lac insects — not vegan.' },
  E920: {
    name: 'L-cysteine',
    role: 'Dough conditioner.',
    note: 'Can be from feathers, hair or fermentation.',
  },

  // ---- Sweeteners ----
  E950: { name: 'Acesulfame K', role: 'Sweetener, no calories.' },
  E951: {
    name: 'Aspartame',
    role: 'Sweetener, no calories.',
    note: 'Label must state it is a source of phenylalanine — this matters for people with PKU.',
  },
  E952: { name: 'Cyclamate', role: 'Sweetener, no calories.' },
  E954: { name: 'Saccharin', role: 'Sweetener, no calories.' },
  E955: { name: 'Sucralose', role: 'Sweetener, no calories. Made from sugar.' },
  E960: { name: 'Steviol glycosides', role: 'Sweetener from the stevia plant, no calories.' },
  E961: { name: 'Neotame', role: 'Sweetener, no calories.' },
  E965: { name: 'Maltitol', role: 'Sugar alcohol used as a sweetener.' },
  E967: { name: 'Xylitol', role: 'Sugar alcohol used as a sweetener.', note: 'Toxic to dogs.' },
  E968: { name: 'Erythritol', role: 'Sugar alcohol used as a sweetener.' },

  // ---- Other ----
  E999: { name: 'Quillaia extract', role: 'Foaming agent, from soapbark.' },
  E1105: {
    name: 'Lysozyme',
    role: 'Preservative, used in hard cheese.',
    note: 'From egg white — a declarable allergen.',
  },
  E1200: { name: 'Polydextrose', role: 'Bulking agent and a source of fibre.' },
  E1400: { name: 'Dextrin', role: 'Thickener, from starch.' },
  E1404: { name: 'Oxidised starch', role: 'Thickener.' },
  E1412: { name: 'Distarch phosphate', role: 'Thickener that survives heating and freezing.' },
  E1414: { name: 'Acetylated distarch phosphate', role: 'Thickener and stabiliser.' },
  E1422: { name: 'Acetylated distarch adipate', role: 'Thickener, stable when heated.' },
  E1442: { name: 'Hydroxypropyl distarch phosphate', role: 'Thickener, stable when heated.' },
  E1450: { name: 'Starch sodium octenyl succinate', role: 'Emulsifier and thickener.' },
  E1505: { name: 'Triethyl citrate', role: 'Carrier solvent for flavourings.' },
  E1510: { name: 'Ethanol', role: 'Carrier solvent for flavourings and colours.' },
  E1520: { name: 'Propylene glycol', role: 'Carrier solvent; also keeps food moist.' },
};

export interface ExplainedAdditive {
  code: string;
  info: AdditiveInfo | null;
}

/**
 * Pair each additive code with its explanation, where there is one.
 *
 * A code we do not recognise still comes back, with `info: null` — silently
 * dropping it would misrepresent what is in the product. Sub-variants fall back
 * to the base code (E472e → E472, E150d → E150), since those are variants of
 * the same substance family and share a function.
 */
export function explainAdditives(tags: string[] | null | undefined): ExplainedAdditive[] {
  return formatAdditives(tags).map((code) => {
    const exact = ADDITIVE_INFO[code];
    if (exact) return { code, info: exact };
    const base = code.match(/^(E\d{3,4})/)?.[1];
    return { code, info: (base && ADDITIVE_INFO[base]) || null };
  });
}

/** How many of the listed additives we can actually explain. */
export function explainedCount(list: ExplainedAdditive[]): number {
  return list.filter((a) => a.info).length;
}
