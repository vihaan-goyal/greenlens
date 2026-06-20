'use client';

import { useEffect, useRef, useState } from 'react';
import { useWeights } from '@/lib/store';
import { overall, marginalEffect } from '@/lib/domain/scoring';
import { AXES, type Pillars, type Weights } from '@/lib/domain/types';
import { Sonion, type SonionMood } from './Sonion';
import { narrateWeightChange, greet } from './sonion-lines';

interface Props {
  pillars: Pillars;
  size?: number;
  halo?: boolean;
}

/** How long the bubble stays out before it tucks away on its own. */
const TUCK_MS = 5000;
/** How long Sonion nods / mouths a comment after a change. */
const SPEAK_MS = 1300;

/**
 * Sonion as a reactive guide. His mood tracks the weighted overall (happy ≥70,
 * neutral 55–69, concerned <55), and on every weight change he comments
 * truthfully via marginalEffect — naming the pillar the user leaned into and
 * any verdict-band crossing — in a bubble that auto-tucks after ~5s or on tap.
 * Reduced-motion users still get the copy, just without the nod/mouth motion.
 */
export function SonionReactive({ pillars, size = 96, halo = false }: Props) {
  const weights = useWeights((s) => s.weights);
  const o = overall(pillars, weights);
  const mood: SonionMood =
    o === null ? 'neutral' : o >= 70 ? 'happy' : o >= 55 ? 'neutral' : 'concerned';

  const reduced = usePrefersReducedMotion();

  const [line, setLine] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const prevWeightsRef = useRef<Weights | null>(null);
  const prevOverallRef = useRef<number | null>(o);
  const rotationRef = useRef(0);
  const tuckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function armTuck() {
    if (tuckTimer.current) clearTimeout(tuckTimer.current);
    tuckTimer.current = setTimeout(() => setOpen(false), TUCK_MS);
  }

  function dismiss() {
    setOpen(false);
    setSpeaking(false);
    if (tuckTimer.current) clearTimeout(tuckTimer.current);
    if (speakTimer.current) clearTimeout(speakTimer.current);
  }

  // Greeting on first mount — keyed to the band, not a change comment, so the
  // bubble is never silent to start. Also seeds the "previous" refs.
  useEffect(() => {
    setLine(greet(o));
    setOpen(true);
    prevWeightsRef.current = weights;
    prevOverallRef.current = o;
    armTuck();
    return () => {
      if (tuckTimer.current) clearTimeout(tuckTimer.current);
      if (speakTimer.current) clearTimeout(speakTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to weight changes.
  useEffect(() => {
    const prev = prevWeightsRef.current;
    if (!prev) return; // mount effect owns the first paint
    const changed = AXES.filter((a) => prev[a] !== weights[a]);
    if (changed.length === 0) return;

    const prevOverall = prevOverallRef.current;
    let next: string;
    if (changed.length === 1) {
      const axis = changed[0]!;
      const effect = marginalEffect(pillars, weights, axis);
      next = narrateWeightChange({
        prevOverall,
        nextOverall: o,
        changedAxis: axis,
        effect,
        increased: weights[axis] > prev[axis],
        rotation: rotationRef.current,
      });
    } else {
      // Bulk change (e.g. "Reset to equal") — restate calmly rather than claim
      // a single pillar moved it.
      next = greet(o);
    }
    rotationRef.current += 1;

    setLine(next);
    setOpen(true);
    if (!reduced) {
      setSpeaking(true);
      if (speakTimer.current) clearTimeout(speakTimer.current);
      speakTimer.current = setTimeout(() => setSpeaking(false), SPEAK_MS);
    }
    armTuck();

    prevWeightsRef.current = weights;
    prevOverallRef.current = o;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weights]);

  return (
    <div className="flex flex-col items-end gap-2">
      {/* Persistent polite live region so screen-reader users hear each new
          comment when the weights change — not just sighted users. The button's
          text is its accessible name (a single trailing period); the dismiss
          affordance is conveyed by its button role plus the title tooltip. */}
      <div role="status" aria-live="polite" className="flex justify-end">
        {open && line && (
          <button
            type="button"
            onClick={dismiss}
            title="Tap to dismiss"
            className="anim-rise max-w-[15rem] rounded-2xl rounded-br-md px-3.5 py-2.5 text-left text-[12.5px] font-medium leading-snug shadow-card"
            style={{
              background: 'var(--card)',
              color: 'var(--ink)',
              border: '1px solid var(--line-soft)',
            }}
          >
            {line}
          </button>
        )}
      </div>
      <Sonion mood={mood} size={size} halo={halo} speaking={speaking} />
    </div>
  );
}

/** True when the user has asked the OS/browser to reduce motion. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}
