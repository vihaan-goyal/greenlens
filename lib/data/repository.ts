import type { Axis, Brand, IngredientFlag, Pillars, Product, Source } from '../domain/types';
import type { CatalogEntry } from '../matcher/matcher';

/**
 * What a product looks like after the raw Listings + Ratings have been rolled
 * up by the domain layer. The repository is the seam — mock today, Prisma
 * later, swappable without UI changes.
 */
export interface ProductView {
  product: Product;
  brand: Brand;
  pillars: Pillars;
  sources: Source[];
}

/** A cleaner alternative with a structured tradeoff vs. the base product. */
export interface AlternativeView {
  view: ProductView;
  /** Axes where the alternative scores meaningfully better than the base. */
  cleaner: Array<{ axis: Axis; delta: number }>;
  /** Axes where the alternative scores worse — the honest tradeoff. */
  tradeoffs: Array<{ axis: Axis; delta: number }>;
}

export interface ProductRepository {
  listProducts(): Promise<ProductView[]>;
  getProduct(id: string): Promise<ProductView | null>;
  searchProducts(query: string): Promise<ProductView[]>;
  /**
   * Cleaner alternatives in the same category, ranked by ingredient_safety.
   * Ranking never includes affiliate payout — even after a revenue model exists.
   */
  listAlternatives(productId: string): Promise<AlternativeView[]>;
  getIngredientFlag(productId: string, slug: string): Promise<IngredientFlag | null>;
  listIngredientFlags(productId: string): Promise<IngredientFlag[]>;
  /**
   * Snapshot the whole catalog + brands in the matcher's shapes, for resolving a
   * live sighting against the canonical products. Shared by the extension's
   * resolve API so it matches against exactly the catalog the UI renders — match
   * and breakdown can never disagree about which products exist.
   */
  loadMatchContext(): Promise<{ catalog: CatalogEntry[]; brands: Brand[] }>;
}
