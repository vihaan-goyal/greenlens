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
  /** Useful for the SW log and debug overlay; never shown to users. */
  reason: string;
}

/**
 * Resolve one item (a Listing or a sighting) against a canonical catalog.
 * Returns null when no candidate clears the threshold — let the UI show the
 * "Not yet rated" state rather than a low-confidence false match.
 */
export function resolveItem(
  item: MatchableItem,
  catalog: ReadonlyArray<CatalogEntry>,
  brands: ReadonlyArray<Brand>,
  threshold: number = MATCH_THRESHOLD,
): ResolveResult | null {
  const itemKeys = new Set(blockKeys(item, brands));
  if (itemKeys.size === 0) return null;
  let best: { entry: CatalogEntry; score: number } | null = null;
  for (const entry of catalog) {
    const entryKeys = blockKeys(entry, brands);
    if (!entryKeys.some((k) => itemKeys.has(k))) continue;
    const f = computeFeatures(item, entry, brands);
    const s = score(f);
    if (s >= threshold && (!best || s > best.score)) best = { entry, score: s };
  }
  if (!best) return null;
  return {
    productId: best.entry.productId,
    confidence: best.score,
    reason: `matched ${best.entry.id} at ${best.score.toFixed(2)}`,
  };
}
