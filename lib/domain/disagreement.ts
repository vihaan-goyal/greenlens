import { AXES, AXIS_PHRASE, type Axis, type NormalizedRating, type Pillars } from './types';

export interface AxisDisagreement {
  axis: Axis;
  /** Normalized 0..100 point spread between the highest and lowest source. */
  spread: number;
  ratings: NormalizedRating[];
  high: NormalizedRating;
  low: NormalizedRating;
}

/**
 * Find axes whose ratings disagree (already flagged by summarizePillars) and
 * return a structured description that surfaces who is high, who is low, and
 * how each is funded. Funding model is included by design — surfacing who
 * pays for an opinion is the point of the product.
 */
export function detectDisagreements(pillars: Pillars): AxisDisagreement[] {
  const out: AxisDisagreement[] = [];
  for (const axis of AXES) {
    const p = pillars[axis];
    if (!p.disagreement || p.ratings.length < 2) continue;
    const sorted = [...p.ratings].sort((a, b) => a.score - b.score);
    const low = sorted[0]!;
    const high = sorted[sorted.length - 1]!;
    out.push({
      axis,
      spread: high.score - low.score,
      ratings: p.ratings,
      low,
      high,
    });
  }
  return out;
}

/** Plain-spoken one-liner naming both raters, their funding, and the spread. */
export function describeDisagreement(d: AxisDisagreement): string {
  return (
    `${d.high.sourceName} (${d.high.fundingModel}) scores ${Math.round(d.high.score)} on ${AXIS_PHRASE[d.axis]}; ` +
    `${d.low.sourceName} (${d.low.fundingModel}) scores ${Math.round(d.low.score)}. ` +
    `Spread ${Math.round(d.spread)} points.`
  );
}
