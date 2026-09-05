/**
 * Product category classifier for flyer / ecom titles.
 *
 * Standing quality bar:
 * - Prefer explicit product-type phrases (canned beans, yogurt, chicken breast,
 *   shampoo) over weak secondary words (organic alone, cream- prefix).
 * - Word-bound short tokens so egg⊂veggies, ham⊂chamomile never fire.
 * - Order matters: strong pantry / beauty / household before dairy / produce.
 */
import type { CategoryId } from '../types';

export interface CategoryGuessInput {
  name?: string | null;
  l1?: string | null;
  l2?: string | null;
  saleStory?: string | null;
}

function blobOf(input: CategoryGuessInput | string): string {
  if (typeof input === 'string') return input.toLowerCase();
  return `${input.name || ''} ${input.l1 || ''} ${input.l2 || ''} ${input.saleStory || ''}`.toLowerCase();
}

/** Guess CategoryId from a product title (string) or Flipp-like fields. */
export function guessCategory(input: CategoryGuessInput | string): CategoryId {
  const blob = blobOf(input);

  // --- Alcohol (cooking wine vinegar stays pantry via later rules / exclusion) ---
  if (
    /\b(?:beer|vodka|liquor|prosecco|spirits|whiskey|whisky|tequila|rum|champagne|hard\s+seltzer|alcoholic)\b/.test(
      blob,
    ) ||
    (/\bwine\b/.test(blob) && !/\bwine\s+vinegar\b/.test(blob)) ||
    (/\bseltzer\b/.test(blob) && !/\bseltzer\s+water\b/.test(blob))
  ) {
    return 'alcohol';
  }

  // --- Beauty / personal care before household ---
  if (
    /\b(?:shampoo|conditioner|makeup|mascara|lipstick|foundation|concealer|eyeliner|hair\s*dye|hair\s*color|salon|body\s*wash|bodywash|skincare|skin\s*care|moisturizer|deodorant|antiperspirant|toothpaste|toothbrush|mouthwash|floss|razor|shaving|sunscreen|beauty|cosmetic|facial|serum)\b/.test(
      blob,
    ) ||
    (/\blotion\b/.test(blob) && !/\b(?:laundry|fabric|dish)\b/.test(blob))
  ) {
    return 'beauty';
  }

  // --- Household / cleaning / paper ---
  if (
    /\b(?:detergent|cleaner|disinfectant|bleach|paper\s*towels?|toilet\s*paper|tissue|trash|garbage\s*bags?|household|laundry|fabric\s*softener|dish\s*soap|dishwashing|hand\s*soap|bar\s*soap|sponges?|napkins?)\b/.test(
      blob,
    ) ||
    (/\bsoap\b/.test(blob) && !/\b(?:soup|soft\s*soap)\b/.test(blob))
  ) {
    return 'household';
  }

  // Tortillas / soft bakery phrases before pantry "flour"
  if (/\b(?:flour|corn)\s+tortillas?\b|\btortillas?\b/.test(blob)) return 'bakery';

  // --- Strong pantry BEFORE dairy/produce ---
  // Catches: canned beans/veggies (egg⊂veggies), vegetable oil, peanut butter, pasta sauce
  if (isStrongPantry(blob)) return 'pantry';

  // --- Snacks ---
  if (
    /\b(?:chips?|cookies?|crackers?|snacks?|popcorn|pretzels?|candy|candies|granola\s+bars?|trail\s+mix)\b/.test(
      blob,
    )
  ) {
    return 'snacks';
  }

  // --- Bakery ---
  if (
    /\b(?:bread|bagels?|bakery|croissants?|muffins?|dinner\s+rolls?|hamburger\s+buns?|hot\s+dog\s+buns?|tortillas?|pita|naan|biscuits?|buns?)\b/.test(
      blob,
    )
  ) {
    return 'bakery';
  }

  // --- Frozen before dairy (ice cream ≠ cream) ---
  if (
    /\b(?:frozen|ice\s*creams?|gelato|burritos?|waffles?)\b/.test(blob) ||
    (/\bpizza\b/.test(blob) && !/\bpizza\s+sauce\b/.test(blob))
  ) {
    return 'frozen';
  }

  // --- Dairy & eggs (never bare /egg/ — veggies contains "egg") ---
  if (
    /\b(?:milk|eggs?|egg\s+whites?|cheeses?|yogurt|yoghurt|butter|cream\s+cheese|sour\s+cream|heavy\s+cream|whipping\s+cream|half\s+and\s+half|dairy|cottage\s+cheese|creamers?)\b/.test(
      blob,
    ) &&
    !/\b(?:peanut|almond|cashew|sunflower)\s+butter\b/.test(blob) &&
    !/\bice\s*creams?\b/.test(blob)
  ) {
    return 'dairy';
  }

  // --- Deli / prepared ---
  if (
    /\b(?:deli|rotisserie|ready\s+meals?|prepared)\b/.test(blob) ||
    /\b(?:ham|salami|bologna|prosciutto)\b/.test(blob) ||
    /\bsliced\s+(?:turkey|chicken|roast\s+beef|ham|cheese)\b/.test(blob)
  ) {
    return 'deli';
  }

  // --- Meat / seafood ---
  if (isMeat(blob)) return 'meat';

  // --- Produce (no lone "organic"; oils already pantry) ---
  if (isProduce(blob)) return 'produce';

  return 'pantry';
}

function isStrongPantry(blob: string): boolean {
  if (/\bwine\s+vinegar\b|\b(?:apple\s+cider|balsamic|white|red\s+wine)\s+vinegar\b/.test(blob)) {
    return true;
  }
  if (/\b(?:peanut|almond|cashew|sunflower)\s+butter\b/.test(blob)) return true;
  if (/\b(?:olive|vegetable|canola|avocado|coconut|cooking)\s+oils?\b/.test(blob)) return true;
  if (/\b(?:tomato|pasta|marinara|alfredo|pizza)\s+sauces?\b/.test(blob)) return true;
  if (
    /\b(?:pasta|spaghetti|macaroni|rice|cereal|oats|oatmeal|soup|broths?|stocks?|sugar|pantry)\b/.test(
      blob,
    ) ||
    (/\bflour\b/.test(blob) && !/\bflour\s+tortillas?\b/.test(blob))
  ) {
    return true;
  }
  // Canned goods (beans, veggies, tuna, etc.)
  if (/\bcanned\b|\bcan\s+of\b/.test(blob)) return true;
  if (/\bbeans?\s+or\s+(?:vegg(?:ie|ies|y)|vegetables?)\b/.test(blob)) return true;
  if (
    /\b(?:black|pinto|kidney|garbanzo|refried|baked|cannellini|great\s+northern)\s+beans?\b/.test(
      blob,
    )
  ) {
    return true;
  }
  if (/\b(?:chick\s*peas?|garbanzos?)\b/.test(blob)) return true;
  // Generic "beans" staple cans — not green/coffee/jelly
  if (
    /\bbeans?\b/.test(blob) &&
    !/\b(?:green|string|coffee|jelly|vanilla|wax)\s+beans?\b/.test(blob) &&
    !/\bbean\s+sprouts?\b/.test(blob)
  ) {
    return true;
  }
  return false;
}

function isMeat(blob: string): boolean {
  if (
    /\b(?:beef|pork|turkey|sausage|steak|seafood|shrimp|bacon|lamb|meat|ribs?|prime\s+rib|meatballs?)\b/.test(
      blob,
    )
  ) {
    return true;
  }
  if (/\bground\s+(?:beef|turkey|chicken|pork|chuck|meat|sirloin)\b/.test(blob)) return true;
  if (
    /\b(?:chicken\s+(?:breast|thigh|wing|drum|tender|whole|cutlet|leg|legs)s?|whole\s+chicken)\b/.test(
      blob,
    )
  ) {
    return true;
  }
  // Plain "chicken" — not broth/soup/canned
  if (
    /\bchicken\b/.test(blob) &&
    !/\b(?:broth|stock|soup|canned|can\b|pouch|bouillon)\b/.test(blob)
  ) {
    return true;
  }
  if (/\bsalmon\b/.test(blob) && !/\bcanned\s+salmon\b/.test(blob)) return true;
  return false;
}

function isProduce(blob: string): boolean {
  if (
    /\b(?:produce|fruits?|vegetables?|avocados?|bananas?|berr(?:y|ies)|strawberr(?:y|ies)|blueberr(?:y|ies)|apples?|lettuce|broccoli|spinach|kale|grapes?|onions?|potatoes?|carrots?|cucumbers?|celery|mangos?|mangoes?|pineapple|watermelon|lemons?|limes?|garlic|salad\s+mix|spring\s+mix|green\s+beans?)\b/.test(
      blob,
    )
  ) {
    return true;
  }
  if (
    /\b(?:tomatoes?|peppers?)\b/.test(blob) &&
    !/\b(?:sauce|soup|canned|paste|salsa|chips?)\b/.test(blob)
  ) {
    return true;
  }
  if (
    /\bsalad\b/.test(blob) &&
    !/\b(?:dressing|chicken\s+salad|tuna\s+salad|potato\s+salad|pasta\s+salad)\b/.test(blob)
  ) {
    return true;
  }
  return false;
}
