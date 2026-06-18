// Open Beauty Facts ingestion.
//
// OBF is open data (ODbL), so we can fetch and normalize it directly instead of
// scraping EWG/Yuka. This module:
//   1. fetches a product by barcode from the OBF v2 API,
//   2. validates the response with Zod (external data is never trusted),
//   3. normalizes it into the domain's Listing + Rating shapes, and
//   4. projects it to a MatchableItem so the matcher can resolve it against the
//      canonical catalog.
//
// Imports nothing from React/Next. Network IO is injectable for tests.

import { z } from 'zod';
import type { Brand, Listing, Rating } from '../domain/types';
import { resolveItem, type CatalogEntry, type ResolveResult } from '../matcher/matcher';
import type { MatchableItem } from '../matcher/features';

// ─── Source ───────────────────────────────────────────────────────────────────
// OBF contributes an environmental signal (Eco-Score) when present. Its id
// matches the seeded `obf-eco` source so ratings line up on the environmental
// pillar. 0..100, higher is better.
export const OBF_SOURCE_ID = 'obf-eco';

const OBF_API_BASE = 'https://world.openbeautyfacts.org/api/v2/product';

// ─── Validation ────────────────────────────────────────────────────────────────
// Only the fields we actually consume are declared; unknown keys are stripped
// from the validated view, but the full untouched response is kept as the
// Listing payload so nothing is lost for later re-processing.

const obfIngredientSchema = z.object({
  text: z.string().optional(),
});

export const obfProductSchema = z.object({
  code: z.string().optional(),
  product_name: z.string().optional(),
  brands: z.string().optional(),
  ingredients_text: z.string().optional(),
  ingredients: z.array(obfIngredientSchema).optional(),
  quantity: z.string().optional(),
  // Free-text and tag forms of the category hierarchy; used only to seed a new
  // canonical Product's `category` when the matcher finds no existing one.
  categories: z.string().optional(),
  categories_tags: z.array(z.string()).optional(),
  // Eco-Score is the only OBF rating we surface; it's often absent for cosmetics.
  ecoscore_score: z.number().nullable().optional(),
  ecoscore_grade: z.string().nullable().optional(),
});

export const obfResponseSchema = z.object({
  code: z.string().optional(),
  status: z.number(),
  status_verbose: z.string().optional(),
  product: obfProductSchema.optional(),
});

export type ObfProduct = z.infer<typeof obfProductSchema>;
export type ObfResponse = z.infer<typeof obfResponseSchema>;

// ─── Fetch ─────────────────────────────────────────────────────────────────────

export interface FetchOptions {
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Override for deterministic timestamps in tests. */
  now?: Date;
}

/**
 * Fetch and validate one product by barcode. Returns null when OBF reports the
 * product is unknown (status 0) so callers can show "Not yet rated" rather than
 * a fabricated result.
 */
export async function fetchOpenBeautyFacts(
  barcode: string,
  opts: FetchOptions = {},
): Promise<{ product: ObfProduct; raw: unknown } | null> {
  const doFetch = opts.fetchImpl ?? fetch;
  const digits = barcode.replace(/\D/g, '');
  if (!digits) throw new Error('barcode must contain digits');

  const res = await doFetch(`${OBF_API_BASE}/${digits}.json`);
  // OBF answers an unknown barcode with HTTP 404 *and* a valid status:0 body, so
  // 404 is "no such product" (→ null), not a transport failure. Any other
  // non-OK status is a real error worth surfacing.
  if (!res.ok && res.status !== 404) {
    throw new Error(`Open Beauty Facts request failed: ${res.status}`);
  }

  const json: unknown = await res.json();
  const parsed = obfResponseSchema.parse(json);
  if (parsed.status !== 1 || !parsed.product) return null;

  return { product: parsed.product, raw: json };
}

// ─── Normalization ───────────────────────────────────────────────────────────

/** "30 ml" / "1.7 fl oz" → { value, unit }. Best-effort; unknown formats drop. */
export function parseQuantity(
  quantity: string | undefined,
): { sizeValue?: number; sizeUnit?: string } {
  if (!quantity) return {};
  const m = quantity.trim().match(/([\d.]+)\s*([a-zA-Z]+)/);
  const amount = m?.[1];
  const unit = m?.[2];
  if (!amount || !unit) return {};
  const value = Number(amount);
  if (!Number.isFinite(value)) return {};
  return { sizeValue: value, sizeUnit: unit.toLowerCase() };
}

/** OBF `brands` is a comma-separated list; the first entry is the primary brand. */
export function primaryBrand(brands: string | undefined): string {
  return brands?.split(',')[0]?.trim() ?? '';
}

/** Prefer the structured ingredient list; fall back to splitting the text blob. */
export function extractIngredients(product: ObfProduct): string[] {
  const structured = product.ingredients
    ?.map((i) => i.text?.trim())
    .filter((t): t is string => !!t);
  if (structured && structured.length > 0) return structured;
  if (product.ingredients_text) {
    return product.ingredients_text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/** Normalize a validated OBF product into a domain Listing. */
export function normalizeListing(
  product: ObfProduct,
  raw: unknown,
  opts: { now?: Date } = {},
): Listing {
  const code = product.code ?? '';
  const fetchedAt = opts.now ?? new Date();
  return {
    id: `obf-${code}`,
    sourceId: OBF_SOURCE_ID,
    nativeId: code,
    rawName: product.product_name ?? '',
    rawBrand: primaryBrand(product.brands),
    rawGtin: code || undefined,
    rawIngredients: extractIngredients(product),
    url: `https://world.openbeautyfacts.org/product/${code}`,
    payload: raw,
    fetchedAt,
  };
}

/**
 * Extract the ratings OBF actually provides. Today that's only the Eco-Score on
 * the environmental axis, and only when present — we never invent a score for an
 * axis OBF didn't measure.
 */
export function extractRatings(
  product: ObfProduct,
  listingId: string,
  opts: { now?: Date } = {},
): Rating[] {
  const ratings: Rating[] = [];
  if (typeof product.ecoscore_score === 'number') {
    ratings.push({
      id: `r-${listingId}-eco`,
      listingId,
      scoreRaw: product.ecoscore_score,
      scoreLabel: product.ecoscore_grade?.toUpperCase(),
      ingestedAt: opts.now ?? new Date(),
    });
  }
  return ratings;
}

/**
 * Best-effort category for a *new* canonical product. Prefers the most specific
 * `categories_tags` entry (the last one), stripping the `en:` language prefix;
 * falls back to the last free-text category, then 'uncategorized'. Category is
 * not a matching feature — it only groups products on the Alternatives screen.
 */
export function extractCategory(product: ObfProduct): string {
  const tag = product.categories_tags?.at(-1);
  if (tag) return tag.replace(/^[a-z]{2}:/, '').replace(/[-_]+/g, ' ').trim();
  const text = product.categories?.split(',').at(-1)?.trim();
  return text || 'uncategorized';
}

/** Project a validated OBF product to the matcher's MatchableItem shape. */
export function toMatchableItem(product: ObfProduct): MatchableItem {
  const { sizeValue, sizeUnit } = parseQuantity(product.quantity);
  return {
    id: `obf-${product.code ?? ''}`,
    brand: primaryBrand(product.brands) || undefined,
    name: product.product_name ?? '',
    gtin: product.code || undefined,
    ingredients: extractIngredients(product),
    sizeValue,
    sizeUnit,
  };
}

// ─── Orchestration ─────────────────────────────────────────────────────────────

export interface IngestResult {
  listing: Listing;
  ratings: Rating[];
  /** Matcher's resolution against the canonical catalog, or null if unmatched. */
  match: ResolveResult | null;
  /**
   * The matcher-normalized projection of this product (name/brand/gtin/size/
   * ingredients). When `match` is null, a persistence layer uses this to mint a
   * new canonical Product and to extend the in-memory catalog for the rest of a
   * batch — no re-fetch needed.
   */
  item: MatchableItem;
  /** Best-effort category, used only when minting a new canonical Product. */
  category: string;
}

/**
 * Full ingestion for one barcode: fetch → validate → normalize → run the matcher
 * against the supplied canonical catalog. Returns null when OBF has no product.
 */
export async function ingestBarcode(
  barcode: string,
  catalog: ReadonlyArray<CatalogEntry>,
  brands: ReadonlyArray<Brand>,
  opts: FetchOptions = {},
): Promise<IngestResult | null> {
  const fetched = await fetchOpenBeautyFacts(barcode, opts);
  if (!fetched) return null;

  const listing = normalizeListing(fetched.product, fetched.raw, opts);
  const ratings = extractRatings(fetched.product, listing.id, opts);
  const item = toMatchableItem(fetched.product);
  const match = resolveItem(item, catalog, brands);

  return { listing, ratings, match, item, category: extractCategory(fetched.product) };
}
