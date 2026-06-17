'use client';

import { useWeights } from '@/lib/store';
import { AXES, AXIS_LABEL, type Axis } from '@/lib/domain/types';

const MAX = 3;
const STEP = 0.1;

/**
 * Collapsible sliders, one per axis. User-owned: no hidden "objective"
 * defaults — the equal-weights starting point is explicit, and the reset
 * button names what it does. Changing a slider updates the global weights
 * store, which the ScoreRing and PillarBreakdown subscribe to for live
 * recompute.
 */
export function WeightControls() {
  const weights = useWeights((s) => s.weights);
  const setWeight = useWeights((s) => s.setWeight);
  const reset = useWeights((s) => s.reset);

  return (
    <details className="rounded-card bg-card ring-1 ring-line">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink hover:bg-card-2">
        <span className="flex items-center justify-between">
          <span>Adjust your weights</span>
          <span className="text-xs text-ink-3">tap to expand</span>
        </span>
      </summary>

      <div className="space-y-4 border-t border-line px-4 py-4">
        {AXES.map((axis) => (
          <Slider key={axis} axis={axis} value={weights[axis]} onChange={setWeight} />
        ))}

        <div className="flex items-center justify-between text-[11px] text-ink-3">
          <span>0 means ignored. Higher = more weight in your composite.</span>
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-card-2 px-3 py-1 text-ink-2 hover:bg-sand"
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
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm text-ink">
          {AXIS_LABEL[axis]}
        </label>
        <span className="tabular text-xs text-ink-2">{value.toFixed(1)}×</span>
      </div>
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
        className="mt-1 w-full accent-espresso"
      />
    </div>
  );
}
