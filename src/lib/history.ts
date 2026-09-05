import type {
  AnalysisInsight,
  Deal,
  HistoryPoint,
  HistorySource,
  ItemHistory,
  PriceHistoryStore,
  PromoType,
} from '../types';
import { normalizeName, similarityKey } from './normalize';

export function historyKey(store: string, normalizedName: string): string {
  return `${store}::${normalizedName}`;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function effectiveDealPrice(deal: Deal): number {
  if (deal.bogo) return deal.price / 2;
  if (deal.multiBuyQty && deal.multiBuyPrice && deal.multiBuyQty > 0) {
    return deal.multiBuyPrice / deal.multiBuyQty;
  }
  return deal.price;
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(' ').filter((t) => t.length > 2));
  const tb = new Set(b.split(' ').filter((t) => t.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit++;
  return hit / Math.min(ta.size, tb.size);
}

/** Find best history row for a deal: exact key → name → similarity → token overlap */
export function findHistoryItem(
  deal: Deal,
  store: PriceHistoryStore,
): ItemHistory | undefined {
  const nName = deal.normalizedName || normalizeName(deal.name);
  const key = historyKey(deal.store, nName);
  let item = store.items.find((i) => i.key === key);
  if (item) return item;
  item = store.items.find(
    (i) => i.store === deal.store && i.normalizedName === nName,
  );
  if (item) return item;

  const sim = similarityKey(deal.name);
  const sameStore = store.items.filter((i) => i.store === deal.store);
  item = sameStore.find((i) => similarityKey(i.normalizedName) === sim);
  if (item) return item;

  let best: ItemHistory | undefined;
  let bestScore = 0.55;
  for (const cand of sameStore) {
    const score = Math.max(
      tokenOverlap(nName, cand.normalizedName),
      nName.includes(cand.normalizedName) || cand.normalizedName.includes(nName)
        ? 0.7
        : 0,
    );
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  return best;
}

export function analyzeAgainstHistory(
  deal: Deal,
  store: PriceHistoryStore | null,
): AnalysisInsight | undefined {
  if (!store) return undefined;
  const item = findHistoryItem(deal, store);
  if (!item || item.points.length === 0) return undefined;

  // Exclude current week from baseline when dates overlap
  const prior = item.points.filter((p) => p.weekStart < deal.validFrom);
  const baseline = prior.length > 0 ? prior : item.points.slice(0, -1);
  if (baseline.length === 0) return undefined;

  const prices = baseline.map((p) => p.price);
  const historicalMedian = median(prices);
  const historicalTypical = mean(prices);
  const nonSale = baseline.filter((p) => p.promoType === 'plain' || !p.onAd);
  const lastNonSalePrice =
    nonSale.length > 0 ? nonSale[nonSale.length - 1].price : undefined;

  const current = effectiveDealPrice(deal);
  const dropVsTypicalPct =
    historicalTypical > 0
      ? ((historicalTypical - current) / historicalTypical) * 100
      : 0;
  const dropVsLastNonSalePct =
    lastNonSalePrice && lastNonSalePrice > 0
      ? ((lastNonSalePrice - current) / lastNonSalePrice) * 100
      : undefined;

  const bogoWeeks = baseline.filter((p) => p.promoType === 'bogo').length;
  const rareBogo = !!deal.bogo && bogoWeeks === 0;
  const multiWeeks = baseline.filter((p) => p.promoType === 'multi').length;
  const unusualPromo =
    rareBogo ||
    (!!deal.multiBuyQty && multiWeeks <= 1 && dropVsTypicalPct >= 20) ||
    dropVsTypicalPct >= 28;

  const reasonChips: string[] = [];
  if (rareBogo) reasonChips.push('Rare BOGO');
  else if (deal.bogo) reasonChips.push('BOGO');
  if (deal.multiBuyQty && deal.multiBuyPrice) {
    reasonChips.push(
      `Multi ${deal.multiBuyQty}/$${deal.multiBuyPrice.toFixed(deal.multiBuyPrice % 1 ? 2 : 0)}`,
    );
  }
  if (dropVsTypicalPct >= 8) {
    reasonChips.push(
      `Down ${Math.round(dropVsTypicalPct)}% vs ${baseline.length}-wk avg`,
    );
  }
  if (
    dropVsLastNonSalePct != null &&
    dropVsLastNonSalePct >= 15 &&
    Math.abs(dropVsLastNonSalePct - dropVsTypicalPct) >= 5
  ) {
    reasonChips.push(`↓${Math.round(dropVsLastNonSalePct)}% vs last full price`);
  }
  if (unusualPromo && !rareBogo && dropVsTypicalPct >= 28) {
    reasonChips.push('Strong price drop');
  }
  if (reasonChips.length === 0) reasonChips.push('On ad this week');

  return {
    historicalTypical: Math.round(historicalTypical * 100) / 100,
    historicalMedian: Math.round(historicalMedian * 100) / 100,
    lastNonSalePrice,
    dropVsTypicalPct: Math.round(dropVsTypicalPct * 10) / 10,
    dropVsLastNonSalePct:
      dropVsLastNonSalePct != null
        ? Math.round(dropVsLastNonSalePct * 10) / 10
        : undefined,
    weeksObserved: baseline.length,
    unusualPromo,
    rareBogo,
    reasonChips,
  };
}

/** Upsert current week's deals into a history store (client-side merge). */
export function upsertHistory(
  store: PriceHistoryStore,
  deals: Deal[],
  weekStart: string,
  source: HistorySource = 'flipp-live',
): PriceHistoryStore {
  const map = new Map(store.items.map((i) => [i.key, { ...i, points: [...i.points] }]));

  for (const deal of deals) {
    const nName = deal.normalizedName || normalizeName(deal.name);
    const key = historyKey(deal.store, nName);
    const promoType: PromoType =
      deal.promoType ??
      (deal.bogo ? 'bogo' : deal.multiBuyQty ? 'multi' : deal.regPrice ? 'sale' : 'plain');
    const point: HistoryPoint = {
      weekStart,
      price: deal.price,
      unitPrice: deal.unitPrice,
      promoType,
      onAd: true,
      source,
    };
    const existing = map.get(key);
    if (existing) {
      const without = existing.points.filter((p) => p.weekStart !== weekStart);
      without.push(point);
      without.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
      existing.points = without;
    } else {
      map.set(key, {
        key,
        store: deal.store,
        normalizedName: nName,
        unit: deal.unit,
        category: deal.category,
        points: [point],
      });
    }
  }

  return {
    ...store,
    updatedAt: new Date().toISOString(),
    items: [...map.values()],
  };
}
