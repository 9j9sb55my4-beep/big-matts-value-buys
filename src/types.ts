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

export interface HistoryPoint {
  weekStart: string;
  price: number;
  unitPrice?: number;
  promoType: PromoType;
  onAd: boolean;
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

export interface ScoredDeal extends Deal {
  valueScore: number;
  analysisScore: number;
  tier: ValueTier;
  percentOff?: number;
  effectiveUnitPrice?: number;
  effectivePrice: number;
  reasons: string[];
  analysis?: AnalysisInsight;
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
  emoji: string;
}
