/**
 * What a per-site adapter extracts from a product page. Intentionally narrow:
 * everything here is a raw observation that survives even when the page
 * partially fails to scrape. Anything richer (canonical Product, ratings) is
 * resolved in the service worker via the matcher + repository.
 *
 * Fields stay optional when the page might omit them — the matcher's job is
 * to make a confident match from whatever subset is available.
 */
export interface RawProductSighting {
  /** Which adapter produced this — used for telemetry + per-site bugfixes. */
  source: 'amazon' | 'fb-marketplace';
  /** Page URL at extraction time. Authoritative for de-dup. */
  url: string;
  rawName: string;
  rawBrand?: string;
  /** Any digits string from the page — strip non-digits before matching. */
  rawGtin?: string;
  /** Ingredient list in source order, lower-cased. Empty when unavailable. */
  rawIngredients: string[];
  /** Category breadcrumb path (root → leaf), used by the cosmetic classifier. */
  category?: string[];
  /** Display only — never used to influence ranking. */
  priceText?: string;
  imageUrl?: string;
  /** When the adapter ran, ms since epoch. */
  capturedAt: number;
}
