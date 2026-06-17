import { create } from 'zustand';
import type { Axis, Weights } from './domain/types';
import { defaultWeights } from './domain/scoring';

interface WeightsState {
  weights: Weights;
  setWeight: (axis: Axis, value: number) => void;
  reset: () => void;
}

/**
 * User-controlled weights. Session-only — composite scores are recomputed at
 * read time from these and never persisted (see CLAUDE.md's one rule).
 * Weights themselves persisting (e.g. to localStorage as user prefs) is fine
 * but deferred; out of scope for Phase 2.
 */
export const useWeights = create<WeightsState>((set) => ({
  weights: defaultWeights(),
  setWeight: (axis, value) =>
    set((s) => ({ weights: { ...s.weights, [axis]: Math.max(0, value) } })),
  reset: () => set({ weights: defaultWeights() }),
}));
