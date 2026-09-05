/**
 * Parse package size + unit from Flipp post/pre price text, sale story, and product name.
 * Used for display and fair unit-price cross-store comparison.
 */

export type SizeUnit =
  | 'oz'
  | 'fl oz'
  | 'lb'
  | 'ct'
  | 'loads'
  | 'pk'
  | 'each'
  | 'gallon'
  | 'ml'
  | 'qt'
  | 'rolls';

export interface ParsedSize {
  /** Human label, e.g. "100 oz", "42 ct", "per lb" */
  label: string;
  /** Canonical unit for unit-price math / compare */
  unit: SizeUnit;
  /** Quantity to divide package price by (1 for per-lb / each) */
  qty: number;
  /** True when ad price is already per-unit (per lb, each) */
  isPerUnit: boolean;
  /** Multi-option / range ad — show size, skip unitPrice */
  ambiguous?: boolean;
}

/** Units that can share a unit-price comparison bucket */
export function comparableUnit(unit: string | undefined): string | undefined {
  if (!unit) return undefined;
  const u = unit.toLowerCase().trim();
  if (u === 'fl oz' || u === 'floz' || u === 'fluid oz') return 'oz';
  if (u === 'pound' || u === 'pounds' || u === 'lb') return 'lb';
  if (u === 'count' || u === 'counts' || u === 'cd' || u === 'ct') return 'ct';
  if (u === 'pack' || u === 'packs' || u === 'pk') return 'pk';
  if (u === 'load' || u === 'loads') return 'loads';
  if (u === 'gal' || u === 'gallon' || u === 'gallons') return 'gallon';
  if (u === 'ea' || u === 'each') return 'each';
  if (u === 'roll' || u === 'rolls') return 'rolls';
  if (u === 'oz' || u === 'ml' || u === 'qt') return u;
  return u;
}

function canonUnit(raw: string): SizeUnit | undefined {
  const u = raw.toLowerCase().replace(/\./g, '').trim();
  if (u === 'fl oz' || u === 'floz' || u === 'fluid oz' || u === 'fluid ounce' || u === 'fluid ounces')
    return 'fl oz';
  if (u === 'oz' || u === 'ounce' || u === 'ounces') return 'oz';
  if (u === 'lb' || u === 'lbs' || u === 'pound' || u === 'pounds') return 'lb';
  if (u === 'ct' || u === 'count' || u === 'counts' || u === 'cd') return 'ct';
  if (u === 'load' || u === 'loads') return 'loads';
  if (u === 'pk' || u === 'pack' || u === 'packs') return 'pk';
  if (u === 'ea' || u === 'each') return 'each';
  if (u === 'gal' || u === 'gallon' || u === 'gallons') return 'gallon';
  if (u === 'ml' || u === 'milliliter' || u === 'milliliters') return 'ml';
  if (u === 'qt' || u === 'quart' || u === 'quarts') return 'qt';
  if (u === 'roll' || u === 'rolls') return 'rolls';
  return undefined;
}

function formatLabel(qty: number, unit: SizeUnit, isPerUnit: boolean): string {
  if (isPerUnit) {
    if (unit === 'lb') return 'per lb';
    if (unit === 'each') return 'each';
    return `per ${unit}`;
  }
  const q = Number.isInteger(qty) ? String(qty) : String(Math.round(qty * 100) / 100);
  if (unit === 'fl oz') return `${q} fl oz`;
  if (unit === 'ct') return `${q} ct`;
  if (unit === 'loads') return `${q} loads`;
  if (unit === 'pk') return `${q} pk`;
  if (unit === 'rolls') return `${q} rolls`;
  if (unit === 'gallon') return qty === 1 ? 'gallon' : `${q} gallon`;
  return `${q} ${unit}`;
}

/** Match N x M unit (e.g. 4 x 5.3 oz) */
const MULTI_PACK =
  /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(fl\.?\s*oz|fluid\s*oz|oz|lb|lbs|ct|count|cd|loads?|pk|packs?|rolls?|ml|qt|gallons?|gal)\b/i;

/** Range like 117-132 oz */
const RANGE =
  /(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(fl\.?\s*oz|fluid\s*oz|oz|lb|lbs|ct|count|cd|loads?|pk|packs?|rolls?|ml|qt)\b/i;

/** Single qty+unit */
const SINGLE =
  /(\d+(?:\.\d+)?)\s*-?\s*(fl\.?\s*oz|fluid\s*oz|oz|lb|lbs|ct|count|counts|cd|loads?|pk|packs?|pack|rolls?|roll|ml|qt|quarts?|gallons?|gal)\b/i;

/** Bare "gallon" without number */
const BARE_GALLON = /\b(gallon|gal)\b/i;

/** Per-unit markers */
const PER_LB = /\bper\s*lb\b|\b\/\s*lb\b|\blb\b/i;
const PER_EACH = /\bper\s*each\b|\beach\b|\bea\b/i;

function hasOrChoice(text: string): boolean {
  return /\bor\b/i.test(text) && SINGLE.test(text);
}

function parseOneChunk(text: string): ParsedSize | undefined {
  const t = text.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return undefined;

  // Prefer fl oz / oz / lb when a loads count is also printed (detergent bottles)
  const vol =
    t.match(
      /(\d+(?:\.\d+)?)\s*(fl\.?\s*oz|fluid\s*oz|oz|lb|lbs)\b/i,
    ) || null;
  const loadsOnly = t.match(/(\d+(?:\.\d+)?)\s*loads?\b/i);
  if (vol && loadsOnly) {
    const qty = Number(vol[1]);
    const unit = canonUnit(vol[2].replace(/\./g, ' ').replace(/\s+/g, ' ').trim());
    if (unit && qty > 0) {
      return { label: formatLabel(qty, unit, false), unit, qty, isPerUnit: false };
    }
  }

  const multi = t.match(MULTI_PACK);
  if (multi) {
    const a = Number(multi[1]);
    const b = Number(multi[2]);
    const unit = canonUnit(multi[3].replace(/\./g, ' ').replace(/\s+/g, ' ').trim());
    if (unit && a > 0 && b > 0) {
      const qty = a * b;
      const uLabel = unit === 'fl oz' ? 'fl oz' : unit;
      return {
        label: `${a} x ${b} ${uLabel}`,
        unit,
        qty,
        isPerUnit: false,
      };
    }
  }

  const range = t.match(RANGE);
  if (range) {
    const lo = Number(range[1]);
    const hi = Number(range[2]);
    const unit = canonUnit(range[3].replace(/\./g, ' ').replace(/\s+/g, ' ').trim());
    if (unit && lo > 0 && hi >= lo) {
      return {
        label: `${lo}–${hi} ${unit === 'fl oz' ? 'fl oz' : unit}`,
        unit: unit === 'fl oz' ? 'fl oz' : unit,
        qty: (lo + hi) / 2,
        isPerUnit: false,
        ambiguous: true,
      };
    }
  }

  const single = t.match(SINGLE);
  if (single) {
    const qty = Number(single[1]);
    const unit = canonUnit(single[2].replace(/\./g, ' ').replace(/\s+/g, ' ').trim());
    if (unit && qty > 0) {
      return {
        label: formatLabel(qty, unit, false),
        unit,
        qty,
        isPerUnit: false,
      };
    }
  }

  if (BARE_GALLON.test(t) && !/\d/.test(t)) {
    return { label: 'gallon', unit: 'gallon', qty: 1, isPerUnit: false };
  }

  return undefined;
}

/**
 * Legacy helper: infer unit token from post_price_text alone.
 * Prefer parseDealSize for full size+unit+qty.
 */
export function unitFromPost(post?: string | null): string | undefined {
  if (!post) return undefined;
  const p = post.toLowerCase();
  // Ignore "Reg. - $5.50" / "Final Price" style posts
  if (/\$|final price|limit\s*\d|with coupon|digital/i.test(p) && !SINGLE.test(p)) {
    return undefined;
  }
  const parsed = parseOneChunk(post);
  if (parsed) return parsed.unit;
  if (/\blb\b|pound/.test(p)) return 'lb';
  if (/\bfl\.?\s*oz\b/.test(p)) return 'fl oz';
  if (/\boz\b/.test(p)) return 'oz';
  if (/\b(ct|count|cd)\b/.test(p)) return 'ct';
  if (/\bloads?\b/.test(p)) return 'loads';
  if (/\b(pk|packs?)\b/.test(p)) return 'pk';
  if (/each|ea\b/.test(p)) return 'each';
  if (/\bgallons?\b|\bgal\b/.test(p)) return 'gallon';
  return undefined;
}

export interface SizeParseInput {
  name?: string | null;
  postPriceText?: string | null;
  prePriceText?: string | null;
  saleStory?: string | null;
  /** Existing size string from demo / prior parse */
  existingSize?: string | null;
}

/**
 * Parse the best available size from Flipp fields + product name.
 * Skips unitPrice for ambiguous multi-option ads (caller should check .ambiguous).
 */
export function parseDealSize(input: SizeParseInput): ParsedSize | undefined {
  const sources = [
    input.postPriceText,
    input.existingSize,
    input.name,
    input.prePriceText,
    input.saleStory,
  ]
    .map((s) => (s || '').trim())
    .filter(Boolean);

  // Per-lb / each from post text first (meat / produce)
  for (const src of [input.postPriceText, input.existingSize]) {
    if (!src) continue;
    const p = src.toLowerCase();
    if (/^per\s*lb$|^\/\s*lb$|^\s*lb\s*$/.test(p) || (PER_LB.test(p) && !SINGLE.test(p))) {
      return { label: 'per lb', unit: 'lb', qty: 1, isPerUnit: true };
    }
    if (/^each$|^ea$/.test(p.trim()) || (PER_EACH.test(p) && !SINGLE.test(p) && !/\d/.test(p))) {
      return { label: 'each', unit: 'each', qty: 1, isPerUnit: true };
    }
  }

  let best: ParsedSize | undefined;
  for (const src of sources) {
    // Skip money-looking post text without a size token
    if (/\$/.test(src) && !SINGLE.test(src) && !MULTI_PACK.test(src) && !RANGE.test(src)) {
      continue;
    }
    const ambiguous = hasOrChoice(src);
    const parsed = parseOneChunk(src);
    if (!parsed) continue;
    if (ambiguous) parsed.ambiguous = true;
    // Prefer concrete non-ambiguous with larger specificity from name/post
    if (!best) {
      best = parsed;
      continue;
    }
    if (best.ambiguous && !parsed.ambiguous) best = parsed;
    else if (!best.ambiguous && parsed.ambiguous) continue;
    // Prefer fl oz / oz / ct over vague each when both found
    else if (best.isPerUnit && !parsed.isPerUnit) best = parsed;
  }

  return best;
}

/** Compute unit price from package price + parsed size */
export function unitPriceFromSize(
  packagePrice: number,
  parsed: ParsedSize | undefined,
): number | undefined {
  if (!parsed || parsed.ambiguous) return undefined;
  if (!(packagePrice > 0) || !(parsed.qty > 0)) return undefined;
  if (parsed.isPerUnit) return Math.round(packagePrice * 100) / 100;
  const up = packagePrice / parsed.qty;
  if (!Number.isFinite(up) || up <= 0) return undefined;
  // Guard absurd unit prices from bad parses
  if (up > packagePrice * 2) return undefined;
  return Math.round(up * 1000) / 1000;
}

/** Stable size key for same-package matching: "100|oz" */
export function sizeKey(parsed: {
  qty?: number;
  unit?: string;
  size?: string;
} | ParsedSize | undefined): string | undefined {
  if (!parsed) return undefined;
  if ('isPerUnit' in parsed && parsed.isPerUnit) {
    return `1|${comparableUnit(parsed.unit)}`;
  }
  const unit = comparableUnit(
    'unit' in parsed ? parsed.unit : undefined,
  );
  const qty =
    'qty' in parsed && typeof parsed.qty === 'number'
      ? parsed.qty
      : undefined;
  if (unit && qty != null && qty > 0) {
    const q = Math.round(qty * 100) / 100;
    return `${q}|${unit}`;
  }
  // Fallback: parse label/size string
  const label = 'label' in parsed ? parsed.label : 'size' in parsed ? parsed.size : undefined;
  if (typeof label === 'string' && label) {
    const p = parseDealSize({ existingSize: label, name: label });
    if (p) return sizeKey(p);
  }
  return undefined;
}

/** Format unit price for UI: $0.24/oz */
export function formatUnitPrice(unitPrice: number, unit: string): string {
  const money = unitPrice.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: unitPrice < 1 ? 2 : 2,
    maximumFractionDigits: unitPrice < 0.1 ? 3 : 2,
  });
  const u = unit === 'fl oz' ? 'oz' : unit;
  return `${money}/${u}`;
}
