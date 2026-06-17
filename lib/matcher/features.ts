// Pure module — imports nothing from React/Next. The matcher computes
// per-pair features over a normalized MatchableItem shape. Both raw Listings
// and canonical Products project to this shape, so the same scoring/clustering
// code serves batch ingestion and live extension lookups.

/**
 * The smallest projection needed for matching. Everything is optional except
 * id and name — by design, the matcher's job is to make a confident guess
 * from whatever subset of fields survived ingestion.
 */
export interface MatchableItem {
  id: string;
  brand?: string;
  name: string;
  gtin?: string;
  ingredients?: string[];
  sizeValue?: number;
  sizeUnit?: string;
}

/**
 * Feature outcomes for one pair. `undefined` means the feature is *not
 * available* (one side is missing the input). The scorer normalizes only
 * over features that are present, so a missing GTIN drops that signal
 * instead of dragging the score to zero.
 */
export interface FeatureScores {
  /** Both sides have a GTIN AND they normalize to the same 14-digit. */
  gtinExact?: boolean;
  /** Jaro-Winkler over normalized full names, 0..1. */
  nameJaroWinkler?: number;
  /** Token-set Jaccard over name tokens, 0..1. */
  nameTokenSet?: number;
  /** Canonical brand match after alias resolution. */
  brandMatch?: boolean;
  /**
   * Szymkiewicz-Simpson overlap coefficient over normalized ingredient sets:
   * |A ∩ B| / min(|A|, |B|). Available only when both sides list ≥5
   * ingredients — fewer than that is too noisy and too forgiving.
   *
   * We use overlap instead of Jaccard because the catalog typically holds a
   * shorter canonical ingredient list, while real-world Amazon pages publish
   * the full INCI with many synonyms and inactive carriers. Jaccard punishes
   * that size mismatch even when the catalog's list is fully contained in
   * the page's; overlap rewards the containment, which is the actual
   * "same product" signal.
   */
  ingredientsOverlap?: number;
  /** Same numeric size, same unit family (ml↔ml, oz↔oz). */
  sizeMatch?: boolean;
}

/** Public alias so blocking/score don't import directly from a deep file. */
export type FeatureKey = keyof FeatureScores;

// ─── normalizers ────────────────────────────────────────────────────────────

export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeIngredient(s: string): string {
  // Drop everything but a-z/0-9 so "Ceramide NP" and "ceramide-np" collide.
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// ─── feature computation ────────────────────────────────────────────────────

import type { Brand } from '../domain/types';
import { canonicalizeBrand, normalizeGtin } from './blocking';

export function computeFeatures(
  a: MatchableItem,
  b: MatchableItem,
  brands: ReadonlyArray<Brand>,
): FeatureScores {
  const out: FeatureScores = {};

  const gA = normalizeGtin(a.gtin);
  const gB = normalizeGtin(b.gtin);
  // Asymmetric on purpose: a TRUE GTIN match is strong positive evidence of
  // same product (and earns the heaviest feature weight in score.ts). A FALSE
  // non-match is *not* strong negative evidence — Amazon assigns different
  // UPCs to product variants (refills, size SKUs, region packs) that are
  // still the same canonical product. So on mismatch we omit the feature
  // entirely and let brand + name + ingredients decide.
  if (gA && gB && gA === gB) out.gtinExact = true;

  const nA = normalizeName(a.name);
  const nB = normalizeName(b.name);
  if (nA && nB) {
    out.nameJaroWinkler = jaroWinkler(nA, nB);
    out.nameTokenSet = jaccard(new Set(nA.split(' ')), new Set(nB.split(' ')));
  }

  if (a.brand && b.brand) {
    const ca = canonicalizeBrand(a.brand, brands);
    const cb = canonicalizeBrand(b.brand, brands);
    if (ca && cb) out.brandMatch = ca === cb;
  }

  if (
    a.ingredients && b.ingredients &&
    a.ingredients.length >= 5 && b.ingredients.length >= 5
  ) {
    const aSet = new Set(a.ingredients.map(normalizeIngredient).filter(Boolean));
    const bSet = new Set(b.ingredients.map(normalizeIngredient).filter(Boolean));
    if (aSet.size >= 5 && bSet.size >= 5) {
      out.ingredientsOverlap = overlapCoefficient(aSet, bSet);
    }
  }

  if (
    a.sizeValue != null && b.sizeValue != null && a.sizeUnit && b.sizeUnit
  ) {
    out.sizeMatch = sizesEqual(a.sizeValue, a.sizeUnit, b.sizeValue, b.sizeUnit);
  }

  return out;
}

function sizesEqual(va: number, ua: string, vb: number, ub: string): boolean {
  const norm = (u: string) => u.toLowerCase().replace(/\.?$/, '');
  if (norm(ua) !== norm(ub)) return false;
  return Math.abs(va - vb) < 0.5;
}

// ─── string similarity ──────────────────────────────────────────────────────

/**
 * Jaro similarity. Standard implementation: matching characters within a
 * window of max(|s1|,|s2|)/2 - 1, then a half-count of transpositions.
 */
export function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (!s1.length || !s2.length) return 0;
  const matchWindow = Math.max(0, Math.floor(Math.max(s1.length, s2.length) / 2) - 1);
  const a1 = new Array<boolean>(s1.length).fill(false);
  const a2 = new Array<boolean>(s2.length).fill(false);
  let matches = 0;
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(s2.length - 1, i + matchWindow);
    for (let j = start; j <= end; j++) {
      if (a2[j]) continue;
      if (s1[i] !== s2[j]) continue;
      a1[i] = true;
      a2[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let k = 0;
  let transpositions = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!a1[i]) continue;
    while (!a2[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  transpositions /= 2;
  return (matches / s1.length + matches / s2.length + (matches - transpositions) / matches) / 3;
}

/** Jaro-Winkler with the standard 0.1 boost per matching prefix char (up to 4). */
export function jaroWinkler(s1: string, s2: string, p = 0.1): number {
  const jaro = jaroSimilarity(s1, s2);
  if (jaro === 0) return 0;
  let prefix = 0;
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));
  while (prefix < maxPrefix && s1[prefix] === s2[prefix]) prefix++;
  return jaro + prefix * p * (1 - jaro);
}

export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Szymkiewicz-Simpson overlap coefficient — see ingredientsOverlap above for
 * why this beats Jaccard for asymmetric set comparisons.
 */
export function overlapCoefficient<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  return intersection / Math.min(a.size, b.size);
}
