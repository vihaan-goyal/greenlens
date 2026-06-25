import { create } from 'zustand';
import type { Axis, Weights } from './domain/types';
import { defaultWeights } from './domain/scoring';

const WEIGHTS_KEY = 'greenlens.weights';

function readStored(): Weights {
  if (typeof window === 'undefined') return defaultWeights();
  try {
    const raw = localStorage.getItem(WEIGHTS_KEY);
    if (raw) return { ...defaultWeights(), ...JSON.parse(raw) };
  } catch {}
  return defaultWeights();
}

function writeStored(weights: Weights) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
    // Notify the Greenlens extension content script (if present) so it can sync
    // the new weights into chrome.storage.local before the user navigates away.
    window.postMessage({ kind: 'gl:weightsChanged', weights }, window.location.origin);
  } catch {}
}

interface WeightsState {
  weights: Weights;
  setWeight: (axis: Axis, value: number) => void;
  reset: () => void;
}

export const useWeights = create<WeightsState>()((set, get) => ({
  weights: defaultWeights(),
  setWeight: (axis, value) => {
    const weights = { ...get().weights, [axis]: Math.max(0, value) };
    writeStored(weights);
    set({ weights });
  },
  reset: () => {
    const weights = defaultWeights();
    writeStored(weights);
    set({ weights });
  },
}));

// Hydrate from localStorage on the client after module load.
// Runs once, after React hydration, so the server-rendered HTML (which uses
// defaultWeights) matches the initial client render before this updates state.
if (typeof window !== 'undefined') {
  const stored = readStored();
  const defaults = defaultWeights();
  const differs = (Object.keys(defaults) as Axis[]).some(
    (k) => stored[k] !== defaults[k],
  );
  if (differs) useWeights.setState({ weights: stored });
}
