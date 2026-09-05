import type {
  CrossStoreCompare,
  Deal,
  PriceHistoryStore,
  ReferenceKind,
  ReferencePrice,
  ScoredDeal,
  StoreId,
  ValueTier,
} from '../types';
import { STORES } from '../data/stores';
import { analyzeAgainstHistory, effectiveDealPrice } from './history';
import { isStapleKey, normalizeName, similarityKeys } from './normalize';
import {
  comparableUnit,
  formatUnitPrice,
  parseDealSize,
  sizeKey,
  unitPriceFromSize,
} from './sizeParse';

/**
 * Ranking brain (documented in UI/README):
 * CORE MISSION: cross-check Jewel / Aldi / Target for the ACTUAL best price.
 * 1. Primary: true lowest comparable price across stores (sale OR everyday)
 * 2. Secondary: historical drop vs typical, rare BOGO, unusual promo
 * 3. Tertiary: unit price / % off shelf
 * A single-store "sale" that loses to another store's everyday must NOT be
 * labeled Best deal — show a hard-to-miss alert instead.
 */

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function tierFromScore(score: number): ValueTier {
  if (score >= 72) return 'steal';
  if (score >= 52) return 'good';
  return 'ok';
}

function money(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function storeLabel(id: StoreId): string {
  return STORES.find((s) => s.id === id)?.label ?? id;
}

function kindPlain(kind: ReferenceKind): string {
  if (kind === 'everyday' || kind === 'ecom' || kind === 'history') return 'everyday';
  return 'sale';
}

function unitScore(deal: Deal, effective: number): number {
  const unitPrice =
    deal.unitPrice ??
    (deal.unit === 'each' || deal.unit === 'lb' ? effective : undefined);
  if (unitPrice == null) return 40;
  return clamp(100 - Math.log2(unitPrice + 0.25) * 22, 10, 98);
}

export function scoreDeal(
  deal: Deal,
  history: PriceHistoryStore | null,
): ScoredDeal {
  const effective = effectiveDealPrice(deal);
  const analysis = analyzeAgainstHistory(deal, history);

  const pctOff =
    deal.regPrice && deal.regPrice > 0
      ? ((deal.regPrice - effective) / deal.regPrice) * 100
      : undefined;

  let analysisScore = 40;
  const reasons: string[] = [];

  if (analysis) {
    analysisScore = clamp(analysis.dropVsTypicalPct * 1.6, 0, 90);
    if (analysis.rareBogo) analysisScore += 18;
    else if (deal.bogo) analysisScore += 8;
    if (analysis.unusualPromo) analysisScore += 6;
    if (analysis.dropVsLastNonSalePct != null) {
      analysisScore += clamp(analysis.dropVsLastNonSalePct * 0.15, 0, 10);
    }
    if (analysis.rareBogo) reasons.push('Rare good deal (BOGO)');
    else if (analysis.dropVsTypicalPct >= 25) reasons.push('Price dropped a lot');
    else if (analysis.dropVsTypicalPct >= 12) reasons.push('Price dropped');
    else if (deal.bogo) reasons.push('Buy one, get one free');
    else if (deal.multiBuyQty) reasons.push('Multi-buy savings');
    reasons.push(...analysis.reasonChips.filter((c) => !reasons.includes(c)));
  } else {
    if (pctOff != null) analysisScore = clamp(pctOff * 1.2, 20, 75);
    if (deal.bogo) {
      analysisScore += 12;
      reasons.push('Buy one, get one free');
    }
    if (deal.multiBuyQty) reasons.push('Multi-buy this week');
    if (pctOff != null && pctOff >= 20) reasons.push(`${Math.round(pctOff)}% off shelf price`);
  }

  const u = unitScore(deal, effective);
  // History is secondary to cross-store (applied in addCrossStoreHints)
  const valueScore = clamp(analysisScore * 0.7 + u * 0.2 + (pctOff ?? 30) * 0.1, 0, 100);

  if (reasons.length === 0) reasons.push("On this week's ad");

  if (analysis) {
    analysis.reasonChips = analysis.reasonChips.map((c) => {
      if (c === 'Rare BOGO') return 'Rare good deal';
      if (c.startsWith('Down '))
        return c.replace('Down ', 'Price dropped ').replace(' vs ', ' vs usual ');
      if (c === 'Strong price drop') return 'Price dropped a lot';
      return c;
    });
  }

  return {
    ...deal,
    valueScore: Math.round(valueScore * 10) / 10,
    analysisScore: Math.round(clamp(analysisScore, 0, 100) * 10) / 10,
    tier: tierFromScore(valueScore),
    percentOff: pctOff != null ? Math.round(pctOff) : undefined,
    effectiveUnitPrice: deal.unitPrice,
    effectivePrice: Math.round(effective * 100) / 100,
    reasons,
    analysis,
  };
}

export function rankDeals(
  deals: Deal[],
  history: PriceHistoryStore | null,
): ScoredDeal[] {
  return deals
    .map((d) => scoreDeal(d, history))
    .sort(
      (a, b) =>
        b.analysisScore - a.analysisScore ||
        b.valueScore - a.valueScore ||
        a.effectivePrice - b.effectivePrice,
    );
}

interface CompareCandidate {
  store: StoreId;
  storeLabel: string;
  /** Package / effective deal price */
  price: number;
  kind: ReferenceKind;
  name: string;
  dealId?: string;
  keys: string[];
  flyerUrl?: string;
  url?: string;
  unitPrice?: number;
  unit?: string;
  sizeKey?: string;
  sizeLabel?: string;
}

function storeSearchUrl(store: StoreId, productName: string): string {
  const q = encodeURIComponent(productName);
  if (store === 'aldi') return `https://www.aldi.us/results?q=${q}`;
  if (store === 'target') return `https://www.target.com/s?searchTerm=${q}`;
  return `https://www.jewelosco.com/shop/search-results.html?q=${q}`;
}

function resolveProofUrl(c: CompareCandidate): string {
  if (c.flyerUrl) return c.flyerUrl;
  if (c.url) return c.url;
  return storeSearchUrl(c.store, c.name);
}

function sizeMetaFromName(
  name: string,
  existing?: { size?: string; unit?: string; unitPrice?: number; price?: number },
): Pick<CompareCandidate, 'unitPrice' | 'unit' | 'sizeKey' | 'sizeLabel'> {
  const parsed = parseDealSize({
    name,
    existingSize: existing?.size,
  });
  const unit = parsed?.unit || existing?.unit;
  let unitPrice = existing?.unitPrice;
  if (unitPrice == null && existing?.price != null) {
    unitPrice = unitPriceFromSize(existing.price, parsed);
  }
  const sk = sizeKey(
    parsed ??
      (unit && existing?.size
        ? parseDealSize({ existingSize: existing.size, name })
        : undefined),
  );
  return {
    unitPrice,
    unit,
    sizeKey: sk,
    sizeLabel: parsed?.label || existing?.size,
  };
}

type CompareMode = 'unit' | 'package' | 'skip';

interface FairSide {
  price: number;
  unitPrice?: number;
  unit?: string;
  sizeKey?: string;
}

/**
 * A unit price is only usable when it is not a mislabeled package price.
 * Seeds that stamped unit: 'oz' on a $0.95 can made $/oz look like $0.95/oz
 * and caused fairCompare to skip a same-staple package compare.
 */
function reliableUnitPrice(side: FairSide): number | undefined {
  if (side.unitPrice == null) return undefined;
  const u = comparableUnit(side.unit);
  if (!u) return undefined;
  if (!side.sizeKey && Math.abs(side.unitPrice - side.price) < 0.021) {
    return undefined;
  }
  return side.unitPrice;
}

/**
 * Fair cross-store compare:
 * - both reliable unit prices + compatible units → unit mode
 * - same size key → package mode
 * - neither side has a reliable size/unit → package mode
 * - same staple keys and no conflicting pack sizes → package mode
 *   (canned beans often lack oz on one or both sides)
 * - otherwise skip (do not treat different packs as equal on shelf price)
 */
function fairCompare(
  a: FairSide,
  b: FairSide,
  opts?: { staplePackageFallback?: boolean },
): { mode: CompareMode; aVal: number; bVal: number } {
  const ua = comparableUnit(a.unit);
  const ub = comparableUnit(b.unit);
  const aUnit = reliableUnitPrice(a);
  const bUnit = reliableUnitPrice(b);
  if (aUnit != null && bUnit != null && ua && ub && ua === ub) {
    return { mode: 'unit', aVal: aUnit, bVal: bUnit };
  }
  if (a.sizeKey && b.sizeKey && a.sizeKey === b.sizeKey) {
    return { mode: 'package', aVal: a.price, bVal: b.price };
  }
  const aSized = !!a.sizeKey;
  const bSized = !!b.sizeKey;
  // Neither sized — package compare when both lack a reliable size/unit
  if (!aSized && !bSized && aUnit == null && bUnit == null) {
    return { mode: 'package', aVal: a.price, bVal: b.price };
  }
  // Same staple (black beans / pinto / chickpeas…): allow package compare
  // when size is missing on one or both sides. Skip only if both have
  // size keys and they disagree (15 oz vs 28 oz).
  if (opts?.staplePackageFallback && !(aSized && bSized && a.sizeKey !== b.sizeKey)) {
    return { mode: 'package', aVal: a.price, bVal: b.price };
  }
  return { mode: 'skip', aVal: a.price, bVal: b.price };
}

function buildCrossStoreAlert(
  c: CompareCandidate,
  mode: CompareMode,
  opts?: { assumeComparable?: boolean },
): CrossStoreCompare {
  const plain = kindPlain(c.kind);
  const shortStore = STORES.find((s) => s.id === c.store)?.short ?? c.storeLabel;
  let priceStr = money(c.price);
  if (mode === 'unit' && c.unitPrice != null && c.unit) {
    priceStr = formatUnitPrice(c.unitPrice, c.unit);
  }
  const uncertain =
    mode === 'package' && !c.sizeKey && !opts?.assumeComparable
      ? ' (size unclear)'
      : '';
  const alert = `${shortStore} ${priceStr} ${plain}${uncertain}`;
  const chip =
    plain === 'everyday'
      ? `${shortStore} still cheaper at ${priceStr} (everyday)`
      : `Compare: ${shortStore} ${priceStr} beats this sale`;
  return {
    store: c.store,
    storeLabel: c.storeLabel,
    price: mode === 'unit' && c.unitPrice != null ? c.unitPrice : c.price,
    kind: c.kind,
    name: c.name,
    alert,
    proofUrl: resolveProofUrl(c),
    chip,
  };
}

/** Everyday / typical price from another store's history backline */
function historyReferenceCandidates(
  history: PriceHistoryStore | null,
): CompareCandidate[] {
  if (!history) return [];
  const out: CompareCandidate[] = [];
  for (const item of history.items) {
    if (item.points.length === 0) continue;
    const everyday = item.points.filter((p) => p.promoType === 'plain' || !p.onAd);
    const pool = everyday.length > 0 ? everyday : item.points;
    const prices = pool.map((p) => p.price).filter((p) => p > 0 && p < 200);
    if (prices.length === 0) continue;
    const sorted = [...prices].sort((a, b) => a - b);
    const mid = sorted[Math.floor(sorted.length / 2)];
    const recent = everyday.length > 0 ? everyday[everyday.length - 1].price : mid;
    const price = Math.min(mid, recent);
    const meta = sizeMetaFromName(item.normalizedName, {
      unit: item.unit,
      unitPrice: pool.map((p) => p.unitPrice).find((u) => u != null),
      price,
    });
    out.push({
      store: item.store,
      storeLabel: storeLabel(item.store),
      price: Math.round(price * 100) / 100,
      kind: everyday.length > 0 ? 'everyday' : 'history',
      name: item.normalizedName,
      keys: similarityKeys(item.normalizedName),
      ...meta,
    });
  }
  return out;
}

/**
 * After per-store scoring, cross-check Jewel / Aldi / Target.
 * Prefer unit-price when both sides have it; never crown a winner on
 * package price alone across different sizes.
 */
export function addCrossStoreHints(
  scored: ScoredDeal[],
  history: PriceHistoryStore | null = null,
  references: ReferencePrice[] = [],
): ScoredDeal[] {
  const candidates: CompareCandidate[] = [];

  for (const d of scored) {
    const meta = sizeMetaFromName(d.name, {
      size: d.size,
      unit: d.unit,
      unitPrice: d.unitPrice ?? d.effectiveUnitPrice,
      price: d.effectivePrice,
    });
    candidates.push({
      store: d.store,
      storeLabel: d.storeLabel,
      price: d.effectivePrice,
      kind: d.bogo || d.multiBuyQty || d.promoType === 'sale' ? 'sale' : 'sale',
      name: d.name,
      dealId: d.id,
      keys: similarityKeys(d.name),
      flyerUrl: d.flyerUrl,
      unitPrice: meta.unitPrice ?? d.unitPrice,
      unit: meta.unit ?? d.unit,
      sizeKey: meta.sizeKey,
      sizeLabel: meta.sizeLabel ?? d.size,
    });
  }

  for (const r of references) {
    const meta = sizeMetaFromName(r.name, { price: r.price });
    candidates.push({
      store: r.store,
      storeLabel: r.storeLabel,
      price: r.price,
      kind: r.kind,
      name: r.name,
      dealId: r.dealId,
      keys: similarityKeys(r.name),
      url: r.url,
      ...meta,
    });
  }

  candidates.push(...historyReferenceCandidates(history));

  const annotated = scored.map((d) => {
    const keys = similarityKeys(d.name);
    const selfMeta = sizeMetaFromName(d.name, {
      size: d.size,
      unit: d.unit,
      unitPrice: d.unitPrice ?? d.effectiveUnitPrice,
      price: d.effectivePrice,
    });
    const self = {
      price: d.effectivePrice,
      unitPrice: selfMeta.unitPrice ?? d.unitPrice,
      unit: selfMeta.unit ?? d.unit,
      sizeKey: selfMeta.sizeKey,
    };

    // Collect fair cheaper candidates from other stores
    type Beat = { cand: CompareCandidate; mode: CompareMode; gap: number };
    const beats: Beat[] = [];
    for (const c of candidates) {
      if (c.store === d.store) continue;
      if (c.dealId != null && c.dealId === d.id) continue;
      if (!c.keys.some((k) => keys.includes(k))) continue;
      const stapleMatch = c.keys.some((k) => keys.includes(k) && isStapleKey(k));
      const fair = fairCompare(self, c, { staplePackageFallback: stapleMatch });
      if (fair.mode === 'skip') continue;
      // Must be meaningfully cheaper on the comparable metric
      if (fair.bVal >= fair.aVal * 0.98) continue;
      beats.push({
        cand: c,
        mode: fair.mode,
        gap: fair.aVal - fair.bVal,
      });
    }

    if (beats.length === 0) {
      return {
        ...d,
        isCrossStoreWinner: true,
        valueScore: Math.round(clamp(d.valueScore + 6, 0, 100) * 10) / 10,
        tier: tierFromScore(d.valueScore + 6),
      };
    }

    // Prefer unit-mode beats, then largest relative gap
    beats.sort((a, b) => {
      if (a.mode !== b.mode) return a.mode === 'unit' ? -1 : 1;
      return b.gap - a.gap;
    });
    const best = beats[0];
    const stapleMatch = best.cand.keys.some((k) => keys.includes(k) && isStapleKey(k));
    const cross = buildCrossStoreAlert(best.cand, best.mode, {
      assumeComparable: stapleMatch,
    });
    const gapPct =
      best.mode === 'unit' && self.unitPrice != null && best.cand.unitPrice != null
        ? ((self.unitPrice - best.cand.unitPrice) / self.unitPrice) * 100
        : ((d.effectivePrice - best.cand.price) / d.effectivePrice) * 100;
    const penalty = clamp(22 + gapPct * 0.9, 22, 48);
    const valueScore = clamp(d.valueScore - penalty, 0, 68);
    const analysisScore = clamp(d.analysisScore - penalty * 0.85, 0, 70);
    const safeTier: ValueTier = valueScore >= 52 ? 'good' : 'ok';

    const reasons = d.reasons.includes(cross.chip)
      ? d.reasons
      : [cross.chip, ...d.reasons.filter((r) => !/better at|still cheaper|compare:/i.test(r))];
    const reasonChips = d.analysis
      ? d.analysis.reasonChips.includes(cross.chip)
        ? d.analysis.reasonChips
        : [cross.chip, ...d.analysis.reasonChips]
      : undefined;

    return {
      ...d,
      valueScore: Math.round(valueScore * 10) / 10,
      analysisScore: Math.round(analysisScore * 10) / 10,
      tier: safeTier,
      reasons,
      analysis: d.analysis && reasonChips ? { ...d.analysis, reasonChips } : d.analysis,
      crossStore: cross,
      isCrossStoreWinner: false,
    };
  });

  return annotated.sort((a, b) => {
    const aBeat = a.crossStore ? 1 : 0;
    const bBeat = b.crossStore ? 1 : 0;
    if (aBeat !== bBeat) return aBeat - bBeat;
    const aKeys = similarityKeys(a.name);
    const bKeys = similarityKeys(b.name);
    const share = aKeys.some((k) => bKeys.includes(k));
    const stapleShare = aKeys.some((k) => bKeys.includes(k) && isStapleKey(k));
    if (share) {
      const fair = fairCompare(
        {
          price: a.effectivePrice,
          unitPrice: a.unitPrice,
          unit: a.unit,
          sizeKey: sizeKey(
            parseDealSize({ name: a.name, existingSize: a.size }) ?? {
              qty: undefined,
              unit: a.unit,
              size: a.size,
            },
          ),
        },
        {
          price: b.effectivePrice,
          unitPrice: b.unitPrice,
          unit: b.unit,
          sizeKey: sizeKey(
            parseDealSize({ name: b.name, existingSize: b.size }) ?? {
              qty: undefined,
              unit: b.unit,
              size: b.size,
            },
          ),
        },
        { staplePackageFallback: stapleShare },
      );
      if (fair.mode !== 'skip' && Math.abs(fair.aVal - fair.bVal) > 0.002) {
        return fair.aVal - fair.bVal;
      }
    }
    return (
      b.analysisScore - a.analysisScore ||
      b.valueScore - a.valueScore ||
      a.effectivePrice - b.effectivePrice
    );
  });
}

/** Demo / tests helper: build a ReferencePrice from a raw shelf price */
export function makeReferencePrice(
  store: StoreId,
  name: string,
  price: number,
  kind: ReferenceKind = 'everyday',
): ReferencePrice {
  return {
    store,
    storeLabel: storeLabel(store),
    name,
    normalizedName: normalizeName(name),
    price,
    kind,
  };
}
