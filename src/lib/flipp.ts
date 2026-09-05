/**
 * Live weekly-ad ingestion via Wishabi/Flipp public search (no access_token).
 *
 * Working endpoint:
 *   GET https://backflipp.wishabi.com/flipp/items/search?locale=en-US&postal_code={ZIP}&q={query}
 * Returns `items[]` (flyer deals) and often `ecom_items[]` (everyday shelf).
 *
 * FlyerKit (`api.flipp.com/flyerkit/...`) needs a Flipp-issued access_token —
 * not used here. Demo JSON is an honest fallback only when live fails.
 */
import type {
  Deal,
  PromoType,
  ReferencePrice,
  StoreId,
  WeekPayload,
} from '../types';
import { STORES } from '../data/stores';
import { guessCategory } from './guessCategory';
import { normalizeName } from './normalize';
import {
  parseDealSize,
  unitFromPost,
  unitPriceFromSize,
} from './sizeParse';

export interface FlippAttemptResult {
  ok: boolean;
  deals: Deal[];
  /** Everyday / ecom shelf prices for cross-store best-price checks */
  referencePrices: ReferencePrice[];
  note: string;
  queryHits?: number;
  merchants?: Record<string, number>;
}

interface FlippSearchItem {
  flyer_item_id?: number | string;
  id?: number | string;
  flyer_id?: number | string;
  merchant_name?: string;
  merchant_id?: number;
  name?: string;
  current_price?: number | string | null;
  original_price?: number | string | null;
  sale_story?: string | null;
  pre_price_text?: string | null;
  post_price_text?: string | null;
  valid_from?: string;
  valid_to?: string;
  clean_image_url?: string;
  clipping_image_url?: string;
  _L1?: string;
  _L2?: string;
}

interface FlippEcomItem {
  name?: string;
  description?: string;
  merchant?: string;
  merchant_id?: number;
  current_price?: number | string | null;
  original_price?: number | string | null;
  item_id?: string | number;
  sku?: string;
  item_type?: string;
}

/** Keyword grid: merchants + categories + staples (for ecom everyday too) */
export const LIVE_SEARCH_QUERIES = [
  'jewel',
  'aldi',
  'target',
  'chicken',
  'beef',
  'pork',
  'sausage',
  'turkey',
  'salmon',
  'produce',
  'avocado',
  'banana',
  'berries',
  'milk',
  'eggs',
  'cheese',
  'yogurt',
  'butter',
  'frozen',
  'pizza',
  'ice cream',
  'wine',
  'beer',
  'pasta',
  'bread',
  'chips',
  'cookies',
  'detergent',
  'paper towels',
  'deli',
  'ham',
  // Beauty / personal care
  'shampoo',
  'conditioner',
  'deodorant',
  'toothpaste',
  'makeup',
  // Staples — boost ecom everyday coverage for cross-store checks
  'black beans',
  'pinto beans',
  'canned beans',
  'chickpeas',
  'shredded cheese',
] as const;

function matchStore(merchantName: string): StoreId | null {
  const lower = merchantName.toLowerCase().trim();
  for (const s of STORES) {
    if (s.flippMerchantHints.some((h) => lower.includes(h))) return s.id;
  }
  return null;
}

function parsePrice(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function categoryForItem(item: FlippSearchItem) {
  return guessCategory({
    name: item.name,
    l1: item._L1,
    l2: item._L2,
    saleStory: item.sale_story,
  });
}

function detectPromo(item: FlippSearchItem, price?: number, reg?: number): {
  promoType: PromoType;
  bogo?: boolean;
  multiBuyQty?: number;
  multiBuyPrice?: number;
} {
  const story = `${item.sale_story || ''} ${item.pre_price_text || ''} ${item.post_price_text || ''}`.toLowerCase();
  if (/bogo|buy\s*one\s*get\s*one|buy 1 get 1/.test(story)) {
    return { promoType: 'bogo', bogo: true };
  }
  const multi = story.match(/(\d+)\s*(?:for|\/)\s*\$?\s*(\d+(?:\.\d+)?)/);
  if (multi) {
    return {
      promoType: 'multi',
      multiBuyQty: Number(multi[1]),
      multiBuyPrice: Number(multi[2]),
    };
  }
  if (reg != null && price != null && reg > price) return { promoType: 'sale' };
  if (story.trim()) return { promoType: 'sale' };
  return { promoType: 'plain' };
}

function itemToDeal(item: FlippSearchItem): Deal | null {
  const merchant = item.merchant_name || '';
  const storeId = matchStore(merchant);
  if (!storeId) return null;
  const name = (item.name || '').trim();
  if (!name) return null;
  const price = parsePrice(item.current_price);
  if (price == null) return null;
  const regPrice = parsePrice(item.original_price);
  const promo = detectPromo(item, price, regPrice);
  const storeLabel = STORES.find((s) => s.id === storeId)!.label;
  const parsed = parseDealSize({
    name,
    postPriceText: item.post_price_text,
    prePriceText: item.pre_price_text,
    saleStory: item.sale_story,
  });
  // Effective package price for unit math (BOGO / multi handled later in scoring)
  const unit =
    parsed?.unit ?? unitFromPost(item.post_price_text);
  const size = parsed?.label;
  const unitPrice = unitPriceFromSize(price, parsed);
  const id = String(item.flyer_item_id || item.id || `${storeId}-${name}-${price}`);
  const validFrom = (item.valid_from || '').slice(0, 10);
  const validTo = (item.valid_to || '').slice(0, 10);

  return {
    id: `live-${id}`,
    store: storeId,
    storeLabel,
    category: categoryForItem(item),
    name,
    normalizedName: normalizeName(name),
    price,
    regPrice,
    unitPrice,
    unit,
    multiBuyQty: promo.multiBuyQty,
    multiBuyPrice: promo.multiBuyPrice,
    bogo: promo.bogo,
    size,
    validFrom: validFrom || new Date().toISOString().slice(0, 10),
    validTo: validTo || validFrom || new Date().toISOString().slice(0, 10),
    flyerUrl: `https://flipp.com/search/${encodeURIComponent(name)}?postal_code=`,
    imageUrl: item.clean_image_url || item.clipping_image_url,
    notes: item.sale_story || undefined,
    promoType: promo.promoType,
  };
}

function ecomToReference(item: FlippEcomItem): ReferencePrice | null {
  const merchant = item.merchant || '';
  const storeId = matchStore(merchant);
  if (!storeId) return null;
  const name = (item.name || item.description || '').trim();
  if (!name) return null;
  const price = parsePrice(item.current_price);
  if (price == null) return null;
  const storeLabel = STORES.find((s) => s.id === storeId)!.label;
  return {
    store: storeId,
    storeLabel,
    name,
    normalizedName: normalizeName(name),
    price,
    kind: 'ecom',
  };
}

interface SearchBundle {
  items: FlippSearchItem[];
  ecom: FlippEcomItem[];
}

async function searchOnce(zip: string, query: string): Promise<SearchBundle> {
  const qs = `locale=en-US&postal_code=${encodeURIComponent(zip)}&q=${encodeURIComponent(query)}`;
  const urls = [
    `/api/flipp/search?${qs}`,
    `https://backflipp.wishabi.com/flipp/items/search?${qs}`,
  ];

  let lastErr = 'no response';
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        continue;
      }
      const data = await res.json();
      const items: FlippSearchItem[] = Array.isArray(data?.items) ? data.items : [];
      const ecom: FlippEcomItem[] = Array.isArray(data?.ecom_items) ? data.ecom_items : [];
      return { items, ecom };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(lastErr);
}

/**
 * Multi-query live pull for Jewel / ALDI / Target at a ZIP.
 * Merges flyer deals + ecom everyday reference prices.
 */
export async function tryFetchFlippFlyers(zip: string): Promise<FlippAttemptResult> {
  const byId = new Map<string, Deal>();
  const refByKey = new Map<string, ReferencePrice>();
  const merchants: Record<string, number> = {};
  let queryHits = 0;
  const errors: string[] = [];

  const queue = [...LIVE_SEARCH_QUERIES];
  const concurrency = 4;
  let cursor = 0;

  async function worker() {
    while (cursor < queue.length) {
      const q = queue[cursor++];
      try {
        const { items, ecom } = await searchOnce(zip, q);
        queryHits += items.length + ecom.length;
        for (const raw of items) {
          const deal = itemToDeal(raw);
          if (!deal) continue;
          merchants[deal.storeLabel] = (merchants[deal.storeLabel] || 0) + 1;
          if (!byId.has(deal.id)) byId.set(deal.id, deal);
        }
        for (const raw of ecom) {
          const ref = ecomToReference(raw);
          if (!ref) continue;
          const key = `${ref.store}::${ref.normalizedName}`;
          const prev = refByKey.get(key);
          if (!prev || ref.price < prev.price) refByKey.set(key, ref);
        }
      } catch (e) {
        errors.push(`${q}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const deals = [...byId.values()];
  const referencePrices = [...refByKey.values()];
  for (const d of deals) {
    if (d.flyerUrl?.endsWith('postal_code=')) {
      d.flyerUrl = `https://flipp.com/search/${encodeURIComponent(d.name)}?postal_code=${zip}`;
    }
  }

  if (deals.length === 0) {
    return {
      ok: false,
      deals: [],
      referencePrices,
      note:
        errors.length > 0
          ? `Live Flipp search returned no Jewel/Aldi/Target items for ${zip} (${errors[0]}). Using demo fallback.`
          : `Live Flipp search returned no Jewel/Aldi/Target priced items for ${zip}. Using demo fallback.`,
      queryHits,
      merchants,
    };
  }

  const mSummary = Object.entries(merchants)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
  const ecomNote =
    referencePrices.length > 0
      ? ` · ${referencePrices.length} everyday shelf prices`
      : '';

  return {
    ok: true,
    deals,
    referencePrices,
    note: `Live Flipp for ZIP ${zip}: ${deals.length} ad items (${mSummary})${ecomNote}.`,
    queryHits,
    merchants,
  };
}

export async function loadDemoWeek(): Promise<WeekPayload> {
  const res = await fetch('/demo-week.json');
  if (!res.ok) throw new Error('Could not load demo-week.json');
  return res.json();
}

export async function loadPriceHistory() {
  const res = await fetch('/price-history.json');
  if (!res.ok) throw new Error('Could not load price-history.json');
  return res.json();
}
