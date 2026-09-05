/** Core domain types for Big Matt's Value Buys */

export type StoreId = 'jewel-osco' | 'aldi' | 'target';

export type CategoryId =
  | 'meat'
  | 'produce'
  | 'dairy'
  | 'frozen'
  | 'alcohol'
  | 'pantry'
  | 'snacks'
  | 'bakery'
  | 'beauty'
  | 'household'
  | 'deli';

export type ValueTier = 'steal' | 'good' | 'ok';

export type DataSource = 'live' | 'demo';

export type PromoType = 'sale' | 'bogo' | 'multi' | 'unit-cut' | 'plain';

export interface Deal {
  id: string;
  store: StoreId;
  storeLabel: string;
  category: CategoryId;
  name: string;
  /** Normalized key for history matching */
  normalizedName: string;
  brand?: string;
  price: number;
  /** Regular / shelf / non-sale price when printed on ad */
  regPrice?: number;
  unitPrice?: number;
  unit?: string;
  multiBuyQty?: number;
  multiBuyPrice?: number;
  /** Buy one get one free */
  bogo?: boolean;
  size?: string;
  validFrom: string;
  validTo: string;
  flyerUrl?: string;
  imageUrl?: string;
  notes?: string;
  promoType?: PromoType;
}

export type HistorySource = 'seed' | 'flipp-archive' | 'flipp-live' | 'ecom' | 'everyday-seed';

export interface HistoryPoint {
  weekStart: string;
  price: number;
  unitPrice?: number;
  promoType: PromoType;
  onAd: boolean;
  /** Where this price point came from */
  source?: HistorySource;
}

export interface ItemHistory {
  key: string;
  store: StoreId;
  normalizedName: string;
  unit?: string;
  category: CategoryId;
  points: HistoryPoint[];
}

export interface PriceHistoryStore {
  locationLabel: string;
  zip: string;
  updatedAt: string;
  items: ItemHistory[];
  notes?: string;
}

export interface AnalysisInsight {
  historicalTypical: number;
  historicalMedian: number;
  lastNonSalePrice?: number;
  dropVsTypicalPct: number;
  dropVsLastNonSalePct?: number;
  weeksObserved: number;
  unusualPromo: boolean;
  rareBogo: boolean;
  reasonChips: string[];
}

/** Everyday / ecom / history reference used for cross-store best-price checks */
export type ReferenceKind = 'everyday' | 'ecom' | 'sale' | 'history';

export interface ReferencePrice {
  store: StoreId;
  storeLabel: string;
  name: string;
  normalizedName: string;
  price: number;
  kind: ReferenceKind;
  /** Optional id when sourced from a deal in the same pull */
  dealId?: string;
  /** Product / search page when known (ecom) */
  url?: string;
}

export interface CrossStoreCompare {
  /** Other store that beats this deal */
  store: StoreId;
  storeLabel: string;
  price: number;
  kind: ReferenceKind;
  name: string;
  /** One short flag, e.g. "Aldi $0.99 everyday" (⚠ shown separately in UI) */
  alert: string;
  /** Cheaper store product/search page for verification */
  proofUrl: string;
  /** Chip text */
  chip: string;
}

export interface ScoredDeal extends Deal {
  valueScore: number;
  analysisScore: number;
  tier: ValueTier;
  percentOff?: number;
  effectiveUnitPrice?: number;
  effectivePrice: number;
  reasons: string[];
  analysis?: AnalysisInsight;
  /** Set when another store has a cheaper comparable item */
  crossStore?: CrossStoreCompare;
  /** True when this deal is the cheapest comparable across stores */
  isCrossStoreWinner?: boolean;
}

export interface WeekPayload {
  source: DataSource;
  zip: string;
  locationLabel: string;
  weekLabel: string;
  validFrom: string;
  validTo: string;
  fetchedAt: string;
  deals: Deal[];
  liveNote?: string;
  /** Everyday shelf / ecom prices collected alongside weekly ads */
  referencePrices?: ReferencePrice[];
}

export interface StoreMeta {
  id: StoreId;
  label: string;
  short: string;
  color: string;
  flippMerchantHints: string[];
}

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  /** Compact label for deal cards / list rows */
  shortLabel: string;
  emoji: string;
}
