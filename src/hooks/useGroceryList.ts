import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ScoredDeal } from '../types';
import {
  dealToGroceryItem,
  loadGroceryList,
  saveGroceryList,
  type GroceryItem,
} from '../lib/groceryList';

export function useGroceryList() {
  const [items, setItems] = useState<GroceryItem[]>(() =>
    typeof window !== 'undefined' ? loadGroceryList() : [],
  );

  useEffect(() => {
    saveGroceryList(items);
  }, [items]);

  const idSet = useMemo(() => new Set(items.map((i) => i.id)), [items]);

  const toggle = useCallback((deal: ScoredDeal) => {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === deal.id);
      if (exists) return prev.filter((i) => i.id !== deal.id);
      return [...prev, dealToGroceryItem(deal)];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  return {
    items,
    toggle,
    remove,
    clearAll,
    idSet,
    count: items.length,
  };
}
