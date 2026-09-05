import type { CategoryId, ScoredDeal, StoreId } from '../types';

export const GROCERY_STORAGE_KEY = 'big-matts-grocery-list-v1';

/** Snapshot of a deal kept on the grocery list (survives refresh). */
export interface GroceryItem {
  id: string;
  store: StoreId;
  storeLabel: string;
  category: CategoryId;
  name: string;
  brand?: string;
  price: number;
  size?: string;
  unitPrice?: number;
  unit?: string;
  /** Short cross-store flag text when the deal had one */
  crossNote?: string;
  addedAt: string;
}

export function dealToGroceryItem(deal: ScoredDeal): GroceryItem {
  return {
    id: deal.id,
    store: deal.store,
    storeLabel: deal.storeLabel,
    category: deal.category,
    name: deal.name,
    brand: deal.brand,
    price: deal.effectivePrice,
    size: deal.size,
    unitPrice: deal.unitPrice,
    unit: deal.unit,
    crossNote: deal.crossStore?.alert?.replace(/^⚠\s*/, ''),
    addedAt: new Date().toISOString(),
  };
}

export function loadGroceryList(): GroceryItem[] {
  try {
    const raw = localStorage.getItem(GROCERY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isGroceryItem);
  } catch {
    return [];
  }
}

export function saveGroceryList(items: GroceryItem[]): void {
  try {
    localStorage.setItem(GROCERY_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Quota / private mode — ignore
  }
}

function isGroceryItem(v: unknown): v is GroceryItem {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.store === 'string' &&
    typeof o.storeLabel === 'string' &&
    typeof o.category === 'string' &&
    typeof o.name === 'string' &&
    typeof o.price === 'number'
  );
}
