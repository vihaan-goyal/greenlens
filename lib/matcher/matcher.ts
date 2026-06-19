// Pure module — imports nothing from React/Next.
// Top-level matcher entry points.
//
//   clusterListings(items, brands)
//     Batch flow: blocking → pairwise scoring → union-find clustering.
//     Used by ingestion to deduplicate cross-source Listings into canonical
//     Products.
//
//   resolveItem(item, catalog, brands)
//     Live flow: block one item against an already-canonical catalog, score
//     each candidate, return the best above threshold. Used by the
//     extension's service worker on every Amazon page view.
//
// Both share the same feature/score code so a calibration change in one
// place affects both.

import type { Brand } from '../domain/types';
import { blockKeys, generateCandidatePairs } from './blocking';
import { computeFeatures, type MatchableItem } from './features';
import { score, MATCH_THRESHOLD } from './score';
import { clusterByEdges, type ScoredPair } from './cluster';

export interface ClusterResult {
  pairsConsidered: number;
  pairsAboveThreshold: number;
  clusters: string[][];
  /** Per-pair scores, kept so callers can audit threshold sensitivity. */
  scored: ScoredPair[];
}

export function clusterListings(
  items: ReadonlyArray<MatchableItem>,
  brands: ReadonlyArray<Brand>,
  threshold: number = MATCH_THRESHOLD,
): ClusterResult {
  const itemMap = new Map(items.map((i) => [i.id, i] as const));
  const candidates = generateCandidatePairs(items, brands);
  const scored: ScoredPair[] = candidates.map((p) => {
    const f = computeFeatures(itemMap.get(p.a)!, itemMap.get(p.b)!, brands);
    return { a: p.a, b: p.b, score: score(f) };
  });
  const above = scored.filter((s) => s.score >= threshold);
  const ids = items.map((i) => i.id);
  return {
    pairsConsidered: candidates.length,
    pairsAboveThreshold: above.length,
    clusters: clusterByEdges(ids, above, threshold),
    scored,
  };
}

/** A catalog entry the live resolver scores against. */
export type CatalogEntry = MatchableItem & { productId: string };

export interface ResolveResult {
  productId: string;
  /** Same scale as ClusterResult — comparable across calls. */
  confidence: number;
  /**
   * True when a *different* product scored within AMBIGUITY_MARGIN of the winner
   * — two similar candidates (usually same-brand siblings like a lotion vs a
   * cream) are nearly tied, so the winner is a best guess rather than a confident
   * call. The match is still returned (recall is preserved); the UI can hedge the
   * wording so we never silently present a near-coin-flip as certain.
   */
  ambiguous: boolean;
  /** Useful for the SW log and debug overlay; never shown to users. */
  reason: string;
}

/**
 * How close a runner-up (different product) must be to the winner before the
 * match is called ambiguous. Tuned below the gap the features normally open up
 * between siblings (e.g. lotion 0.85 vs cream 0.80 ≈ 0.05) so a clean win isn't
 * flagged, but a genuine near-tie is.
 */
export const AMBIGUITY_MARGIN = 0.04;

/**
 * Resolve one item (a Listing or a sighting) against a canonical catalog.
 * Returns null when no candidate clears the threshold — let the UI show the
 * "Not yet rated" state rather than a low-confidence false match. Never merges
 * products: it returns exactly one canonical product, or none.
 */
export function resolveItem(
  item: MatchableItem,
  catalog: ReadonlyArray<CatalogEntry>,
  brands: ReadonlyArray<Brand>,
  threshold: number = MATCH_THRESHOLD,
): ResolveResult | null {
  const itemKeys = new Set(blockKeys(item, brands));
  if (itemKeys.size === 0) return null;

  // Score every blocked candidate, then pick the winner *and* check the best
  // competitor that resolves to a different product, so two near-tied siblings
  // surface as ambiguous instead of one silently winning.
  const hits: Array<{ entry: CatalogEntry; score: number }> = [];
  for (const entry of catalog) {
    const entryKeys = blockKeys(entry, brands);
    if (!entryKeys.some((k) => itemKeys.has(k))) continue;
    const s = score(computeFeatures(item, entry, brands));
    if (s >= threshold) hits.push({ entry, score: s });
  }
  if (hits.length === 0) return null;

  hits.sort((a, b) => b.score - a.score);
  const best = hits[0]!;
  const runnerUp = hits.find((h) => h.entry.productId !== best.entry.productId);
  const ambiguous = !!runnerUp && best.score - runnerUp.score < AMBIGUITY_MARGIN;

  return {
    productId: best.entry.productId,
    confidence: best.score,
    ambiguous,
    reason: ambiguous
      ? `matched ${best.entry.id} at ${best.score.toFixed(2)} (ambiguous vs ${runnerUp!.entry.id} ${runnerUp!.score.toFixed(2)})`
      : `matched ${best.entry.id} at ${best.score.toFixed(2)}`,
  };
}
