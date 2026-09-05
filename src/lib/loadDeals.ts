import type { DataSource, Deal, PriceHistoryStore, WeekPayload } from '../types';
import { locationLabelForZip } from '../data/stores';
import { tryFetchFlippFlyers, loadDemoWeek, loadPriceHistory } from './flipp';
import { upsertHistory } from './history';
import { normalizeName } from './normalize';

export interface LoadResult {
  week: WeekPayload;
  history: PriceHistoryStore;
  source: DataSource;
  banner: string;
}

function ensureNormalized(deals: Deal[]): Deal[] {
  return deals.map((d) => ({
    ...d,
    normalizedName: d.normalizedName || normalizeName(d.name),
  }));
}

function weekBounds(deals: Deal[], fallbackFrom: string, fallbackTo: string) {
  const froms = deals.map((d) => d.validFrom).filter(Boolean).sort();
  const tos = deals.map((d) => d.validTo).filter(Boolean).sort();
  return {
    validFrom: froms[0] || fallbackFrom,
    validTo: tos[tos.length - 1] || fallbackTo,
  };
}

/** Prefer live Flipp search; demo only as labeled fallback. */
export async function loadWeeklyDeals(
  zip: string,
  preferLive: boolean,
): Promise<LoadResult> {
  const history = (await loadPriceHistory()) as PriceHistoryStore;
  const demo = await loadDemoWeek();
  const label = locationLabelForZip(zip);

  if (preferLive) {
    const attempt = await tryFetchFlippFlyers(zip);
    if (attempt.ok && attempt.deals.length > 0) {
      const deals = ensureNormalized(attempt.deals);
      const bounds = weekBounds(deals, demo.validFrom, demo.validTo);
      const week: WeekPayload = {
        source: 'live',
        zip,
        locationLabel: label,
        weekLabel: `Live weekly ads · ${label}`,
        validFrom: bounds.validFrom,
        validTo: bounds.validTo,
        fetchedAt: new Date().toISOString(),
        deals,
        liveNote: attempt.note,
      };
      return {
        week,
        history: upsertHistory(history, deals, bounds.validFrom),
        source: 'live',
        banner: `LIVE data — ${attempt.note}`,
      };
    }

    const deals = ensureNormalized(demo.deals);
    return {
      week: {
        ...demo,
        zip,
        locationLabel: label,
        deals,
        source: 'demo',
        liveNote: attempt.note,
      },
      history: upsertHistory(history, deals, demo.validFrom),
      source: 'demo',
      banner: `DEMO data — ${attempt.note}`,
    };
  }

  const deals = ensureNormalized(demo.deals);
  return {
    week: { ...demo, zip, locationLabel: label, deals, source: 'demo' },
    history: upsertHistory(history, deals, demo.validFrom),
    source: 'demo',
    banner:
      'DEMO data — Sample ads + seeded price history. Turn on “Try live ads first” to scour real Flipp flyers.',
  };
}
