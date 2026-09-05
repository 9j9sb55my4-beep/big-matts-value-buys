import type { CategoryMeta } from '../types';

export const CATEGORIES: CategoryMeta[] = [
  { id: 'meat', label: 'Meat', shortLabel: 'Meat', emoji: '🥩' },
  { id: 'produce', label: 'Produce', shortLabel: 'Produce', emoji: '🥬' },
  { id: 'dairy', label: 'Dairy & eggs', shortLabel: 'Dairy', emoji: '🥚' },
  { id: 'frozen', label: 'Frozen', shortLabel: 'Frozen', emoji: '🧊' },
  { id: 'alcohol', label: 'Alcohol', shortLabel: 'Alcohol', emoji: '🍷' },
  { id: 'pantry', label: 'Pantry / dry goods', shortLabel: 'Pantry', emoji: '🥫' },
  { id: 'snacks', label: 'Snacks', shortLabel: 'Snacks', emoji: '🍿' },
  { id: 'bakery', label: 'Bakery', shortLabel: 'Bakery', emoji: '🍞' },
  { id: 'beauty', label: 'Beauty', shortLabel: 'Beauty', emoji: '💄' },
  { id: 'household', label: 'Household / cleaning', shortLabel: 'Household', emoji: '🧹' },
  { id: 'deli', label: 'Deli / prepared', shortLabel: 'Deli', emoji: '🥪' },
];

export function categoryMeta(id: string) {
  return CATEGORIES.find((c) => c.id === id);
}
