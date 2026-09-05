/**
 * Aldi (and peer) everyday staple shelf prices used when Flipp ecom is thin.
 * Keeps demo + live cross-store checks honest for common pantry commodities.
 */
import type { ItemHistory, PriceHistoryStore, ReferencePrice } from '../types';
import { normalizeName } from './normalize';

interface StapleSeed {
  store: 'aldi' | 'jewel-osco' | 'target';
  storeLabel: string;
  name: string;
  category: 'pantry' | 'dairy' | 'produce' | 'meat' | 'household';
  /** Typical everyday price */
  price: number;
  unit?: string;
}

/** Chicagoland-ish everyday staples — Aldi black beans ~$0.89–$0.99 */
export const EVERYDAY_STAPLES: StapleSeed[] = [
  // Canned beans / dry pantry: these prices are per PACKAGE (typical 15–16 oz can), not $/oz.
  { store: 'aldi', storeLabel: 'Aldi', name: "Dakota's Pride Black Beans", category: 'pantry', price: 0.95 },
  { store: 'aldi', storeLabel: 'Aldi', name: "Dakota's Pride Pinto Beans", category: 'pantry', price: 0.95 },
  { store: 'aldi', storeLabel: 'Aldi', name: "Dakota's Pride Chickpeas", category: 'pantry', price: 0.99 },
  { store: 'aldi', storeLabel: 'Aldi', name: "Dakota's Pride Kidney Beans", category: 'pantry', price: 0.95 },
  { store: 'aldi', storeLabel: 'Aldi', name: "Dakota's Pride Refried Beans", category: 'pantry', price: 1.15 },
  { store: 'aldi', storeLabel: 'Aldi', name: 'Reggano Spaghetti', category: 'pantry', price: 0.99 },
  { store: 'aldi', storeLabel: 'Aldi', name: 'Friendly Farms Large Eggs', category: 'dairy', price: 2.45, unit: 'each' },
  { store: 'aldi', storeLabel: 'Aldi', name: 'Friendly Farms Whole Milk', category: 'dairy', price: 3.25 },
  { store: 'aldi', storeLabel: 'Aldi', name: 'Avocados', category: 'produce', price: 0.89, unit: 'each' },
  { store: 'aldi', storeLabel: 'Aldi', name: 'Bananas', category: 'produce', price: 0.49, unit: 'lb' },
  { store: 'target', storeLabel: 'Target', name: 'Good & Gather Black Beans', category: 'pantry', price: 0.99 },
  { store: 'target', storeLabel: 'Target', name: 'Good & Gather Pinto Beans', category: 'pantry', price: 0.99 },
  { store: 'jewel-osco', storeLabel: 'Jewel-Osco', name: 'Signature Black Beans', category: 'pantry', price: 1.29 },
];

export const DEMO_REFERENCE_PRICES: ReferencePrice[] = EVERYDAY_STAPLES.map((s) => ({
  store: s.store,
  storeLabel: s.storeLabel,
  name: s.name,
  normalizedName: normalizeName(s.name),
  price: s.price,
  kind: 'everyday' as const,
}));

function weekStartsBack(fromIso: string, count: number): string[] {
  const end = new Date(fromIso + 'T12:00:00Z');
  const weeks: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i * 7);
    weeks.push(d.toISOString().slice(0, 10));
  }
  return weeks;
}

/** Ensure price-history has Aldi staple everyday rows when missing */
export function ensureEverydayStaplesInHistory(
  store: PriceHistoryStore,
  weekAnchor = '2026-09-03',
): PriceHistoryStore {
  const map = new Map(store.items.map((i) => [i.key, { ...i, points: [...i.points] }]));
  const weeks = weekStartsBack(weekAnchor, 8);
  let added = 0;
  let patched = 0;

  for (const s of EVERYDAY_STAPLES) {
    const nName = normalizeName(s.name);
    const key = `${s.store}::${nName}`;
    const existing = map.get(key);
    if (existing) {
      // Older seeds marked canned-bean package prices as unit: 'oz' — that is wrong.
      if (existing.unit !== s.unit) {
        if (s.unit) existing.unit = s.unit;
        else delete existing.unit;
        patched++;
      }
      continue;
    }

    const item: ItemHistory = {
      key,
      store: s.store,
      normalizedName: nName,
      unit: s.unit,
      category: s.category,
      points: weeks.map((weekStart, idx) => {
        const wobble = 1 + Math.sin(idx * 1.3) * 0.03;
        const price = Math.round(s.price * wobble * 100) / 100;
        return {
          weekStart,
          price,
          promoType: 'plain' as const,
          onAd: false,
          source: 'everyday-seed' as const,
        };
      }),
    };
    map.set(key, item);
    added++;
  }

  if (added === 0 && patched === 0) return store;
  return {
    ...store,
    updatedAt: new Date().toISOString(),
    items: [...map.values()],
  };
}
