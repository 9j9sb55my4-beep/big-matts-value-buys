import type {
  DataSource,
  Deal,
  PriceHistoryStore,
  ReferencePrice,
  WeekPayload,
} from '../types';
import { locationLabelForZip } from '../data/stores';
import { tryFetchFlippFlyers, loadDemoWeek, loadPriceHistory } from './flipp';
import { upsertHistory } from './history';
import { normalizeName } from './normalize';
import {
  parseDealSize,
  unitPriceFromSize,
} from './sizeParse';
import {
  DEMO_REFERENCE_PRICES,
  ensureEverydayStaplesInHistory,
} from './aldiStaples';

export interface LoadResult {
  week: WeekPayload;
  history: PriceHistoryStore;
  source: DataSource;
  banner: string;
}

/** Fill size / unit / unitPrice from name + existing size when missing. */
function enrichDealSpecificity(deal: Deal): Deal {
  const parsed = parseDealSize({
    name: deal.name,
    existingSize: deal.size,
    saleStory: deal.notes,
  });
  const size = parsed?.label || deal.size;
  const unit = parsed?.unit || deal.unit;
  let unitPrice = deal.unitPrice;
  const computed = unitPriceFromSize(deal.price, parsed);
  // Prefer freshly computed pack unit price when size is concrete
  if (computed != null) {
    const looksLikePackageAsUnit =
      unitPrice != null &&
      parsed &&
      !parsed.isPerUnit &&
      parsed.qty > 1 &&
      Math.abs(unitPrice - deal.price) < 0.001;
    if (unitPrice == null || looksLikePackageAsUnit) unitPrice = computed;
  }
  return { ...deal, size, unit, unitPrice };
}

function ensureNormalized(deals: Deal[]): Deal[] {
  return deals.map((d) =>
    enrichDealSpecificity({
      ...d,
      normalizedName: d.normalizedName || normalizeName(d.name),
    }),
  );
}

function weekBounds(deals: Deal[], fallbackFrom: string, fallbackTo: string) {
  const froms = deals.map((d) => d.validFrom).filter(Boolean).sort();
  const tos = deals.map((d) => d.validTo).filter(Boolean).sort();
  return {
    validFrom: froms[0] || fallbackFrom,
    validTo: tos[tos.length - 1] || fallbackTo,
  };
}

function mergeReferences(
  primary: ReferencePrice[] | undefined,
  fallback: ReferencePrice[],
): ReferencePrice[] {
  const map = new Map<string, ReferencePrice>();
  for (const r of [...fallback, ...(primary ?? [])]) {
    const key = `${r.store}::${r.normalizedName || normalizeName(r.name)}`;
    const prev = map.get(key);
    if (!prev || r.price < prev.price) {
      map.set(key, {
        ...r,
        normalizedName: r.normalizedName || normalizeName(r.name),
      });
    }
  }
  return [...map.values()];
}

function shortBanner(full: string, source: DataSource): string {
  if (source === 'live') {
    const m = full.match(/(\d+) ad items/);
    const e = full.match(/(\d+) everyday/);
    const parts = ['Cross-checking Jewel, Aldi & Target'];
    if (m) parts.push(`${m[1]} ads`);
    if (e) parts.push(`${e[1]} shelf prices`);
    return parts.join(' · ');
  }
  return 'Demo ads · cross-checking Jewel, Aldi & Target for the real best price';
}

/** Prefer live Flipp search; demo only as labeled fallback. */
export async function loadWeeklyDeals(
  zip: string,
  preferLive: boolean,
): Promise<LoadResult> {
  const rawHistory = (await loadPriceHistory()) as PriceHistoryStore;
  const history = ensureEverydayStaplesInHistory(rawHistory);
  const demo = await loadDemoWeek();
  const label = locationLabelForZip(zip);
  const demoRefs = mergeReferences(demo.referencePrices, DEMO_REFERENCE_PRICES);

  if (preferLive) {
    const attempt = await tryFetchFlippFlyers(zip);
    if (attempt.ok && attempt.deals.length > 0) {
      const deals = ensureNormalized(attempt.deals);
      const bounds = weekBounds(deals, demo.validFrom, demo.validTo);
      const referencePrices = mergeReferences(attempt.referencePrices, demoRefs);
      const week: WeekPayload = {
        source: 'live',
        zip,
        locationLabel: label,
        weekLabel: `This week · ${label}`,
        validFrom: bounds.validFrom,
        validTo: bounds.validTo,
        fetchedAt: new Date().toISOString(),
        deals,
        referencePrices,
        liveNote: attempt.note,
      };
      return {
        week,
        history: upsertHistory(history, deals, bounds.validFrom, 'flipp-live'),
        source: 'live',
        banner: shortBanner(attempt.note, 'live'),
      };
    }

    const deals = ensureNormalized(demo.deals);
    return {
      week: {
        ...demo,
        zip,
        locationLabel: label,
        deals,
        referencePrices: demoRefs,
        source: 'demo',
        liveNote: attempt.note,
      },
      history: upsertHistory(history, deals, demo.validFrom, 'seed'),
      source: 'demo',
      banner: shortBanner(attempt.note, 'demo'),
    };
  }

  const deals = ensureNormalized(demo.deals);
  return {
    week: {
      ...demo,
      zip,
      locationLabel: label,
      deals,
      referencePrices: demoRefs,
      source: 'demo',
    },
    history: upsertHistory(history, deals, demo.validFrom, 'seed'),
    source: 'demo',
    banner: shortBanner('', 'demo'),
  };
}
