// Pure module — imports nothing from React/Next.
//
// Recall-by-brand-size measurement: the real-data companion to the coverage-bias
// unit test in matcher.test.ts. That test proves one mechanism on a toy corpus —
// drop an indie brand's alias and its product fractures while the big brands stay
// resolved. This module measures recall by brand size on the *real* ingested
// catalog and reports whatever gap is actually there, in whichever direction.
//
// It groups products by how many products their (canonical) brand has — a
// data-derived proxy for brand size, since head brands ship many SKUs while
// indie/tail brands carry one or two — then round-trips an Amazon-style sighting
// for each product through the live `resolveItem` and reports, per size bucket:
//   • recall: how often a product resolves back to itself, confidently;
//   • the failure breakdown (ambiguous / wrong / unresolved);
//   • a data-richness profile (GTIN coverage, ingredient depth, name length).
//
// The point is honesty, not a flattering number, and not a pre-decided narrative
// (see CLAUDE.md). The two ends fail for opposite reasons: the tail can fracture
// on thin data / alias gaps (the coverage-bias mechanism), while head brands with
// many lookalike SKUs lose recall to sibling *ambiguity*. The tool surfaces the
// real numbers; it does not average the gap away or assume which side loses.

import type { Brand } from '../domain/types';
import { blockKeys, canonicalizeBrand, normalizeGtin } from './blocking';
import { normalizeName, type MatchableItem } from './features';
import { resolveItem, type CatalogEntry } from './matcher';
import { MATCH_THRESHOLD } from './score';

// ─── size buckets ─────────────────────────────────────────────────────────────

export type SizeBucket = 'tail' | 'small' | 'mid' | 'head';

/** Stable display/iteration order, ascending in brand size. */
export const SIZE_BUCKETS: readonly SizeBucket[] = ['tail', 'small', 'mid', 'head'] as const;

/** Inclusive lower bound, in products-per-brand, for each non-tail bucket. */
export interface BucketCutoffs {
  small: number;
  mid: number;
  head: number;
}

/** `tail` = 1 product · `small` = 2–4 · `mid` = 5–19 · `head` = 20+. */
export const DEFAULT_CUTOFFS: BucketCutoffs = { small: 2, mid: 5, head: 20 };

export function bucketForCount(count: number, cutoffs: BucketCutoffs = DEFAULT_CUTOFFS): SizeBucket {
  if (count >= cutoffs.head) return 'head';
  if (count >= cutoffs.mid) return 'mid';
  if (count >= cutoffs.small) return 'small';
  return 'tail';
}

/**
 * Map every product to its canonical-brand size (the number of catalog products
 * sharing its brand). Brand identity reuses the matcher's own `canonicalizeBrand`,
 * so size is counted over the same notion of "same brand" the matcher blocks on —
 * a brand split by an alias gap (the coverage-bias failure) counts here as two
 * smaller brands, which is exactly the tail effect we want to measure. Products
 * with no resolvable brand are treated as a brand of one.
 */
export function brandSizeByProduct(
  catalog: ReadonlyArray<CatalogEntry>,
  brands: ReadonlyArray<Brand>,
): Map<string, number> {
  const brandKeyOf = (e: CatalogEntry): string =>
    canonicalizeBrand(e.brand, brands) ?? `__nobrand:${e.productId}`;

  const countByBrand = new Map<string, number>();
  for (const e of catalog) {
    const k = brandKeyOf(e);
    countByBrand.set(k, (countByBrand.get(k) ?? 0) + 1);
  }

  const sizeByProduct = new Map<string, number>();
  for (const e of catalog) {
    sizeByProduct.set(e.productId, countByBrand.get(brandKeyOf(e)) ?? 1);
  }
  return sizeByProduct;
}

// ─── synthetic sighting ───────────────────────────────────────────────────────

const DEFAULT_MARKETING_TAIL = 'For All Skin Types, Dermatologist Tested';

export interface SightingOptions {
  /** Marketing suffix appended to the catalog name, mimicking an Amazon title. */
  marketingTail?: string;
  /**
   * Whether the synthetic sighting carries the catalog GTIN. Real Amazon product
   * pages usually do *not* expose a barcode, so the default is to drop it — the
   * harder, more realistic condition, and the one where the tail's lack of other
   * strong signals actually bites.
   */
  keepGtin?: boolean;
}

/**
 * Build an Amazon-style sighting from a catalog entry: a brand-prefixed,
 * marketing-suffixed title plus the product's ingredients. This is the same
 * sighting shape `rate-check` synthesizes, kept here so both share one definition.
 */
export function syntheticSighting(entry: CatalogEntry, opts: SightingOptions = {}): MatchableItem {
  const tail = opts.marketingTail ?? DEFAULT_MARKETING_TAIL;
  const name = `${entry.brand ?? ''} ${entry.name} ${tail}`.replace(/\s+/g, ' ').trim();
  const sighting: MatchableItem = {
    id: 'sighting',
    brand: entry.brand,
    name,
    ingredients: entry.ingredients,
    sizeValue: entry.sizeValue,
    sizeUnit: entry.sizeUnit,
  };
  if (opts.keepGtin && entry.gtin) sighting.gtin = entry.gtin;
  return sighting;
}

// ─── per-product outcome ──────────────────────────────────────────────────────

export type Outcome = 'correct' | 'ambiguous' | 'wrong' | 'unresolved';

export interface ProductOutcome {
  productId: string;
  brandSize: number;
  bucket: SizeBucket;
  outcome: Outcome;
  /** Winner's confidence, or null when nothing cleared the threshold. */
  confidence: number | null;
}

/** Classify one resolver result against the product it was synthesized from. */
export function classifyResolution(
  selfProductId: string,
  result: { productId: string; ambiguous: boolean } | null,
): Outcome {
  if (!result) return 'unresolved';
  if (result.productId !== selfProductId) return 'wrong';
  return result.ambiguous ? 'ambiguous' : 'correct';
}

export interface MeasureOptions extends SightingOptions {
  threshold?: number;
  cutoffs?: BucketCutoffs;
}

/**
 * A block-key → entries index over the catalog. Built once so a measurement over
 * many probes doesn't re-block (and re-`canonicalizeBrand`, which scans every
 * brand) the whole catalog per probe.
 */
function buildBlockIndex(
  catalog: ReadonlyArray<CatalogEntry>,
  brands: ReadonlyArray<Brand>,
): Map<string, CatalogEntry[]> {
  const index = new Map<string, CatalogEntry[]>();
  for (const entry of catalog) {
    for (const key of blockKeys(entry, brands)) {
      const arr = index.get(key);
      if (arr) arr.push(entry);
      else index.set(key, [entry]);
    }
  }
  return index;
}

/** Catalog entries sharing ≥1 block key with `item`, deduped by id. */
function blockedCandidates(
  item: MatchableItem,
  index: ReadonlyMap<string, CatalogEntry[]>,
  brands: ReadonlyArray<Brand>,
): CatalogEntry[] {
  const seen = new Set<string>();
  const out: CatalogEntry[] = [];
  for (const key of blockKeys(item, brands)) {
    for (const entry of index.get(key) ?? []) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      out.push(entry);
    }
  }
  return out;
}

/**
 * Round-trip each probe (a catalog entry) through `resolveItem` against the full
 * catalog and classify whether it resolves back to itself. `probes` is usually a
 * stratified sample of `catalog`; scoring is always against the *whole* catalog,
 * because the failure mode we care about is a product colliding with the rest of
 * it, not with a sampled subset.
 *
 * For speed we pre-block the catalog once and hand `resolveItem` only the
 * candidates that share a block key with the probe. `resolveItem` block-filters
 * internally, so this yields the *identical* winner and ambiguity flag it would
 * on the full catalog (the entries we drop are exactly the ones it would have
 * skipped) — just without re-scanning every brand for every catalog row per probe.
 */
export function measureRecall(
  probes: ReadonlyArray<CatalogEntry>,
  catalog: ReadonlyArray<CatalogEntry>,
  brands: ReadonlyArray<Brand>,
  sizeByProduct: ReadonlyMap<string, number>,
  opts: MeasureOptions = {},
): ProductOutcome[] {
  const cutoffs = opts.cutoffs ?? DEFAULT_CUTOFFS;
  const threshold = opts.threshold ?? MATCH_THRESHOLD;
  const index = buildBlockIndex(catalog, brands);

  return probes.map((probe) => {
    const sighting = syntheticSighting(probe, opts);
    const candidates = blockedCandidates(sighting, index, brands);
    const result = resolveItem(sighting, candidates, brands, threshold);
    const brandSize = sizeByProduct.get(probe.productId) ?? 1;
    return {
      productId: probe.productId,
      brandSize,
      bucket: bucketForCount(brandSize, cutoffs),
      outcome: classifyResolution(probe.productId, result),
      confidence: result ? result.confidence : null,
    };
  });
}

// ─── aggregation: recall per bucket ───────────────────────────────────────────

export interface BucketRecall {
  bucket: SizeBucket;
  total: number;
  correct: number;
  ambiguous: number;
  wrong: number;
  unresolved: number;
  /** correct / total — confident, correct self-resolution. 0 for an empty bucket. */
  recall: number;
}

export function aggregateByBucket(outcomes: ReadonlyArray<ProductOutcome>): BucketRecall[] {
  const counts = new Map<SizeBucket, Record<Outcome, number>>();
  for (const b of SIZE_BUCKETS) {
    counts.set(b, { correct: 0, ambiguous: 0, wrong: 0, unresolved: 0 });
  }
  for (const o of outcomes) {
    counts.get(o.bucket)![o.outcome] += 1;
  }
  return SIZE_BUCKETS.map((bucket) => {
    const c = counts.get(bucket)!;
    const total = c.correct + c.ambiguous + c.wrong + c.unresolved;
    return {
      bucket,
      total,
      correct: c.correct,
      ambiguous: c.ambiguous,
      wrong: c.wrong,
      unresolved: c.unresolved,
      recall: total === 0 ? 0 : c.correct / total,
    };
  });
}

// ─── data-richness profile per bucket ─────────────────────────────────────────
// Why the tail is hard, independent of any synthetic-recall number: the inputs
// the matcher leans on are simply thinner there. Computed over the *whole*
// catalog (cheap, O(n)), not just the recall sample.

export interface BucketProfile {
  bucket: SizeBucket;
  products: number;
  brands: number;
  /** Fraction of products carrying a valid (normalizable) GTIN. */
  gtinCoverage: number;
  /** Mean count of distinct, normalized ingredients per product. */
  meanIngredients: number;
  /** Mean count of name tokens per product (catalog names, not sightings). */
  meanNameTokens: number;
}

export function profileByBucket(
  catalog: ReadonlyArray<CatalogEntry>,
  brands: ReadonlyArray<Brand>,
  sizeByProduct: ReadonlyMap<string, number>,
  cutoffs: BucketCutoffs = DEFAULT_CUTOFFS,
): BucketProfile[] {
  interface Acc {
    products: number;
    brands: Set<string>;
    withGtin: number;
    ingredients: number;
    nameTokens: number;
  }
  const acc = new Map<SizeBucket, Acc>();
  for (const b of SIZE_BUCKETS) {
    acc.set(b, { products: 0, brands: new Set(), withGtin: 0, ingredients: 0, nameTokens: 0 });
  }

  for (const e of catalog) {
    const size = sizeByProduct.get(e.productId) ?? 1;
    const a = acc.get(bucketForCount(size, cutoffs))!;
    a.products += 1;
    a.brands.add(canonicalizeBrand(e.brand, brands) ?? `__nobrand:${e.productId}`);
    if (normalizeGtin(e.gtin)) a.withGtin += 1;
    a.ingredients += e.ingredients ? e.ingredients.length : 0;
    const name = normalizeName(e.name);
    a.nameTokens += name ? name.split(' ').length : 0;
  }

  return SIZE_BUCKETS.map((bucket) => {
    const a = acc.get(bucket)!;
    const n = a.products;
    return {
      bucket,
      products: n,
      brands: a.brands.size,
      gtinCoverage: n === 0 ? 0 : a.withGtin / n,
      meanIngredients: n === 0 ? 0 : a.ingredients / n,
      meanNameTokens: n === 0 ? 0 : a.nameTokens / n,
    };
  });
}
