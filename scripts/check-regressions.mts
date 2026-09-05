/**
 * Regression checks for category collisions + Aldi↔Jewel bean ranking.
 * Run: npx tsx scripts/check-regressions.mts
 */
import { guessCategory } from '../src/lib/guessCategory.ts';
import { similarityKeys, namesMatchStaple } from '../src/lib/normalize.ts';
import { parseDealSize } from '../src/lib/sizeParse.ts';
import {
  addCrossStoreHints,
  makeReferencePrice,
  rankDeals,
} from '../src/lib/ranking.ts';
import type { Deal } from '../src/types.ts';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed++;
    console.error('FAIL:', msg);
  } else {
    console.log('ok:', msg);
  }
}

/** Broad category fixtures — standing quality bar across aisles */
const CATEGORY_FIXTURES: [string, string][] = [
  // Pantry / canned — the original bug (egg ⊂ veggies → dairy)
  ['Goya Canned Beans or Veggies', 'pantry'],
  ['La Preferida Pinto Beans, Black Beans or Chickpeas', 'pantry'],
  ["Dakota's Pride Black Beans", 'pantry'],
  ["Bush's Best Baked Beans", 'pantry'],
  ['Goya Black Beans', 'pantry'],
  ['Canned Corn', 'pantry'],
  ['Vegetable Oil 48 oz', 'pantry'],
  ['Peanut Butter', 'pantry'],
  ['Barilla Spaghetti', 'pantry'],
  ['Wine Vinegar', 'pantry'],
  // Dairy (must still work with word boundaries)
  ['Lucerne Whole Milk', 'dairy'],
  ['Friendly Farms Large Eggs', 'dairy'],
  ['Dozen Eggs', 'dairy'],
  ['Sargento Shredded Cheddar Cheese', 'dairy'],
  ['Greek Yogurt', 'dairy'],
  ['Salted Butter', 'dairy'],
  ['Philadelphia Cream Cheese', 'dairy'],
  // Meat
  ['Chicken Breast Boneless', 'meat'],
  ['Ground Beef 80/20', 'meat'],
  ['Italian Sausage', 'meat'],
  ['Pork Chops', 'meat'],
  // Produce
  ['Hass Avocados', 'produce'],
  ['Bananas', 'produce'],
  ['Strawberries 1 lb', 'produce'],
  ['Green Beans', 'produce'],
  // Household
  ['Tide Liquid Laundry Detergent', 'household'],
  ['Bounty Paper Towels', 'household'],
  ['Dawn Dish Soap', 'household'],
  // Beauty
  ['Pantene Shampoo', 'beauty'],
  ['Dove Deodorant', 'beauty'],
  ['Colgate Toothpaste', 'beauty'],
  // Frozen
  ['DiGiorno Frozen Pizza', 'frozen'],
  ["Ben & Jerry's Ice Cream", 'frozen'],
  // Bakery
  ['Oroweat Whole Wheat Bread', 'bakery'],
  ['Flour Tortillas', 'bakery'],
  // Snacks
  ["Lay's Potato Chips", 'snacks'],
  // Alcohol / beverages
  ['La Marca Prosecco', 'alcohol'],
  ['White Claw Hard Seltzer', 'alcohol'],
  // Deli
  ["Boar's Head Sliced Turkey", 'deli'],
];

console.log('\n== Category fixtures ==');
for (const [title, expected] of CATEGORY_FIXTURES) {
  const got = guessCategory(title);
  assert(got === expected, `category("${title}") → ${got} (expected ${expected})`);
}

console.log('\n== Bean staple matching ==');
const goyaKeys = similarityKeys('Goya Canned Beans or Veggies');
assert(
  goyaKeys.includes('canned beans') || goyaKeys.includes('black beans'),
  `Goya beans keys include bean staples: ${JSON.stringify(goyaKeys)}`,
);
assert(
  namesMatchStaple('Goya Canned Beans or Veggies', "Dakota's Pride Black Beans"),
  'Goya multi-bean ad matches Aldi black beans',
);
assert(
  namesMatchStaple('Goya Canned Beans or Veggies', "Dakota's Pride Pinto Beans"),
  'Goya multi-bean ad matches Aldi pinto beans',
);
assert(
  namesMatchStaple(
    'La Preferida Pinto Beans, Black Beans or Chickpeas',
    "Dakota's Pride Chickpeas",
  ),
  'La Preferida multi matches Aldi chickpeas',
);

console.log('\n== Canned size soft parse ==');
const sized = parseDealSize({ name: 'Goya Canned Beans or Veggies' });
assert(!!sized?.label && !/not listed/i.test(sized.label), `size label: ${sized?.label}`);
assert(!!sized?.ambiguous, 'canned soft size is ambiguous (no fake $/oz)');

console.log('\n== Cross-store ranking: Jewel BOGO must not stay Best vs cheaper Aldi ==');
const jewel: Deal = {
  id: 'jewel-goya',
  store: 'jewel-osco',
  storeLabel: 'Jewel-Osco',
  category: 'pantry',
  name: 'Goya Canned Beans or Veggies',
  normalizedName: 'goya beans or veggies',
  price: 2.49,
  regPrice: 2.49,
  bogo: true,
  validFrom: '2026-08-26',
  validTo: '2026-09-16',
  promoType: 'bogo',
};
const scored = rankDeals([jewel], null);
const refs = [
  makeReferencePrice('aldi', "Dakota's Pride Black Beans", 0.95, 'everyday'),
  makeReferencePrice('aldi', "Dakota's Pride Pinto Beans", 0.95, 'everyday'),
];
const annotated = addCrossStoreHints(scored, null, refs);
const d = annotated[0];
assert(!d.isCrossStoreWinner, 'Jewel Goya is NOT cross-store winner when Aldi cheaper');
assert(!!d.crossStore, 'Jewel Goya has crossStore Aldi flag');
assert(
  d.crossStore?.store === 'aldi',
  `crossStore.store is aldi (got ${d.crossStore?.store})`,
);
assert(
  !!d.crossStore?.proofUrl && /aldi/i.test(d.crossStore.proofUrl),
  `proofUrl points at Aldi: ${d.crossStore?.proofUrl}`,
);
assert(
  (d.effectivePrice ?? 0) <= 1.25 + 0.001,
  `BOGO effective ~$1.25 (got ${d.effectivePrice})`,
);

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll regression checks passed.');
