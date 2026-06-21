// Pure provenance logic. No React/Next imports (see CLAUDE.md layering).
//
// A rating shown next to a product is an implicit claim that the rating is
// *about that product*. That claim is only as good as the Listing→Product match
// behind it. This module turns the raw match fields (confidence, reviewed) into
// a small, honest readout — per rating and rolled up per product — so the UI can
// surface weak coverage instead of hiding it. It never touches the scores
// themselves: provenance lives *around* the numbers, never blended into them.

import { AXES, type NormalizedRating, type Pillars } from './types';

/**
 * Presentation tiers for a single match.
 * - `verified`: a human confirmed it, or it's curated/seed data.
 * - `auto`: the matcher accepted it automatically with solid confidence.
 * - `weak`: accepted but below the comfort threshold — show a caveat.
 */
export type MatchTier = 'verified' | 'auto' | 'weak';

/**
 * Confidence at/above which an unreviewed automatic match reads as `auto`
 * rather than `weak`. This is a *presentation* threshold, deliberately separate
 * from the matcher's own accept threshold (which decides whether a match exists
 * at all) — /lib/domain stays free of any matcher coupling. Anything the matcher
 * accepted but that sits below this still counts; we just flag it for the reader.
 */
export const WEAK_MATCH_THRESHOLD = 0.9;

/**
 * Tier for one match. A missing confidence is treated as a clean, certain match
 * so curated/seed data (and any caller that doesn't carry match info) reads as
 * `verified` rather than being flagged as weak.
 */
export function matchTier(confidence?: number, reviewed?: boolean): MatchTier {
  if (reviewed) return 'verified';
  if (confidence === undefined) return 'verified';
  return confidence >= WEAK_MATCH_THRESHOLD ? 'auto' : 'weak';
}

/** Tier for a normalized rating, from the match fields it carries. */
export function ratingTier(r: NormalizedRating): MatchTier {
  return matchTier(r.matchConfidence, r.matchReviewed);
}

/**
 * Product-level coverage + provenance summary, rolled up across all axes.
 * Lets a page state, plainly, how many sources cover the product, across how
 * many of the four axes, and whether any of those ratings rest on a weak or
 * unreviewed match.
 */
export interface CoverageSummary {
  /** Total number of ratings (one per covering source listing). */
  sourceCount: number;
  /** How many of the four axes have at least one rating (0..4). */
  axesCovered: number;
  /** The least-certain tier present, or null when there are no ratings. */
  weakestTier: MatchTier | null;
  /** Any rating rests on an unreviewed (auto or weak) match. */
  hasUnreviewed: boolean;
  /** Any rating rests on a below-threshold (weak) match. */
  hasWeak: boolean;
  /** Fewer than all four axes are covered — the per-product face of tail bias. */
  sparseCoverage: boolean;
}

const TIER_RANK: Record<MatchTier, number> = { verified: 0, auto: 1, weak: 2 };

export function coverageSummary(pillars: Pillars): CoverageSummary {
  let sourceCount = 0;
  let axesCovered = 0;
  let weakestTier: MatchTier | null = null;
  let hasUnreviewed = false;
  let hasWeak = false;

  for (const axis of AXES) {
    const ratings = pillars[axis].ratings;
    if (ratings.length > 0) axesCovered += 1;
    for (const r of ratings) {
      sourceCount += 1;
      const tier = ratingTier(r);
      if (tier !== 'verified') hasUnreviewed = true;
      if (tier === 'weak') hasWeak = true;
      if (weakestTier === null || TIER_RANK[tier] > TIER_RANK[weakestTier]) {
        weakestTier = tier;
      }
    }
  }

  return {
    sourceCount,
    axesCovered,
    weakestTier,
    hasUnreviewed,
    hasWeak,
    sparseCoverage: axesCovered < AXES.length,
  };
}
