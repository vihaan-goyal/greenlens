// Pure module — imports nothing from React/Next.
//
// Labeled-pair generation for the logistic matcher. We have no human-labeled
// match/no-match corpus, so we bootstrap one from the real canonical catalog —
// the way entity-resolution models are seeded when a clean catalog exists:
//
//   • POSITIVES (label 1): a product paired with a *degraded sighting of itself*
//     — brand-prefixed, marketing-suffixed, GTIN sometimes dropped, ingredient
//     list sometimes truncated, exactly the noise a real Amazon page adds. The
//     label is certain because we know it's the same product.
//
//   • HARD NEGATIVES (label 0): a product paired with a sighting of a *different
//     product that shares a block key with it* — usually a same-brand sibling.
//     These are the pairs the matcher actually has to tell apart; easy cross-
//     brand non-pairs never share a block, so training on them teaches nothing.
//
// Both sides run through the same `computeFeatures` the live matcher uses, so the
// learned weights apply directly. This is honest but not label-noise-free: a
// "sibling" that is secretly the same product (a merge the catalog missed) is
// mislabeled negative. We drop the obvious cases (shared GTIN) and accept the
// rest as the realistic noise floor.

import type { Brand } from '../domain/types';
import { blockKeys, canonicalizeBrand, firstNameToken, normalizeGtin } from './blocking';
import { computeFeatures, mutateVariantToken, type FeatureScores, type MatchableItem } from './features';
import { featuresToVector } from './logistic';
import type { CatalogEntry } from './matcher';

export interface LabeledPair {
  /** Catalog product id (left side). */
  a: string;
  /** Synthetic sighting id (right side). */
  b: string;
  features: FeatureScores;
  label: 0 | 1;
}

export type Rng = () => number;

/** Deterministic PRNG (mulberry32) so dataset generation is reproducible. */
export function mulberry32(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface LabelOptions {
  positivesPerProduct?: number;
  /** Same-block (usually same-brand) sibling negatives — the hard, in-block case. */
  negativesPerProduct?: number;
  /**
   * Cross-brand negatives, preferring products that share a name token (the
   * "Aveeno vs CeraVe Daily Moisturizing Lotion" generic-name collision). Without
   * these, brandMatch is true on both classes and the model never learns the
   * brand signal — so it can't reject a different brand with the same name.
   */
  crossBrandNegativesPerProduct?: number;
  /**
   * Variant-conflict negatives: a product paired with a sighting of itself whose
   * one variant token (SPF / shade / concentration / AM-PM) has been changed to a
   * different value — a genuinely different SKU. Everything else (brand, name,
   * ingredients, size) still matches, so variantMatch=false is the *only* signal
   * that separates them. Without these the bootstrapped same-block negatives
   * almost never exercise variantMatch and the model trains its weight to ~0,
   * leaving head-brand siblings (SPF 60 vs 30, shade 150 vs 350) undistinguished.
   * Fires only for products whose name carries a mutable variant token.
   */
  variantNegativesPerProduct?: number;
  /**
   * Brandless positives: a product paired with a *name+ingredient-only* sighting
   * of itself — no brand, no GTIN, no size. This is the regime MinHash ingredient
   * blocking newly surfaces (a no-barcode listing whose brand doesn't
   * canonicalize) but that the scorer rejects: with brand absent, even a perfect
   * ingredient overlap + full name containment tops out ~0.877, just under the
   * threshold, because every other positive the model ever saw carried a brand.
   * These teach it that brand *absent* — distinct from brand *mismatched* — is
   * neutral, not disqualifying. Emitted only for ingredient-rich products (the
   * blockable regime); the cross-brand brandMatch=false negatives still anchor the
   * separate "different brand" signal so this doesn't erode brand discrimination.
   */
  brandlessPositivesPerProduct?: number;
  /** Fraction of synthetic sightings that keep their GTIN (the rest drop it). */
  keepGtinFraction?: number;
  rng?: Rng;
}

const DEFAULTS: Required<Omit<LabelOptions, 'rng'>> = {
  positivesPerProduct: 2,
  negativesPerProduct: 2,
  crossBrandNegativesPerProduct: 1,
  variantNegativesPerProduct: 1,
  // Off by default so existing callers (and the end-to-end eval test) are
  // unchanged; the training script opts in. Minimum needed to teach brand-absent.
  brandlessPositivesPerProduct: 0,
  keepGtinFraction: 0.4,
};

const MARKETING_TAILS = [
  'For All Skin Types, Dermatologist Tested',
  'Hydrating, Fragrance Free, Non-Comedogenic',
  'Lightweight Daily Formula, Cruelty Free',
  '',
];

function pick<T>(arr: ReadonlyArray<T>, rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

/**
 * An Amazon-style sighting of `entry`, degraded the ways the real world degrades
 * a product page: a brand prefix, a marketing tail, the barcode often missing,
 * and the ingredient list sometimes cut to just the actives.
 */
export function degradedSighting(entry: CatalogEntry, rng: Rng, keepGtin: boolean): MatchableItem {
  const tail = pick(MARKETING_TAILS, rng);
  const name = `${entry.brand ?? ''} ${entry.name} ${tail}`.replace(/\s+/g, ' ').trim();

  let ingredients = entry.ingredients;
  if (ingredients && ingredients.length > 5 && rng() < 0.5) {
    const keep = 5 + Math.floor(rng() * (ingredients.length - 5));
    ingredients = ingredients.slice(0, keep);
  }

  const sighting: MatchableItem = {
    id: `sighting-${entry.productId}`,
    brand: entry.brand,
    name,
    ingredients,
    sizeValue: entry.sizeValue,
    sizeUnit: entry.sizeUnit,
  };
  if (keepGtin && entry.gtin) sighting.gtin = entry.gtin;
  return sighting;
}

/**
 * A degraded sighting of `entry` whose one variant token has been changed to a
 * different value — a different SKU separable only by variantConflict=true. GTIN
 * is deliberately dropped: a shared barcode would (correctly) say "same product".
 */
export function variantMutatedSighting(entry: CatalogEntry, rng: Rng): MatchableItem | null {
  const mutated = mutateVariantToken(entry.name);
  if (!mutated) return null;
  const tail = pick(MARKETING_TAILS, rng);
  const name = `${entry.brand ?? ''} ${mutated} ${tail}`.replace(/\s+/g, ' ').trim();
  return {
    id: `variant-${entry.productId}`,
    brand: entry.brand,
    name,
    ingredients: entry.ingredients,
    sizeValue: entry.sizeValue,
    sizeUnit: entry.sizeUnit,
  };
}

/**
 * A name+ingredient-only sighting of `entry`: no brand, no GTIN, no size — the
 * degraded shape of a no-barcode listing whose brand field was empty or garbled
 * (a common OBF row). The name keeps the catalog name plus a marketing tail but
 * NO brand prefix, and the ingredient list is sometimes truncated to the actives,
 * exactly as `degradedSighting` does. Paired with `entry` this is a label-1
 * positive whose only same-product evidence is name + ingredients.
 */
export function brandlessPositiveSighting(entry: CatalogEntry, rng: Rng): MatchableItem {
  const tail = pick(MARKETING_TAILS, rng);
  const name = `${entry.name} ${tail}`.replace(/\s+/g, ' ').trim();

  let ingredients = entry.ingredients;
  if (ingredients && ingredients.length > 5 && rng() < 0.5) {
    const keep = 5 + Math.floor(rng() * (ingredients.length - 5));
    ingredients = ingredients.slice(0, keep);
  }

  return { id: `brandless-${entry.productId}`, name, ingredients };
}

/** Distinct catalog entries that share a block key with `entry`, minus itself. */
function sameBlockOthers(
  entry: CatalogEntry,
  index: ReadonlyMap<string, CatalogEntry[]>,
  brands: ReadonlyArray<Brand>,
): CatalogEntry[] {
  const selfGtin = normalizeGtin(entry.gtin);
  const seen = new Set<string>([entry.productId]);
  const out: CatalogEntry[] = [];
  for (const key of blockKeys(entry, brands)) {
    for (const other of index.get(key) ?? []) {
      if (seen.has(other.productId)) continue;
      // A shared GTIN means it's really the same product (a merge the catalog
      // missed) — don't mislabel that as a negative.
      if (selfGtin && normalizeGtin(other.gtin) === selfGtin) continue;
      seen.add(other.productId);
      out.push(other);
    }
  }
  return out;
}

/** Canonical-brand key for an entry, with a per-product fallback for no-brand rows. */
function brandKeyOf(entry: CatalogEntry, brands: ReadonlyArray<Brand>): string {
  return canonicalizeBrand(entry.brand, brands) ?? `__nobrand:${entry.productId}`;
}

/**
 * Different-brand entries that share a name token with `entry` (generic-name
 * collisions), with a flat random pool as fallback so we always have candidates.
 */
function crossBrandOthers(
  entry: CatalogEntry,
  selfBrand: string,
  nameTokenIndex: ReadonlyMap<string, CatalogEntry[]>,
  brandKey: ReadonlyMap<string, string>,
): CatalogEntry[] {
  const token = firstNameToken(entry.name);
  if (!token) return [];
  return (nameTokenIndex.get(token) ?? []).filter(
    (o) => brandKey.get(o.productId) !== selfBrand,
  );
}

/**
 * Generate labeled feature pairs from a catalog. Each product contributes up to
 * `positivesPerProduct` self-sightings (label 1), `negativesPerProduct` same-block
 * sibling sightings (label 0), `crossBrandNegativesPerProduct` different-brand
 * same-name sightings (label 0), `variantNegativesPerProduct` variant-SKU
 * sightings (label 0), and — for ingredient-rich products —
 * `brandlessPositivesPerProduct` name+ingredient-only self-sightings (label 1).
 */
export function generateLabeledPairs(
  catalog: ReadonlyArray<CatalogEntry>,
  brands: ReadonlyArray<Brand>,
  opts: LabelOptions = {},
): LabeledPair[] {
  const positivesPerProduct = opts.positivesPerProduct ?? DEFAULTS.positivesPerProduct;
  const negativesPerProduct = opts.negativesPerProduct ?? DEFAULTS.negativesPerProduct;
  const crossBrandNegativesPerProduct =
    opts.crossBrandNegativesPerProduct ?? DEFAULTS.crossBrandNegativesPerProduct;
  const variantNegativesPerProduct =
    opts.variantNegativesPerProduct ?? DEFAULTS.variantNegativesPerProduct;
  const brandlessPositivesPerProduct =
    opts.brandlessPositivesPerProduct ?? DEFAULTS.brandlessPositivesPerProduct;
  const keepGtinFraction = opts.keepGtinFraction ?? DEFAULTS.keepGtinFraction;
  const rng = opts.rng ?? Math.random;

  const index = new Map<string, CatalogEntry[]>();
  const nameTokenIndex = new Map<string, CatalogEntry[]>();
  const brandKey = new Map<string, string>();
  const flatPool: CatalogEntry[] = [];
  for (const e of catalog) {
    for (const key of blockKeys(e, brands)) {
      const arr = index.get(key);
      if (arr) arr.push(e);
      else index.set(key, [e]);
    }
    brandKey.set(e.productId, brandKeyOf(e, brands));
    const token = firstNameToken(e.name);
    if (token) {
      const arr = nameTokenIndex.get(token);
      if (arr) arr.push(e);
      else nameTokenIndex.set(token, [e]);
    }
    flatPool.push(e);
  }

  const negativeFrom = (other: CatalogEntry, entry: CatalogEntry): LabeledPair => {
    const sighting = degradedSighting(other, rng, rng() < keepGtinFraction);
    return { a: entry.productId, b: sighting.id, features: computeFeatures(entry, sighting, brands), label: 0 };
  };

  const pairs: LabeledPair[] = [];
  for (const entry of catalog) {
    for (let i = 0; i < positivesPerProduct; i++) {
      const sighting = degradedSighting(entry, rng, rng() < keepGtinFraction);
      pairs.push({
        a: entry.productId,
        b: sighting.id,
        features: computeFeatures(entry, sighting, brands),
        label: 1,
      });
    }

    const siblings = sameBlockOthers(entry, index, brands);
    for (let i = 0; i < negativesPerProduct && siblings.length > 0; i++) {
      pairs.push(negativeFrom(pick(siblings, rng), entry));
    }

    for (let i = 0; i < variantNegativesPerProduct; i++) {
      const mutated = variantMutatedSighting(entry, rng);
      if (!mutated) break; // no mutable variant token — nothing to learn from here
      pairs.push({
        a: entry.productId,
        b: mutated.id,
        features: computeFeatures(entry, mutated, brands),
        label: 0,
      });
    }

    // Brandless positives only for ingredient-rich products — the regime where
    // MinHash can actually block the no-brand sighting, so the model only learns
    // to accept brand-absent matches where name+ingredients carry real evidence
    // (a name-only brandless match would be too weak to trust).
    if ((entry.ingredients?.length ?? 0) >= 5) {
      for (let i = 0; i < brandlessPositivesPerProduct; i++) {
        const sighting = brandlessPositiveSighting(entry, rng);
        pairs.push({
          a: entry.productId,
          b: sighting.id,
          features: computeFeatures(entry, sighting, brands),
          label: 1,
        });
      }
    }

    if (crossBrandNegativesPerProduct > 0 && flatPool.length > 1) {
      const selfBrand = brandKey.get(entry.productId)!;
      const collisions = crossBrandOthers(entry, selfBrand, nameTokenIndex, brandKey);
      for (let i = 0; i < crossBrandNegativesPerProduct; i++) {
        // Prefer a name-token collision; otherwise sample the flat pool for any
        // different-brand product (reject same-brand draws with a few tries).
        let other = collisions.length > 0 ? pick(collisions, rng) : undefined;
        for (let t = 0; t < 5 && !other; t++) {
          const cand = pick(flatPool, rng);
          if (brandKey.get(cand.productId) !== selfBrand) other = cand;
        }
        if (other) pairs.push(negativeFrom(other, entry));
      }
    }
  }
  return pairs;
}

/** Vectorize labeled pairs into a training matrix + label vector. */
export function toDataset(pairs: ReadonlyArray<LabeledPair>): { X: number[][]; y: number[] } {
  return {
    X: pairs.map((p) => featuresToVector(p.features)),
    y: pairs.map((p) => p.label),
  };
}
