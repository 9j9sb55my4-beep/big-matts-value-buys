/** Normalize item names for history + cross-store matching */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(
      /\b(organic|fresh|premium|select|selected|family pack|pk|pack|assorted|canned)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip common brand tokens so Jewel brand SKUs match Aldi/Target generics */
function stripBrands(n: string): string {
  return n
    .replace(
      /\b(la preferida|goya|bush'?s|bushs|ro tel|rosarita|signature|open nature|lucerne|just bare|dakota'?s? pride|dakotas pride|great value|good ?&? gather|market pantry|favorite day|priano|reggano|clancy'?s|never any|friendly farms|specially selected|appleton farms|casa mamita|kirkwood|little salad|up ?&? up|oroweat|boar'?s head|barilla|rao'?s|lay'?s|bounty|tide|digiorno|ben ?&? jerry'?s|tillamook|white claw|la marca|nuestro queso|sargento|kraft|crystal farms|happy farms|emporium selection)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Staple commodity matchers — brand-specific Jewel items match generic Aldi staples.
 *
 * Keep aliases tight: match regional/brand naming for the SAME commodity
 * (e.g. Oaxaca ↔ Mexican shredded cheese / quesadilla cheese) without
 * collapsing all "cheese" or all "yogurt" into one bucket.
 */
const STAPLE_ALIASES: [RegExp, string][] = [
  [/\bblack beans?\b/, 'black beans'],
  [/\bpinto beans?\b/, 'pinto beans'],
  [/\b(chick\s*peas?|garbanzo)\b/, 'chickpeas'],
  [/\bkidney beans?\b/, 'kidney beans'],
  [/\brefried beans?\b/, 'refried beans'],
  [/\bbaked beans?\b/, 'baked beans'],
  [/\bcannellini|\bgreat northern beans?\b/, 'white beans'],
  // Mexican-style shreds: Jewel "Nuestro Queso Shredded Oaxaca" ↔ Aldi "Mexican shredded cheese"
  [
    /\boaxaca\b|\bquesadilla cheese\b|\bmexican shredded(?:\s+cheese)?\b|\bshredded mexican(?:\s+cheese)?\b|\bshredded oaxaca\b/,
    'mexican shredded cheese',
  ],
  [/\bshredded cheddar\b|\bcheddar shredded\b|\bcheddar cheese shredded\b/, 'shredded cheddar'],
  [
    /\bshredded mozzarella\b|\bmozzarella shredded\b|\bmozzarella cheese shredded\b/,
    'shredded mozzarella',
  ],
  [/\bgreek yogurt\b/, 'greek yogurt'],
  [/\bsour cream\b/, 'sour cream'],
  [/\bcottage cheese\b/, 'cottage cheese'],
  [/\bcream cheese\b/, 'cream cheese'],
  [/\bflour tortillas?\b/, 'flour tortillas'],
  [/\bcorn tortillas?\b/, 'corn tortillas'],
  [/\bitalian sausage\b/, 'italian sausage'],
  [/\bchicken breast/, 'chicken breast'],
  [/\bground (beef|chuck)\b/, 'ground beef'],
  [/\beggs?\b/, 'eggs'],
  [/\bwhole milk\b/, 'whole milk'],
  [/\bavocados?\b/, 'avocado'],
  [/\bstrawberr(?:y|ies)\b/, 'strawberries'],
  [/\bbananas?\b/, 'bananas'],
  [/\bpaper towels?\b/, 'paper towels'],
  [/\blaundry detergent\b|\btide pods?\b|\bdetergent (?:pods?|tiles?|pacs?)\b/, 'laundry detergent'],
  [/\bdish(?:washer)? detergent\b/, 'dish detergent'],
  [/\bpasta\b(?! sauce)/, 'pasta'],
  [/\bpasta sauce\b|\bmarinara\b/, 'pasta sauce'],
  [/\bice cream\b/, 'ice cream'],
  [/\bpizza\b/, 'pizza'],
  [/\bbutter\b/, 'butter'],
  [/\bbread\b/, 'bread'],
  [/\bpotato chips?\b|\bchips\b/, 'chips'],
];

const STAPLE_KEY_SET = new Set(STAPLE_ALIASES.map(([, key]) => key));

/** True when a similarity key is a known staple commodity (not a fallback name). */
export function isStapleKey(key: string): boolean {
  return STAPLE_KEY_SET.has(key);
}

/**
 * All staple similarity keys for a name.
 * Multi-item ads ("pinto beans, black beans or chickpeas") yield multiple keys
 * so brand-specific Jewel rows still match Aldi everyday staples.
 */
export function similarityKeys(name: string): string[] {
  const n = stripBrands(normalizeName(name));
  const keys: string[] = [];
  for (const [re, key] of STAPLE_ALIASES) {
    if (re.test(n)) keys.push(key);
  }
  if (keys.length > 0) return [...new Set(keys)];
  // Fallback: single loose key
  return [similarityKey(name)];
}

/** Primary similarity key (first staple match, else cleaned name) */
export function similarityKey(name: string): string {
  const n = stripBrands(normalizeName(name));
  for (const [re, key] of STAPLE_ALIASES) {
    if (re.test(n)) return key;
  }
  // Drop size noise for looser matching
  return n
    .replace(/\b\d+(\.\d+)?\s*(oz|lb|ct|pk|pack|gallon|ml|g)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || normalizeName(name);
}

/** True when two product names refer to the same staple commodity */
export function namesMatchStaple(a: string, b: string): boolean {
  const ka = new Set(similarityKeys(a));
  const kb = similarityKeys(b);
  return kb.some((k) => ka.has(k));
}
