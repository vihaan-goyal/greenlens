import {
  AXES,
  type Axis,
  type NormalizedRating,
  type PillarSummary,
  type Pillars,
  type Source,
  type Weights,
} from './types';

/**
 * Flat shape the scorer needs: one entry per rating, already joined to its
 * source. Listings/ratings live in the data layer; this type lets domain
 * code stay free of join concerns.
 */
export interface ScoredRating {
  sourceId: string;
  scoreRaw: number;
}

/** Threshold (normalized 0-100 points) at which same-axis ratings count as disagreeing. */
export const DISAGREEMENT_THRESHOLD = 20;

/** Map a native source score onto a 0..100 higher-is-better scale. */
export function normalizeScore(scoreRaw: number, source: Source): number {
  const { scaleMin, scaleMax, scaleDirection } = source;
  if (scaleMax === scaleMin) return 0;
  const clamped = Math.max(scaleMin, Math.min(scaleMax, scoreRaw));
  const t = (clamped - scaleMin) / (scaleMax - scaleMin);
  return scaleDirection === 'higher_is_better' ? t * 100 : (1 - t) * 100;
}

function emptyPillars(): Pillars {
  const out = {} as Pillars;
  for (const axis of AXES) {
    out[axis] = {
      axis,
      representative: null,
      spread: null,
      ratings: [],
      disagreement: false,
    };
  }
  return out;
}

/**
 * Roll a flat list of (Rating, Source) into a per-axis summary.
 * Same-axis ratings are kept individually — the representative is the mean,
 * but the spread and the full rating list stay available so the UI can
 * surface disagreement instead of hiding it.
 */
export function summarizePillars(
  ratings: ReadonlyArray<ScoredRating>,
  sources: ReadonlyArray<Source>,
): Pillars {
  const sourceMap = new Map(sources.map((s) => [s.id, s] as const));
  const pillars = emptyPillars();

  for (const r of ratings) {
    const source = sourceMap.get(r.sourceId);
    if (!source) continue;
    const normalized: NormalizedRating = {
      sourceId: source.id,
      sourceName: source.name,
      axis: source.axis,
      fundingModel: source.fundingModel,
      score: normalizeScore(r.scoreRaw, source),
      raw: r.scoreRaw,
    };
    pillars[source.axis].ratings.push(normalized);
  }

  for (const axis of AXES) {
    const summary = pillars[axis];
    const rs = summary.ratings;
    if (rs.length === 0) continue;
    const scores = rs.map((r) => r.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    pillars[axis] = {
      ...summary,
      representative: mean,
      spread: rs.length > 1 ? { min, max } : null,
      disagreement: rs.length > 1 && max - min >= DISAGREEMENT_THRESHOLD,
    };
  }

  return pillars;
}

/** Equal weights across the four axes — the default the UI starts with. */
export function defaultWeights(): Weights {
  return { ingredient_safety: 1, environmental: 1, labor: 1, packaging: 1 };
}

/**
 * Weighted mean over pillars that (a) have a non-zero weight and (b) have data.
 * Returns null when nothing contributes — never persisted; always recomputed
 * from the user's current weights.
 */
export function overall(pillars: Pillars, weights: Weights): number | null {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const axis of AXES) {
    const w = weights[axis];
    if (!Number.isFinite(w) || w <= 0) continue;
    const p: PillarSummary = pillars[axis];
    if (p.representative === null) continue;
    weightedSum += w * p.representative;
    weightTotal += w;
  }
  if (weightTotal === 0) return null;
  return weightedSum / weightTotal;
}

/**
 * Composite expressed as a range, not a single number. When raters within an
 * axis split, the composite has an honest band of uncertainty: the low end is
 * the weighted mean using each axis's lowest rater, the high end uses the
 * highest. Single-rater axes contribute their representative to both bounds.
 */
export interface CompositeRange {
  min: number;
  mean: number;
  max: number;
}

export function overallRange(pillars: Pillars, weights: Weights): CompositeRange | null {
  let sumMin = 0;
  let sumMean = 0;
  let sumMax = 0;
  let total = 0;
  for (const axis of AXES) {
    const w = weights[axis];
    if (!Number.isFinite(w) || w <= 0) continue;
    const p = pillars[axis];
    if (p.representative === null) continue;
    const lo = p.spread?.min ?? p.representative;
    const hi = p.spread?.max ?? p.representative;
    sumMin += w * lo;
    sumMean += w * p.representative;
    sumMax += w * hi;
    total += w;
  }
  if (total === 0) return null;
  return { min: sumMin / total, mean: sumMean / total, max: sumMax / total };
}

/**
 * The axis pulling hardest on the user's composite right now, picked by
 *   |x_j − overall| × w_j
 * which matches the influence each axis is exerting on the weighted mean at
 * the current weights. Returned so the UI can name the driver in prose
 * ("Ingredient safety is dragging your score…") instead of just a chip.
 */
export interface MarginalDriver {
  axis: Axis;
  direction: 'lifts' | 'drags';
  /** Influence magnitude — bigger means this axis moves the composite more. */
  magnitude: number;
}

export function topMarginalDriver(pillars: Pillars, weights: Weights): MarginalDriver | null {
  const o = overall(pillars, weights);
  if (o === null) return null;
  let best: MarginalDriver | null = null;
  for (const axis of AXES) {
    const w = weights[axis];
    if (!Number.isFinite(w) || w <= 0) continue;
    const p = pillars[axis];
    if (p.representative === null) continue;
    const diff = p.representative - o;
    if (Math.abs(diff) < 0.5) continue; // negligible — skip
    const magnitude = Math.abs(diff) * w;
    if (!best || magnitude > best.magnitude) {
      best = { axis, direction: diff > 0 ? 'lifts' : 'drags', magnitude };
    }
  }
  return best;
}

export type MarginalEffect = 'lifts' | 'drags' | 'neutral' | 'unavailable';

/**
 * Sign of d(overall)/d(weights[axis]) at the current weights. Derived from
 *   overall = Σ w_i x_i / Σ w_i  ⇒  ∂overall/∂w_j = (x_j − overall) / Σ w_i
 * so raising the axis weight lifts the overall iff that axis sits above the
 * current weighted mean. Lets Sonion say "this pillar carries the score" /
 * "drags it down" truthfully.
 */
export function marginalEffect(pillars: Pillars, weights: Weights, axis: Axis): MarginalEffect {
  const p = pillars[axis];
  if (p.representative === null) return 'unavailable';
  const current = overall(pillars, weights);
  // No current overall (every weight zero or every pillar empty) — raising this
  // weight from zero gives overall = pillar.representative > nothing, i.e. lifts.
  if (current === null) return 'lifts';
  const diff = p.representative - current;
  if (Math.abs(diff) < 1e-9) return 'neutral';
  return diff > 0 ? 'lifts' : 'drags';
}
