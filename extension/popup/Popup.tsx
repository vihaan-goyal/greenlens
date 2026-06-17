import { useEffect, useState } from 'react';
import { AXES, AXIS_LABEL, type Weights } from '@/lib/domain/types';
import { defaultWeights } from '@/lib/domain/scoring';

const WEIGHTS_KEY = 'greenlens.weights';

/**
 * Toolbar popup. For the scaffold this is just the weight panel — the
 * "recent sightings" list and rater detail land in later passes.
 */
export function Popup() {
  const [weights, setWeights] = useState<Weights>(defaultWeights);

  useEffect(() => {
    chrome.storage.sync.get([WEIGHTS_KEY], (s) => {
      const v = s[WEIGHTS_KEY] as Partial<Weights> | undefined;
      if (v) setWeights({ ...defaultWeights(), ...v });
    });
  }, []);

  const update = (axis: keyof Weights, value: number) => {
    const next: Weights = { ...weights, [axis]: Math.max(0, value) };
    setWeights(next);
    chrome.storage.sync.set({ [WEIGHTS_KEY]: next });
  };

  return (
    <main style={{ padding: 20 }}>
      <p style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: '0 0 4px' }}>
        Your weighting
      </p>
      <h1 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 22, margin: '0 0 16px' }}>
        How you want to score
      </h1>
      {AXES.map((axis) => (
        <label key={axis} style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-2)' }}>
            <span>{AXIS_LABEL[axis]}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
              {weights[axis].toFixed(1)}
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={3}
            step={0.1}
            value={weights[axis]}
            onChange={(e) => update(axis, Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </label>
      ))}
      <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 18 }}>
        Composite scores are computed from these weights at read time — never stored.
      </p>
    </main>
  );
}
