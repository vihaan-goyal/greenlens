// Pure module — imports nothing from React/Next.
// Stage 2 of the matcher: scoring. Fellegi-Sunter-style additive log-likelihood
// over features that survived (i.e., were available on both sides). Weights
// are hand-picked for the prototype; the seam to swap for a learned logistic
// regression is `FEATURE_WEIGHTS` — replace the constant with a fitted vector
// and everything downstream still works.
//
// NORMALIZATION (the important bit): we divide by the sum of |weight| over
// *available* features, so a missing GTIN drops that 6.0 weight from both
// numerator and denominator. Otherwise the threshold would shift every time
// a listing's richness changed. With this, the same threshold is meaningful
// across pairs whether or not the barcode survived ingestion.

import type { FeatureKey, FeatureScores } from './features';

export const FEATURE_WEIGHTS: Record<FeatureKey, number> = {
  gtinExact: 6.0,
  nameJaroWinkler: 2.0,
  nameTokenSet: 1.5,
  brandMatch: 2.5,
  ingredientsJaccard: 3.0,
  sizeMatch: 1.0,
};

/**
 * Pairs above this are treated as matches. Pinned so brand+name+ingredient
 * agreement (no GTIN, no size) clears comfortably while brand-only agreement
 * does not. See matcher.test.ts for the calibration tests.
 */
export const MATCH_THRESHOLD = 0.62;

/**
 * Confidence in roughly 0..1. Binary features contribute their full weight on
 * a match and 0 on a non-match; similarity features contribute weight × value.
 */
export function score(features: FeatureScores): number {
  let weighted = 0;
  let total = 0;
  for (const key of Object.keys(FEATURE_WEIGHTS) as FeatureKey[]) {
    const value = features[key];
    if (value === undefined) continue;
    const w = FEATURE_WEIGHTS[key];
    const outcome = typeof value === 'boolean' ? (value ? 1 : 0) : value;
    weighted += w * outcome;
    total += w;
  }
  if (total === 0) return 0;
  return weighted / total;
}
