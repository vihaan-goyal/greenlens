'use client';

import { useWeights } from '@/lib/store';
import { overallRange, topMarginalDriver } from '@/lib/domain/scoring';
import { VERDICT_LABEL, VERDICT_VAR, verdictBand } from '@/lib/domain/verdict';
import {
  AXIS_LABEL,
  FUNDING_LABEL,
  type Pillars,
} from '@/lib/domain/types';

/**
 * The composite, demoted: a colored band from min→max with a marker at the
 * mean, plus prose naming what's pulling the score. Recomputed live from the
 * weights store. The composite is never persisted (CLAUDE.md's one rule);
 * this component is the only place the four axes blend into one number, and
 * even then it shows uncertainty as a range instead of a single point.
 */
export function CompositeRange({ pillars }: { pillars: Pillars }) {
  const weights = useWeights((s) => s.weights);
  const range = overallRange(pillars, weights);

  if (!range) {
    return (
      <p className="text-sm text-ink-2">
        No axis has both data and weight. Bring one slider above zero to see a composite.
      </p>
    );
  }

  const band = verdictBand(range.mean);
  const color = band ? VERDICT_VAR[band] : 'var(--ink-3)';
  const label = band ? VERDICT_LABEL[band] : 'No data';
  const hasRange = range.max - range.min > 0.5;
  const driverProse = describeDriver(pillars, weights);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-2">
          Your composite
        </span>
        <span className="text-xs font-semibold" style={{ color }}>
          {label}
        </span>
      </div>

      <div className="relative h-3 overflow-hidden rounded-full bg-card-2" role="presentation">
        {hasRange && (
          <span
            className="absolute inset-y-0 rounded-full"
            style={{
              left: `${range.min}%`,
              right: `${100 - range.max}%`,
              background: `color-mix(in srgb, ${color} 38%, transparent)`,
              transition:
                'left 400ms ease, right 400ms ease, background 200ms ease',
            }}
            aria-hidden
          />
        )}
        <span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
          style={{
            left: `${range.mean}%`,
            background: color,
            transition: 'left 400ms ease, background 200ms ease',
          }}
          aria-label={`Composite mean ${Math.round(range.mean)}`}
        />
      </div>

      <div className="mt-1 flex justify-between text-[10px] tabular text-ink-3">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink">
        Weighted mean{' '}
        <span className="font-semibold tabular" style={{ color }}>
          {Math.round(range.mean)}
        </span>
        {hasRange && (
          <>
            {' '}
            · range{' '}
            <span className="tabular text-ink-2">
              {Math.round(range.min)}–{Math.round(range.max)}
            </span>
          </>
        )}
        .
      </p>

      {driverProse && (
        <p className="mt-2 text-sm leading-relaxed text-ink-2">{driverProse}</p>
      )}
    </div>
  );
}

function describeDriver(
  pillars: Pillars,
  weights: Record<string, number>,
): string | null {
  const driver = topMarginalDriver(pillars, weights as Parameters<typeof topMarginalDriver>[1]);
  if (!driver) return null;
  const verb = driver.direction === 'lifts' ? 'is lifting' : 'is dragging';
  const p = pillars[driver.axis];

  // If the driving axis has split raters, name them directly with funding so
  // the prose carries the thesis instead of just labeling a band.
  if (p.disagreement && p.ratings.length >= 2) {
    const sorted = [...p.ratings].sort((a, b) => a.score - b.score);
    const low = sorted[0]!;
    const high = sorted[sorted.length - 1]!;
    return (
      `${AXIS_LABEL[driver.axis]} ${verb} your score — ` +
      `${low.sourceName} (${FUNDING_LABEL[low.fundingModel]}) scores it ${Math.round(low.score)} ` +
      `while ${high.sourceName} (${FUNDING_LABEL[high.fundingModel]}) scores it ${Math.round(high.score)}.`
    );
  }

  // Single rater (or unanimous): just name the axis and the lone rater.
  const sole = p.ratings[0];
  if (sole) {
    return `${AXIS_LABEL[driver.axis]} ${verb} your score — ${sole.sourceName} (${FUNDING_LABEL[sole.fundingModel]}) scores it ${Math.round(sole.score)}.`;
  }
  return `${AXIS_LABEL[driver.axis]} ${verb} your score.`;
}
