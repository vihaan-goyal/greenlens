// Pure module — imports nothing from React/Next.
//
// MinHash + LSH banding over a product's ingredient set: the long-tail blocking
// seam `blocking.ts` reserved. It produces brand- and barcode-independent block
// keys, so two listings of the same product collide on a band key whenever their
// ingredient sets are similar enough — *regardless of how their brand string is
// written, or whether either side has a GTIN*. That is exactly the case the
// gtin/brand keys miss: a no-barcode listing whose brand fails to canonicalize
// (an unknown brand, a garbled/empty OBF brand field) has no other key to share.
//
// How it stays a *blocking* signal, not a matching one: blocking only proposes
// candidate pairs; the pairwise scorer + threshold still decide. So this favors
// recall — surface the true pairs — and tolerates a few false candidates, which
// the scorer rejects. The richness floor and the band parameters keep the false
// fan-out small enough that blocking still cuts the n² search space.
//
// Determinism. No rng and no randomly-seeded hashing: the per-function constants
// are derived from a fixed seed at module load, so a given ingredient set always
// yields the same signature and the same keys. Reproducibility matters for the
// recall measurement (recall.ts) and for idempotent ingestion.

import { normalizeIngredient, type MatchableItem } from './features';

// ─── parameters ───────────────────────────────────────────────────────────────
// K hash functions split into B bands of R rows (K = B*R). A pair collides on a
// band iff all R of that band's MinHash values agree, with probability ≈ J^R per
// band; across B bands the collision probability follows the classic LSH S-curve
// 1-(1-J^R)^B. With (B=16, R=4): J≈0.8 collides near-certainly, J≈0.4 ~0.3,
// J≈0.25 ~0.06 — tuned so genuine same-product pairs (high ingredient overlap)
// surface while unrelated products rarely do. See blocking's reduction test and
// db:recall for the empirical guardrails.
export const MINHASH_PARAMS = { K: 64, B: 16, R: 4 } as const;

/**
 * Minimum distinct normalized ingredients before a listing gets MinHash keys.
 * Mirrors the `ingredientsOverlap` feature guard in features.ts: fewer than five
 * ingredients is too noisy and too forgiving — a 2-ingredient set collides with
 * far too much — so thin-data listings emit no ingredient keys and fall back to
 * the gtin/brand keys (or stay unblockable, which db:recall surfaces honestly).
 */
export const MIN_INGREDIENTS = 5;

// ─── hashing primitives (deterministic, 32-bit) ────────────────────────────────
// All arithmetic is kept inside 32 bits via Math.imul / `>>> 0`, so nothing ever
// leaves JS's safe-integer range (a*h mod p with 31-bit operands would not).

/** FNV-1a, the base 32-bit hash of one ingredient token. */
function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** murmur3 finalizer — avalanches a 32-bit word so the K mixes are independent. */
function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * K fixed 32-bit seeds from a seeded LCG (numerical-recipes constants). Built
 * once at load; `hashK(x, k) = fmix32(x ^ SEEDS[k])` gives K effectively
 * independent hash functions from one base hash — the standard practical
 * substitute for K independent permutations.
 */
const SEEDS: number[] = (() => {
  const seeds: number[] = [];
  let state = 0x9e3779b9 >>> 0; // golden-ratio seed
  for (let k = 0; k < MINHASH_PARAMS.K; k++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    seeds.push(state);
  }
  return seeds;
})();

// ─── signature + bands ──────────────────────────────────────────────────────────

/**
 * Distinct, normalized, non-empty ingredient tokens. Reuses the matcher's own
 * `normalizeIngredient` so "Ceramide NP" and "ceramide-np" collide here exactly
 * as they do in the ingredient-overlap feature.
 */
export function normalizedIngredientSet(ingredients: readonly string[] | undefined): string[] {
  if (!ingredients) return [];
  const set = new Set<string>();
  for (const raw of ingredients) {
    const t = normalizeIngredient(raw);
    if (t) set.add(t);
  }
  return [...set];
}

/**
 * MinHash signature: for each of the K hash functions, the minimum hash over all
 * tokens. Order-independent (it's a set reduction). Assumes a non-empty token
 * list — callers gate on the richness floor first.
 */
export function minhashSignature(tokens: readonly string[]): Uint32Array {
  const sig = new Uint32Array(MINHASH_PARAMS.K).fill(0xffffffff);
  for (const tok of tokens) {
    const base = fnv1a32(tok);
    for (let k = 0; k < MINHASH_PARAMS.K; k++) {
      const v = fmix32(base ^ SEEDS[k]!);
      if (v < sig[k]!) sig[k] = v;
    }
  }
  return sig;
}

/** Hash one band's R signature values into a 32-bit bucket id (FNV over words). */
function hashBand(sig: Uint32Array, start: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < MINHASH_PARAMS.R; i++) {
    h ^= sig[start + i]!;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The B band keys for a signature: `ing:<bandIndex>:<bucket>`. The band index is
 * part of the key so equal bucket hashes in different band positions never
 * collide. Two items share a band key iff that band's R MinHash values all match.
 */
export function bandKeys(sig: Uint32Array): string[] {
  const keys: string[] = [];
  for (let b = 0; b < MINHASH_PARAMS.B; b++) {
    keys.push(`ing:${b}:${hashBand(sig, b * MINHASH_PARAMS.R).toString(36)}`);
  }
  return keys;
}

/**
 * Ingredient block keys for one item: the B LSH band keys when it has at least
 * MIN_INGREDIENTS distinct normalized ingredients, otherwise none. This is the
 * single entry point `blocking.ts` calls; everything above is implementation.
 */
export function ingredientBlockKeys(item: MatchableItem): string[] {
  const tokens = normalizedIngredientSet(item.ingredients);
  if (tokens.length < MIN_INGREDIENTS) return [];
  return bandKeys(minhashSignature(tokens));
}
