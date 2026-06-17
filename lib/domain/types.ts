// Pure domain types. No React/Next imports allowed in /lib/domain.
// Ratings attach to the raw Listing, never to the canonical Product, so the
// matcher can be re-run without losing source data.

export type Axis = 'ingredient_safety' | 'environmental' | 'labor' | 'packaging';

export const AXES: readonly Axis[] = [
  'ingredient_safety',
  'environmental',
  'labor',
  'packaging',
] as const;

export const AXIS_LABEL: Record<Axis, string> = {
  ingredient_safety: 'Ingredient safety',
  environmental: 'Environmental',
  labor: 'Labor',
  packaging: 'Packaging',
};

/** Short, lower-cased version for prose ("scores 80 on ingredient safety"). */
export const AXIS_PHRASE: Record<Axis, string> = {
  ingredient_safety: 'ingredient safety',
  environmental: 'environmental impact',
  labor: 'labor practices',
  packaging: 'packaging',
};

export const FUNDING_LABEL: Record<FundingModel, string> = {
  nonprofit: 'Nonprofit',
  independent: 'Independent',
  ad_supported: 'Ad-supported',
  subscription: 'Subscription',
};

export type FundingModel = 'nonprofit' | 'independent' | 'ad_supported' | 'subscription';

export type ScaleDirection = 'higher_is_better' | 'lower_is_better';

export interface Brand {
  id: string;
  name: string;
  parentId?: string;
  aliases: string[];
}

export interface Product {
  id: string;
  brandId: string;
  displayName: string;
  category: string;
  gtin?: string;
  sizeValue?: number;
  sizeUnit?: string;
  ingredients: string[];
}

export interface Source {
  id: string;
  name: string;
  axis: Axis;
  scaleMin: number;
  scaleMax: number;
  scaleDirection: ScaleDirection;
  fundingModel: FundingModel;
}

export interface Listing {
  id: string;
  sourceId: string;
  nativeId: string;
  rawName: string;
  rawBrand: string;
  rawGtin?: string;
  rawIngredients: string[];
  url: string;
  payload: unknown;
  fetchedAt: Date;
}

export interface ListingMatch {
  listingId: string;
  productId: string;
  confidence: number;
  method: string;
  reviewed: boolean;
}

export interface Rating {
  id: string;
  listingId: string;
  scoreRaw: number;
  scoreLabel?: string;
  ingestedAt: Date;
}

// Derived domain shapes used by scoring/disagreement/UI.

export type VerdictBand = 'excellent' | 'good' | 'fair' | 'poor' | 'bad';

export interface NormalizedRating {
  sourceId: string;
  sourceName: string;
  axis: Axis;
  fundingModel: FundingModel;
  /** 0..100, higher = better, regardless of native scale direction. */
  score: number;
  /** Raw native score, kept for display alongside the normalized value. */
  raw: number;
}

export interface PillarSummary {
  axis: Axis;
  /** Mean of normalized ratings on this axis, or null when no data. */
  representative: number | null;
  /** Min/max normalized; null when fewer than 2 ratings. */
  spread: { min: number; max: number } | null;
  ratings: NormalizedRating[];
  /** True when same-axis spread crosses the disagreement threshold. */
  disagreement: boolean;
}

export type Pillars = Record<Axis, PillarSummary>;

export type Weights = Record<Axis, number>;

// ─── Ingredient flags ───────────────────────────────────────────────────────
// The /flag/[ingredient] screen is the thesis: don't water it down. Each rater
// gets its own stance and reasoning, with the funding model attached so the
// reader can weigh the source.

export type IngredientStance = 'concern' | 'caution' | 'safe' | 'unknown';

export interface IngredientRaterPosition {
  sourceId: string;
  sourceName: string;
  fundingModel: FundingModel;
  stance: IngredientStance;
  reasoning: string;
}

/** Colored dot used on the flag page for ancillary tags (e.g., "fragrance-free"). */
export interface IngredientNote {
  label: string;
  band: VerdictBand;
}

export interface IngredientFlag {
  productId: string;
  /** URL-safe slug, e.g. "phenoxyethanol". */
  slug: string;
  /** Display name, e.g. "Phenoxyethanol". */
  name: string;
  /** Plain-spoken explanation aimed at a non-chemist reader. */
  explanation: string;
  positions: IngredientRaterPosition[];
  notes: IngredientNote[];
}
