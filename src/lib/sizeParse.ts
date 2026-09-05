/**
 * Parse package size + unit from Flipp post/pre price text, sale story, and product name.
 * Used for display and fair unit-price cross-store comparison.
 *
 * Flipp ads usually print oz / lb / ct somewhere (name, post_price_text, or sale_story).
 * Be aggressive before falling back to "Size not listed" in the UI.
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

const UNIT_TOKEN =
  'fl\\.?\\s*oz|fluid\\s*ounces?|fluid\\s*oz|floz|ounces?|oz|lbs?|pounds?|count|counts|cts?|cd|loads?|packs?|pks?|rolls?|roll|milliliters?|mls?|quarts?|qts?|gallons?|gals?';

function canonUnit(raw: string): SizeUnit | undefined {
  const u = raw
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (
    u === 'fl oz' ||
    u === 'floz' ||
    u === 'fluid oz' ||
    u === 'fluid ounce' ||
    u === 'fluid ounces'
  )
    return 'fl oz';
  if (u === 'oz' || u === 'ounce' || u === 'ounces') return 'oz';
  if (u === 'lb' || u === 'lbs' || u === 'pound' || u === 'pounds') return 'lb';
  if (u === 'ct' || u === 'cts' || u === 'count' || u === 'counts' || u === 'cd')
    return 'ct';
  if (u === 'load' || u === 'loads') return 'loads';
  if (u === 'pk' || u === 'pks' || u === 'pack' || u === 'packs') return 'pk';
  if (u === 'ea' || u === 'each') return 'each';
  if (u === 'gal' || u === 'gals' || u === 'gallon' || u === 'gallons')
    return 'gallon';
  if (u === 'ml' || u === 'mls' || u === 'milliliter' || u === 'milliliters')
    return 'ml';
  if (u === 'qt' || u === 'qts' || u === 'quart' || u === 'quarts') return 'qt';
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
const MULTI_PACK = new RegExp(
  `(\\d+(?:\\.\\d+)?)\\s*[x×]\\s*(\\d+(?:\\.\\d+)?)\\s*-?\\s*(${UNIT_TOKEN})\\b`,
  'i',
);

/** Range like 117-132 oz */
const RANGE = new RegExp(
  `(\\d+(?:\\.\\d+)?)\\s*[-–]\\s*(\\d+(?:\\.\\d+)?)\\s*-?\\s*(${UNIT_TOKEN})\\b`,
  'i',
);

/** Single qty+unit: 15 oz, 15-oz, 15oz, 16 fl oz, 1 lb, 12 ct */
const SINGLE = new RegExp(
  `(\\d+(?:\\.\\d+)?)\\s*-?\\s*(${UNIT_TOKEN})\\b`,
  'i',
);

/** Pack-of / pkg patterns: 12-pack, pack of 8, pkg of 6 */
const PACK_OF =
  /(?:(\d+(?:\.\d+)?)\s*-?\s*packs?\b)|(?:(?:packs?|pkgs?|package)\s*(?:of\s*)?(\d+(?:\.\d+)?)\b)/i;

/** Bare "gallon" without number */
const BARE_GALLON = /\b(gallon|gal)\b/i;

/** Soft pack labels when no numeric size exists */
const FAMILY_PACK = /\bfamily\s*packs?\b|\bparty\s*size\b|\bvalue\s*packs?\b/i;

/** $X/lb, $/lb, per lb */
const DOLLAR_PER_LB = /\$\s*\d+(?:\.\d+)?\s*\/\s*lbs?\b|\/\s*lbs?\b|\bper\s*lbs?\b/i;
const PER_EACH = /\bper\s*each\b|\beach\b|\bea\b/i;

function hasOrChoice(text: string): boolean {
  return /\bor\b/i.test(text) && SINGLE.test(text);
}

function cleanUnitCapture(raw: string): string {
  return raw.replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
}

function parseOneChunk(text: string): ParsedSize | undefined {
  const t = text.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return undefined;

  // Prefer fl oz / oz / lb when a loads count is also printed (detergent bottles)
  const vol =
    t.match(
      /(\d+(?:\.\d+)?)\s*-?\s*(fl\.?\s*oz|fluid\s*ounces?|fluid\s*oz|floz|ounces?|oz|lbs?|pounds?)\b/i,
    ) || null;
  const loadsOnly = t.match(/(\d+(?:\.\d+)?)\s*loads?\b/i);
  if (vol && loadsOnly) {
    const qty = Number(vol[1]);
    const unit = canonUnit(cleanUnitCapture(vol[2]));
    if (unit && qty > 0) {
      return { label: formatLabel(qty, unit, false), unit, qty, isPerUnit: false };
    }
  }

  const multi = t.match(MULTI_PACK);
  if (multi) {
    const a = Number(multi[1]);
    const b = Number(multi[2]);
    const unit = canonUnit(cleanUnitCapture(multi[3]));
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
    const unit = canonUnit(cleanUnitCapture(range[3]));
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
    const unit = canonUnit(cleanUnitCapture(single[2]));
    if (unit && qty > 0) {
      return {
        label: formatLabel(qty, unit, false),
        unit,
        qty,
        isPerUnit: false,
      };
    }
  }

  const packOf = t.match(PACK_OF);
  if (packOf) {
    const qty = Number(packOf[1] || packOf[2]);
    if (qty > 0) {
      return {
        label: formatLabel(qty, 'pk', false),
        unit: 'pk',
        qty,
        isPerUnit: false,
      };
    }
  }

  if (BARE_GALLON.test(t) && !/\d/.test(t)) {
    return { label: 'gallon', unit: 'gallon', qty: 1, isPerUnit: false };
  }

  if (FAMILY_PACK.test(t)) {
    return {
      label: 'family pack',
      unit: 'pk',
      qty: 1,
      isPerUnit: false,
      ambiguous: true,
    };
  }

  return undefined;
}

function looksLikeMoneyOnly(src: string): boolean {
  // Skip Reg. $5.50 / Final Price lines that have no size token
  if (!/\$/.test(src)) return false;
  if (SINGLE.test(src) || MULTI_PACK.test(src) || RANGE.test(src)) return false;
  if (DOLLAR_PER_LB.test(src) || PACK_OF.test(src) || FAMILY_PACK.test(src))
    return false;
  return true;
}

/**
 * Legacy helper: infer unit token from post_price_text alone.
 * Prefer parseDealSize for full size+unit+qty.
 */
export function unitFromPost(post?: string | null): string | undefined {
  if (!post) return undefined;
  const p = post.toLowerCase();
  if (/\$|final price|limit\s*\d|with coupon|digital/i.test(p) && !SINGLE.test(p) && !DOLLAR_PER_LB.test(p)) {
    return undefined;
  }
  const parsed = parseOneChunk(post);
  if (parsed) return parsed.unit;
  if (DOLLAR_PER_LB.test(p) || /\blb\b|pound/.test(p)) return 'lb';
  if (/\bfl\.?\s*oz\b|fluid\s*oz/.test(p)) return 'fl oz';
  if (/\boz\b|ounce/.test(p)) return 'oz';
  if (/\b(ct|cts|count|cd)\b/.test(p)) return 'ct';
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

function tryPerUnit(src: string | null | undefined): ParsedSize | undefined {
  if (!src) return undefined;
  const p = src.toLowerCase().trim();
  if (!p) return undefined;

  // Explicit per-lb / $X/lb — prefer before treating lone "lb" in a sized name
  if (
    /^per\s*lbs?$/.test(p) ||
    /^\/\s*lbs?$/.test(p) ||
    /^\s*lbs?\s*$/.test(p) ||
    DOLLAR_PER_LB.test(p)
  ) {
    // If the same chunk also has a concrete pack size (e.g. "3 lb pack $X/lb"),
    // let parseOneChunk win later — only claim per-unit when no pack qty+oz/ct.
    if (SINGLE.test(p)) {
      const m = p.match(SINGLE);
      if (m) {
        const unit = canonUnit(cleanUnitCapture(m[2]));
        // "3 lb" package is a pack size, not "per lb"
        if (unit === 'lb' && Number(m[1]) > 0 && !/\/\s*lb|per\s*lb|\$/.test(p)) {
          return undefined;
        }
        if (unit && unit !== 'lb') return undefined;
      }
    }
    return { label: 'per lb', unit: 'lb', qty: 1, isPerUnit: true };
  }

  if (
    /^each$/.test(p) ||
    /^ea$/.test(p) ||
    (/^(per\s*)?ea\.?$/.test(p) && !/\d/.test(p))
  ) {
    return { label: 'each', unit: 'each', qty: 1, isPerUnit: true };
  }
  if (PER_EACH.test(p) && !SINGLE.test(p) && !/\d/.test(p)) {
    return { label: 'each', unit: 'each', qty: 1, isPerUnit: true };
  }
  return undefined;
}

/**
 * Parse the best available size from Flipp fields + product name.
 * Prefer post_price_text / unit hints; only return undefined when nothing parseable.
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

  // Per-lb / each from post text / size hints first (meat / produce)
  for (const src of [input.postPriceText, input.existingSize, input.prePriceText]) {
    const per = tryPerUnit(src);
    if (per) {
      // Still scan name for a better concrete pack size
      const fromName = input.name ? parseOneChunk(input.name) : undefined;
      if (fromName && !fromName.isPerUnit && !fromName.ambiguous) {
        return fromName;
      }
      return per;
    }
  }

  // $X/lb buried in sale story / name when post was empty
  for (const src of sources) {
    if (DOLLAR_PER_LB.test(src)) {
      const concrete = parseOneChunk(src);
      if (concrete && !concrete.isPerUnit && concrete.unit !== 'lb') {
        // e.g. keep "16 oz" if present alongside a $/lb note
        return concrete;
      }
      if (concrete && concrete.unit === 'lb' && !concrete.isPerUnit && concrete.qty !== 1) {
        return concrete;
      }
      return { label: 'per lb', unit: 'lb', qty: 1, isPerUnit: true };
    }
  }

  let best: ParsedSize | undefined;
  let bestRank = -1;
  // Prefer post_price_text hits slightly
  const rankedSources = sources.map((src, i) => ({
    src,
    // lower index in original sources = higher priority; post is 0
    base: sources.length - i,
  }));

  for (const { src, base } of rankedSources) {
    if (looksLikeMoneyOnly(src)) continue;
    const ambiguous = hasOrChoice(src);
    const parsed = parseOneChunk(src);
    if (!parsed) continue;
    if (ambiguous) parsed.ambiguous = true;

    let rank = base * 10;
    if (!parsed.ambiguous) rank += 5;
    if (!parsed.isPerUnit) rank += 3;
    // Prefer pack volume/weight over "loads" printed on detergent ads
    if (parsed.unit === 'fl oz' || parsed.unit === 'oz' || parsed.unit === 'lb')
      rank += 8;
    else if (parsed.unit === 'ct' || parsed.unit === 'pk' || parsed.unit === 'ml')
      rank += 2;
    else if (parsed.unit === 'loads') rank -= 6;

    if (!best || rank > bestRank) {
      best = parsed;
      bestRank = rank;
    } else if (best.ambiguous && !parsed.ambiguous) {
      best = parsed;
      bestRank = rank;
    } else if (best.isPerUnit && !parsed.isPerUnit) {
      best = parsed;
      bestRank = rank;
    }
  }

  // Last-chance: unit-only hint from post (e.g. post is "oz" with qty in name already tried)
  if (!best && input.postPriceText) {
    const u = unitFromPost(input.postPriceText);
    if (u === 'lb') {
      return { label: 'per lb', unit: 'lb', qty: 1, isPerUnit: true };
    }
    if (u === 'each') {
      return { label: 'each', unit: 'each', qty: 1, isPerUnit: true };
    }
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
