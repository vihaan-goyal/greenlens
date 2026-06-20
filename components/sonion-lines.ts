// Pure copy generator for Sonion's reactive speech. No React imports — the
// narration is unit-tested in isolation and stays honest by construction.
// CLAUDE.md: "on weight change he comments truthfully via marginalEffect,
// naming the pillar and any verdict-band crossing. Small rotation of low-key
// lines for negligible changes." Short, plain-spoken, no marketing voice.

import { AXIS_PHRASE, type Axis } from '../lib/domain/types';
import { verdictBand, VERDICT_LABEL } from '../lib/domain/verdict';
import type { MarginalEffect } from '../lib/domain/scoring';

/** Below this many composite points, a change isn't worth a real claim. */
const NEGLIGIBLE = 0.5;

/**
 * Filler for changes that don't move the composite or cross a band. Rotated by
 * a caller-supplied counter so back-to-back tiny nudges don't repeat verbatim.
 * Deliberately makes no claim about any pillar.
 */
export const LOW_KEY_LINES: readonly string[] = [
  'Barely budges it.',
  'About the same.',
  'Noted — no real change.',
  'That one’s a wash.',
];

export interface WeightChangeInput {
  /** Composite before the change (null when nothing contributed yet). */
  prevOverall: number | null;
  /** Composite after the change (null when nothing contributes). */
  nextOverall: number | null;
  /** The single axis whose weight the user just moved, if known. */
  changedAxis: Axis | null;
  /** marginalEffect(pillars, weights, changedAxis) from the domain layer. */
  effect: MarginalEffect;
  /** Did the changed axis's weight go up (true) or down (false)? */
  increased: boolean;
  /** Rotates the low-key filler so repeats vary; any integer is fine. */
  rotation?: number;
}

/**
 * One honest line about the weight change the user just made. Names the pillar
 * the user touched, whether they leaned in or eased off, and whether the
 * composite actually rose or fell as a result; appends the verdict-band
 * crossing when the change tips the score into a new band. The verb follows the
 * real before/after movement so it can never contradict the band crossing.
 */
export function narrateWeightChange(input: WeightChangeInput): string {
  const { prevOverall, nextOverall, changedAxis, effect, increased, rotation = 0 } = input;

  if (nextOverall === null || changedAxis === null) {
    return 'Set a weight above zero and I’ll tell you what moves.';
  }

  const prevBand = verdictBand(prevOverall);
  const nextBand = verdictBand(nextOverall);
  const crossed = prevBand !== null && nextBand !== null && prevBand !== nextBand;
  const delta = prevOverall === null ? Infinity : nextOverall - prevOverall;

  // Negligible and no band crossing → low-key, claim-free rotation.
  if (!crossed && Math.abs(delta) < NEGLIGIBLE) {
    const i = ((rotation % LOW_KEY_LINES.length) + LOW_KEY_LINES.length) % LOW_KEY_LINES.length;
    return LOW_KEY_LINES[i]!;
  }

  const axis = AXIS_PHRASE[changedAxis];
  const lean = increased ? `More weight on ${axis}` : `Easing off ${axis}`;
  // Did the composite actually rise? Prefer the real before/after; with no prior
  // composite, fall back to marginalEffect (raising a lifting axis lifts).
  const rises =
    prevOverall === null ? (effect === 'lifts') === increased : nextOverall > prevOverall;
  const verb = rises ? 'lifts your score' : 'drags it down';

  if (crossed) {
    return `${lean} ${verb} — that tips it from ${VERDICT_LABEL[prevBand!]} to ${VERDICT_LABEL[nextBand!]}.`;
  }
  return `${lean} ${verb}.`;
}

/**
 * Opening line shown on first mount — a greeting keyed to the verdict band, not
 * a change comment, so the bubble is never silent to start.
 */
export function greet(overall: number | null): string {
  const band = verdictBand(overall);
  switch (band) {
    case 'excellent':
    case 'good':
      return 'Looks solid from here. Tune the weights and I’ll keep you honest.';
    case 'fair':
      return 'Middling so far. Shift the weights to see what carries it.';
    case 'poor':
    case 'bad':
      return 'Worth a closer look. Adjust the weights and watch what drags.';
    default:
      return 'Set a weight above zero and I’ll tell you what moves.';
  }
}
