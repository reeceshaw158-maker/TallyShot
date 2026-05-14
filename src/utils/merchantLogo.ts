/**
 * Resolves a merchant name to a Clearbit logo URL.
 *
 * Strategy:
 * 1. Check DOMAIN_MAP for known merchants (keys are lowercase substrings)
 * 2. Fall back to cleaned name + ".com"
 * 3. Clearbit returns a 404 for unknown domains — callers should handle
 *    Image onError and fall back to a category icon.
 */

const DOMAIN_MAP: Record<string, string> = {
  // ── Food & Drink ─────────────────────────────────────────────────────────
  'mcdonalds': 'mcdonalds.com',
  "mcdonald's": 'mcdonalds.com',
  'starbucks': 'starbucks.com',
  'costa coffee': 'costa.co.uk',
  'costa': 'costa.co.uk',
  'greggs': 'greggs.co.uk',
  'pret a manger': 'pret.com',
  'pret': 'pret.com',
  'subway': 'subway.com',
  'kfc': 'kfc.com',
  'burger king': 'burgerking.com',
  'nandos': 'nandos.co.uk',
  "nando's": 'nandos.co.uk',
  "domino's": 'dominos.co.uk',
  'dominos': 'dominos.co.uk',
  'pizza hut': 'pizzahut.co.uk',
  'pizza express': 'pizzaexpress.com',
  'wagamama': 'wagamama.com',
  'j d wetherspoon': 'jdwetherspoon.com',
  'wetherspoon': 'jdwetherspoon.com',
  'spoons': 'jdwetherspoon.com',
  'itsu': 'itsu.com',
  'leon': 'leon.co',
  'five guys': 'fiveguys.co.uk',
  'chipotle': 'chipotle.com',
  'tim hortons': 'timhortons.com',
  'caffe nero': 'caffenero.com',
  'cafe nero': 'caffenero.com',
  'nero': 'caffenero.com',
  'eat': 'eat.co.uk',

  // ── Supermarkets ─────────────────────────────────────────────────────────
  'tesco': 'tesco.com',
  'sainsbury': 'sainsburys.co.uk',
  'asda': 'asda.com',
  'morrisons': 'morrisons.com',
  'waitrose': 'waitrose.com',
  'marks & spencer': 'marksandspencer.com',
  'm&s': 'marksandspencer.com',
  'marks and spencer': 'marksandspencer.com',
  'lidl': 'lidl.co.uk',
  'aldi': 'aldi.co.uk',
  'iceland': 'iceland.co.uk',
  'co-op': 'coop.co.uk',
  'the co-operative': 'coop.co.uk',
  'costco': 'costco.co.uk',
  'whole foods': 'wholefoods.com',
  'wholefoods': 'wholefoods.com',
  'walmart': 'walmart.com',
  'target': 'target.com',
  'kroger': 'kroger.com',
  'trader joe': 'traderjoes.com',
  'spar': 'spar.co.uk',
  'budgens': 'budgens.co.uk',

  // ── Tech & Subscriptions ──────────────────────────────────────────────────
  'apple': 'apple.com',
  'amazon': 'amazon.co.uk',
  'google': 'google.com',
  'microsoft': 'microsoft.com',
  'adobe': 'adobe.com',
  'dropbox': 'dropbox.com',
  'slack': 'slack.com',
  'zoom': 'zoom.us',
  'notion': 'notion.so',
  'shopify': 'shopify.com',
  'stripe': 'stripe.com',
  'github': 'github.com',
  'netlify': 'netlify.com',
  'vercel': 'vercel.com',
  'aws': 'aws.amazon.com',
  'spotify': 'spotify.com',
  'netflix': 'netflix.com',
  'disney': 'disneyplus.com',
  'currys': 'currys.co.uk',
  'pc world': 'currys.co.uk',
  'argos': 'argos.co.uk',
  'john lewis': 'johnlewis.com',
  'harvey norman': 'harveynorman.com.au',

  // ── Travel & Transport ────────────────────────────────────────────────────
  'uber': 'uber.com',
  'lyft': 'lyft.com',
  'bolt': 'bolt.eu',
  'trainline': 'thetrainline.com',
  'the trainline': 'thetrainline.com',
  'national rail': 'nationalrail.co.uk',
  'tfl': 'tfl.gov.uk',
  'transport for london': 'tfl.gov.uk',
  'eurostar': 'eurostar.com',
  'british airways': 'britishairways.com',
  'easyjet': 'easyjet.com',
  'ryanair': 'ryanair.com',
  'jet2': 'jet2.com',
  'wizz air': 'wizzair.com',
  'emirates': 'emirates.com',
  'virgin atlantic': 'virginatlantic.com',
  'enterprise': 'enterprise.co.uk',
  'hertz': 'hertz.co.uk',
  'holiday inn': 'holidayinn.com',
  'premier inn': 'premierinn.com',
  'travelodge': 'travelodge.co.uk',
  'airbnb': 'airbnb.com',
  'booking.com': 'booking.com',
  'hilton': 'hilton.com',
  'marriott': 'marriott.com',
  'hyatt': 'hyatt.com',

  // ── Fuel ─────────────────────────────────────────────────────────────────
  'bp': 'bp.com',
  'shell': 'shell.co.uk',
  'esso': 'esso.co.uk',
  'texaco': 'texaco.co.uk',
  'moto': 'moto-way.com',
  'motorway services': 'moto-way.com',

  // ── Finance & Services ────────────────────────────────────────────────────
  'paypal': 'paypal.com',
  'hsbc': 'hsbc.co.uk',
  'barclays': 'barclays.co.uk',
  'natwest': 'natwest.com',
  'lloyds': 'lloyds.com',
  'monzo': 'monzo.com',
  'revolut': 'revolut.com',
  'starling': 'starlingbank.com',
  'wise': 'wise.com',
  'transferwise': 'wise.com',
  'american express': 'americanexpress.com',
  'amex': 'americanexpress.com',

  // ── Health ────────────────────────────────────────────────────────────────
  'boots': 'boots.com',
  'superdrug': 'superdrug.com',
  'specsavers': 'specsavers.com',
  'lloyds pharmacy': 'lloydsdirectpharmacy.co.uk',
  'cvs': 'cvs.com',
  'walgreens': 'walgreens.com',

  // ── UK Utilities / Telecoms ───────────────────────────────────────────────
  'vodafone': 'vodafone.co.uk',
  'ee': 'ee.co.uk',
  'o2': 'o2.co.uk',
  'three': 'three.co.uk',
  'bt': 'bt.com',
  'virgin media': 'virginmedia.com',
  'sky': 'sky.com',
  'talktalk': 'talktalk.co.uk',
  'plusnet': 'plus.net',
  'bulb': 'bulb.co.uk',
  'octopus energy': 'octopus.energy',
  'octopus': 'octopus.energy',
  'british gas': 'britishgas.co.uk',
  'eon': 'eon.co.uk',
  'e.on': 'eon.co.uk',
  'scottish power': 'scottishpower.co.uk',
  'thames water': 'thameswater.co.uk',
  'severn trent': 'stwater.co.uk',

  // ── Postal & Delivery ─────────────────────────────────────────────────────
  'royal mail': 'royalmail.com',
  'dpd': 'dpd.co.uk',
  'evri': 'evri.com',
  'hermes': 'evri.com',
  'parcelforce': 'parcelforce.com',
  'ups': 'ups.com',
  'fedex': 'fedex.com',
  'dhl': 'dhl.com',
  'yodel': 'yodel.co.uk',

  // ── Home & DIY ────────────────────────────────────────────────────────────
  'ikea': 'ikea.com',
  'b&q': 'diy.com',
  'homebase': 'homebase.co.uk',
  'screwfix': 'screwfix.com',
  'toolstation': 'toolstation.com',
  'halfords': 'halfords.com',
  'dunelm': 'dunelm.com',
  'next': 'next.co.uk',
  'h&m': 'hm.com',
  'zara': 'zara.com',
  'primark': 'primark.com',
  'nike': 'nike.com',
  'adidas': 'adidas.co.uk',
  'jd sports': 'jdsports.co.uk',
  'sports direct': 'sportsdirect.com',
};

/**
 * Turn a merchant name into a Clearbit logo URL.
 * Returns null if the name is blank.
 */
export function getMerchantLogoUrl(merchant: string): string | null {
  if (!merchant?.trim()) return null;

  const lower = merchant.toLowerCase().trim();

  // Check domain map — longest match wins (iterate all, pick longest key that matches)
  let bestDomain: string | null = null;
  let bestKeyLen = 0;
  for (const [fragment, domain] of Object.entries(DOMAIN_MAP)) {
    if (lower.includes(fragment) && fragment.length > bestKeyLen) {
      bestDomain = domain;
      bestKeyLen = fragment.length;
    }
  }
  if (bestDomain) return `https://logo.clearbit.com/${bestDomain}?size=80`;

  // Fallback: strip company suffixes, punctuation, spaces → try {name}.com
  const cleaned = lower
    .replace(/\s+(ltd|limited|inc|llc|plc|gmbh|sa|pty|co\.?\s*ltd)\.?\s*$/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  if (!cleaned || cleaned.length < 3) return null;
  return `https://logo.clearbit.com/${cleaned}.com?size=80`;
}
