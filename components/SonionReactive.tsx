'use client';

import { useWeights } from '@/lib/store';
import { overall } from '@/lib/domain/scoring';
import type { Pillars } from '@/lib/domain/types';
import { Sonion, type SonionMood } from './Sonion';

interface Props {
  pillars: Pillars;
  size?: number;
  halo?: boolean;
}

/**
 * Sonion whose mood tracks the current weighted overall: happy ≥70, neutral
 * 55–69, concerned <55. Mirrors the Sonion spec from CLAUDE.md.
 */
export function SonionReactive({ pillars, size = 96, halo = false }: Props) {
  const weights = useWeights((s) => s.weights);
  const o = overall(pillars, weights);
  const mood: SonionMood =
    o === null ? 'neutral' : o >= 70 ? 'happy' : o >= 55 ? 'neutral' : 'concerned';
  return <Sonion mood={mood} size={size} halo={halo} />;
}
