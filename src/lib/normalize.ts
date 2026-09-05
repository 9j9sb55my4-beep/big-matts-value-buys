/** Normalize item names for history + cross-store matching */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(organic|fresh|premium|select|selected|family pack|pk|pack)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Loose similarity for cross-store compare (chicken breast, italian sausage, eggs, etc.) */
export function similarityKey(name: string): string {
  const n = normalizeName(name);
  const aliases: [RegExp, string][] = [
    [/\bitalian sausage\b/, 'italian sausage'],
    [/\bchicken breast/, 'chicken breast'],
    [/\bground (beef|chuck)\b/, 'ground beef'],
    [/\beggs?\b/, 'eggs'],
    [/\bwhole milk\b/, 'whole milk'],
    [/\bavocados?\b/, 'avocado'],
    [/\bpaper towels?\b/, 'paper towels'],
    [/\bpasta\b(?! sauce)/, 'pasta'],
    [/\bice cream\b/, 'ice cream'],
    [/\bpizza\b/, 'pizza'],
  ];
  for (const [re, key] of aliases) {
    if (re.test(n)) return key;
  }
  return n;
}
