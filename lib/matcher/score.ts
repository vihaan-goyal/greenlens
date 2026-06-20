// Pure module — imports nothing from React/Next.
// Stage 2 of the matcher: scoring.
//
// The live scorer is now the LEARNED logistic-regression model in model.ts,
// fitted by `npm run matcher:train` on labeled pairs bootstrapped from the real
// catalog (see logistic.ts / labeling.ts). `score()` returns its match
// probability and `MATCH_THRESHOLD` is the threshold tuned at fit time — this is
// the "swap the hand weights for a learned logistic regression" seam paying off.
//
// The original hand-picked Fellegi-Sunter weights are kept below as
// `FEATURE_WEIGHTS` / `handScore` for reference and for the training script's
// learned-vs-hand weight comparison. They no longer drive matching, but they
// document the prior and are a ready fallback.

import type { FeatureKey, FeatureScores } from './features';
import { predictProba } from './logistic';
import { MATCHER_MODEL } from './model';

/**
 * Match probability in 0..1 from the learned model. Missing features stay
 * neutral via the model's (value, present) encoding — the same intent the hand
 * scorer's present-only normalization had.
 */
export function score(features: FeatureScores): number {
  return predictProba(MATCHER_MODEL, features);
}

/**
 * Pairs at/above this probability are treated as matches. Re-tuned from the hand
 * scorer's 0.62 to the logistic model's fit-time threshold; the two numbers live
 * on different scales (normalized weighted-average vs probability) and are not
 * comparable. See matcher.test.ts for the calibration tests this still satisfies.
 */
export const MATCH_THRESHOLD = MATCHER_MODEL.threshold;

// ─── legacy hand scorer (reference / fallback only) ──────────────────────────
// Fellegi-Sunter-style additive weighted average over features present on both
// sides, normalized by the sum of |weight| over available features so a missing
// GTIN drops that signal instead of zeroing the score. Superseded by `score()`
// above; retained because the training script reports learned weights against it.

export const FEATURE_WEIGHTS: Record<FeatureKey, number> = {
  gtinExact: 6.0,
  nameJaroWinkler: 2.0,
  nameTokenSet: 1.5,
  brandMatch: 2.5,
  ingredientsOverlap: 3.0,
  sizeMatch: 1.0,
};

/** The pre-learning hand scorer. Kept for comparison; not used by the matcher. */
export function handScore(features: FeatureScores): number {
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
