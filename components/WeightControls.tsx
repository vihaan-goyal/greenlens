'use client';

import { useWeights } from '@/lib/store';
import { AXES, AXIS_LABEL, type Axis } from '@/lib/domain/types';

const MAX = 3;
const STEP = 0.1;

/**
 * Collapsible sliders, one per axis. User-owned: no hidden "objective"
 * defaults — the equal-weights starting point is explicit, and the reset
 * button names what it does. Changing a slider updates the global weights
 * store, which the ScoreRing and CompositeRange subscribe to for live
 * recompute.
 */
export function WeightControls() {
  const weights = useWeights((s) => s.weights);
  const setWeight = useWeights((s) => s.setWeight);
  const reset = useWeights((s) => s.reset);

  return (
    <details
      className="group relative overflow-hidden rounded-card"
      style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
    >
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5"
        style={{ borderBottom: '1px solid transparent' }}
      >
        <span className="flex items-center gap-2.5">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-full"
            style={{
              background: 'var(--card-2)',
              border: '1px solid var(--line-soft)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="var(--accent-deep)" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 3 H 9" />
              <circle cx="9" cy="3" r="1.5" />
              <path d="M2 6.5 H 6" />
              <circle cx="6" cy="6.5" r="1.5" />
              <path d="M2 10 H 11" />
              <circle cx="11" cy="10" r="1.5" />
            </svg>
          </span>
          <span>
            <p className="font-display text-[15px] font-semibold leading-none text-ink">
              Tune your weights
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              composite recomputes live
            </p>
          </span>
        </span>
        <span
          className="font-display text-[20px] italic leading-none transition group-open:rotate-45"
          style={{ color: 'var(--accent-deep)' }}
        >
          +
        </span>
      </summary>

      <div className="space-y-4 px-4 pb-4 pt-1" style={{ borderTop: '1px dashed var(--line-soft)' }}>
        {AXES.map((axis) => (
          <Slider key={axis} axis={axis} value={weights[axis]} onChange={setWeight} />
        ))}

        <div className="flex items-center justify-between gap-3 pt-1 text-[10px] text-ink-3">
          <span className="leading-snug">
            0 means ignored. Higher = more weight in your composite.
          </span>
          <button
            type="button"
            onClick={reset}
            className="shrink-0 rounded-pill px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-2"
            style={{ background: 'var(--card-2)', border: '1px solid var(--line)' }}
          >
            Reset to equal
          </button>
        </div>
      </div>
    </details>
  );
}

function Slider({
  axis,
  value,
  onChange,
}: {
  axis: Axis;
  value: number;
  onChange: (axis: Axis, v: number) => void;
}) {
  const id = `weight-${axis}`;
  const pct = (value / MAX) * 100;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor={id} className="text-[13px] font-medium text-ink">
          {AXIS_LABEL[axis]}
        </label>
        <span
          className="tabular rounded-pill px-2 py-0.5 text-[10px] font-semibold"
          style={{
            color: value === 0 ? 'var(--ink-3)' : 'var(--accent-deep)',
            background: value === 0 ? 'var(--card-2)' : 'color-mix(in srgb, var(--accent-deep) 12%, transparent)',
          }}
        >
          {value.toFixed(1)}×
        </span>
      </div>
      <div className="relative h-2 rounded-pill" style={{ background: 'var(--card-2)' }}>
        <span
          className="absolute inset-y-0 left-0 rounded-pill"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--accent) 0%, var(--accent-deep) 100%)',
            transition: 'width 200ms ease',
          }}
        />
        <input
          id={id}
          type="range"
          min={0}
          max={MAX}
          step={STEP}
          value={value}
          onChange={(e) => onChange(axis, Number(e.target.value))}
          aria-valuemin={0}
          aria-valuemax={MAX}
          aria-valuenow={value}
          className="absolute inset-0 w-full cursor-pointer opacity-0"
          style={{ height: '100%' }}
        />
        <span
          aria-hidden
          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full ring-2 ring-card"
          style={{
            left: `calc(${pct}% - 8px)`,
            background: 'var(--accent-deep)',
            boxShadow: '0 2px 6px rgba(46, 42, 34, 0.18)',
            transition: 'left 200ms ease',
          }}
        />
      </div>
    </div>
  );
}
