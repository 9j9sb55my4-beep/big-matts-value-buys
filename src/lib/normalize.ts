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
      /\b(la preferida|goya|bush'?s|bushs|ro tel|rosarita|signature|open nature|lucerne|just bare|dakota'?s? pride|dakotas pride|great value|good ?&? gather|market pantry|favorite day|priano|reggano|clancy'?s|never any|friendly farms|specially selected|appleton farms|casa mamita|kirkwood|little salad|up ?&? up|oroweat|boar'?s head|barilla|rao'?s|lay'?s|bounty|tide|digiorno|ben ?&? jerry'?s|tillamook|white claw|la marca)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/** Staple commodity matchers — brand-specific Jewel items match generic Aldi staples */
const STAPLE_ALIASES: [RegExp, string][] = [
  [/\bblack beans?\b/, 'black beans'],
  [/\bpinto beans?\b/, 'pinto beans'],
  [/\b(chick\s*peas?|garbanzo)\b/, 'chickpeas'],
  [/\bkidney beans?\b/, 'kidney beans'],
  [/\brefried beans?\b/, 'refried beans'],
  [/\bbaked beans?\b/, 'baked beans'],
  [/\bcannellini|\bgreat northern beans?\b/, 'white beans'],
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
