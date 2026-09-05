/**
 * Live weekly-ad ingestion via Wishabi/Flipp public search (no access_token).
 *
 * Working endpoint:
 *   GET https://backflipp.wishabi.com/flipp/items/search?locale=en-US&postal_code={ZIP}&q={query}
 * Returns `items[]` with merchant_name, name, current_price, original_price,
 * sale_story, valid_from/to, flyer_item_id, images.
 *
 * FlyerKit (`api.flipp.com/flyerkit/...`) needs a Flipp-issued access_token —
 * not used here. Demo JSON is an honest fallback only when live fails.
 */
import type { CategoryId, Deal, PromoType, StoreId, WeekPayload } from '../types';
import { STORES } from '../data/stores';
import { normalizeName } from './normalize';

export interface FlippAttemptResult {
  ok: boolean;
  deals: Deal[];
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

/** Keyword grid: merchant pulls + grocery categories for coverage */
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
  return Number.isFinite(n) ? n : undefined;
}

function guessCategory(item: FlippSearchItem): CategoryId {
  const blob = `${item.name || ''} ${item._L1 || ''} ${item._L2 || ''} ${item.sale_story || ''}`.toLowerCase();
  if (/beer|wine|vodka|liquor|prosecco|seltzer|alcohol|spirits/.test(blob)) return 'alcohol';
  if (/detergent|soap|cleaner|paper towel|tissue|trash|household|laundry|dish/.test(blob))
    return 'household';
  if (/chip|cookie|cracker|snack|popcorn|pretzel|candy/.test(blob)) return 'snacks';
  if (/bread|bagel|bakery|croissant|muffin|roll|bun|tortilla/.test(blob)) return 'bakery';
  if (/deli|sliced|prepared|ready meal|rotisserie/.test(blob) || /ham|salami|bologna/.test(blob))
    return 'deli';
  if (/frozen|ice cream|pizza|burrito|waffle/.test(blob)) return 'frozen';
  if (/milk|egg|cheese|yogurt|butter|cream|dairy/.test(blob)) return 'dairy';
  if (
    /produce|fruit|vegetable|avocado|banana|berry|apple|lettuce|broccoli|pepper|tomato|salad|organic/.test(
      blob,
    )
  )
    return 'produce';
  if (/beef|chicken|pork|turkey|sausage|salmon|meat|steak|rib|ground|seafood|shrimp/.test(blob))
    return 'meat';
  if (/pasta|sauce|oil|rice|bean|cereal|soup|pantry|canned|flour|sugar/.test(blob)) return 'pantry';
  return 'pantry';
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

function unitFromPost(post?: string | null): string | undefined {
  if (!post) return undefined;
  const p = post.toLowerCase();
  if (/\blb\b|pound/.test(p)) return 'lb';
  if (/\boz\b/.test(p)) return 'oz';
  if (/each|ea\b/.test(p)) return 'each';
  return undefined;
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
  const unit = unitFromPost(item.post_price_text);
  const id = String(item.flyer_item_id || item.id || `${storeId}-${name}-${price}`);
  const validFrom = (item.valid_from || '').slice(0, 10);
  const validTo = (item.valid_to || '').slice(0, 10);

  return {
    id: `live-${id}`,
    store: storeId,
    storeLabel,
    category: guessCategory(item),
    name,
    normalizedName: normalizeName(name),
    price,
    regPrice,
    unitPrice: unit === 'lb' || unit === 'each' ? price : undefined,
    unit,
    multiBuyQty: promo.multiBuyQty,
    multiBuyPrice: promo.multiBuyPrice,
    bogo: promo.bogo,
    size: item.post_price_text || undefined,
    validFrom: validFrom || new Date().toISOString().slice(0, 10),
    validTo: validTo || validFrom || new Date().toISOString().slice(0, 10),
    flyerUrl: `https://flipp.com/search/${encodeURIComponent(name)}?postal_code=`,
    imageUrl: item.clean_image_url || item.clipping_image_url,
    notes: item.sale_story || undefined,
    promoType: promo.promoType,
  };
}

async function searchOnce(zip: string, query: string): Promise<FlippSearchItem[]> {
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
      return items;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(lastErr);
}

/**
 * Multi-query live pull for Jewel / ALDI / Target at a ZIP.
 * Merges and dedupes by flyer_item_id.
 */
export async function tryFetchFlippFlyers(zip: string): Promise<FlippAttemptResult> {
  const byId = new Map<string, Deal>();
  const merchants: Record<string, number> = {};
  let queryHits = 0;
  const errors: string[] = [];

  // Bound concurrency to be polite
  const queue = [...LIVE_SEARCH_QUERIES];
  const concurrency = 4;
  let cursor = 0;

  async function worker() {
    while (cursor < queue.length) {
      const q = queue[cursor++];
      try {
        const items = await searchOnce(zip, q);
        queryHits += items.length;
        for (const raw of items) {
          const deal = itemToDeal(raw);
          if (!deal) continue;
          merchants[deal.storeLabel] = (merchants[deal.storeLabel] || 0) + 1;
          if (!byId.has(deal.id)) byId.set(deal.id, deal);
        }
      } catch (e) {
        errors.push(`${q}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const deals = [...byId.values()];
  // Fix flyer URLs with zip
  for (const d of deals) {
    if (d.flyerUrl?.endsWith('postal_code=')) {
      d.flyerUrl = `https://flipp.com/search/${encodeURIComponent(d.name)}?postal_code=${zip}`;
    }
  }

  if (deals.length === 0) {
    return {
      ok: false,
      deals: [],
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

  return {
    ok: true,
    deals,
    note: `Live Flipp search for ZIP ${zip}: ${deals.length} unique items (${mSummary}). No access_token required.`,
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
