import type { Deal, PriceHistoryStore, ScoredDeal, ValueTier } from '../types';
import { analyzeAgainstHistory, effectiveDealPrice } from './history';
import { similarityKey } from './normalize';

/**
 * Ranking brain (documented in UI/README):
 * 1. Primary: historical analysis — drop vs recent typical, rare BOGO, unusual promo
 * 2. Secondary: lower unit price when known; multi-buy math; % off shelf/reg
 * 3. Tiers: steal / good / ok from composite analysis score
 * Plain-English chips for moms 50+: "Rare good deal", "Price dropped", "Better at Aldi"
 */

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function tierFromScore(score: number): ValueTier {
  if (score >= 72) return 'steal';
  if (score >= 52) return 'good';
  return 'ok';
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
    // Drop vs typical is the hero signal
    analysisScore = clamp(analysis.dropVsTypicalPct * 1.6, 0, 90);
    if (analysis.rareBogo) analysisScore += 18;
    else if (deal.bogo) analysisScore += 8;
    if (analysis.unusualPromo) analysisScore += 6;
    if (analysis.dropVsLastNonSalePct != null) {
      analysisScore += clamp(analysis.dropVsLastNonSalePct * 0.15, 0, 10);
    }
    // Plain English reasons for the list
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
  // Primary weight on historical analysis
  const valueScore = clamp(analysisScore * 0.7 + u * 0.2 + (pctOff ?? 30) * 0.1, 0, 100);

  if (reasons.length === 0) reasons.push('On this week\'s ad');

  // Map technical chips to friendlier ones in analysis
  if (analysis) {
    analysis.reasonChips = analysis.reasonChips.map((c) => {
      if (c === 'Rare BOGO') return 'Rare good deal';
      if (c.startsWith('Down ')) return c.replace('Down ', 'Price dropped ').replace(' vs ', ' vs usual ');
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

/** Annotate with "Better at X" when a similar item is cheaper elsewhere */
export function addCrossStoreHints(scored: ScoredDeal[]): ScoredDeal[] {
  const bySim = new Map<string, ScoredDeal[]>();
  for (const d of scored) {
    const k = similarityKey(d.name);
    const list = bySim.get(k) ?? [];
    list.push(d);
    bySim.set(k, list);
  }

  return scored.map((d) => {
    const peers = bySim.get(similarityKey(d.name)) ?? [];
    if (peers.length < 2) return d;
    const best = [...peers].sort((a, b) => a.effectivePrice - b.effectivePrice)[0];
    if (best.id === d.id) return d;
    if (best.effectivePrice < d.effectivePrice * 0.95) {
      const chip = `Better at ${best.storeLabel}`;
      const reasons = d.reasons.includes(chip) ? d.reasons : [...d.reasons, chip];
      const reasonChips = d.analysis
        ? d.analysis.reasonChips.includes(chip)
          ? d.analysis.reasonChips
          : [...d.analysis.reasonChips, chip]
        : undefined;
      return {
        ...d,
        reasons,
        analysis: d.analysis && reasonChips ? { ...d.analysis, reasonChips } : d.analysis,
      };
    }
    return d;
  });
}
