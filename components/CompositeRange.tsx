'use client';

import { useWeights } from '@/lib/store';
import { overallRange, topMarginalDriver } from '@/lib/domain/scoring';
import { VERDICT_LABEL, VERDICT_VAR, verdictBand } from '@/lib/domain/verdict';
import {
  AXIS_LABEL,
  FUNDING_LABEL,
  type Pillars,
  type VerdictBand,
} from '@/lib/domain/types';

const MARK_BY_BAND: Record<VerdictBand, string> = {
  excellent: 'mark-leaf',
  good: 'mark-leaf',
  fair: 'mark-amber',
  poor: 'mark-clay',
  bad: 'mark-rose',
};

/**
 * The composite, demoted to a range and recomputed live from the weights
 * store. CLAUDE.md's one rule: composite is never persisted, surfaced as a
 * range when the axes disagree, and the driver prose names exactly what is
 * pulling the score and who said what about it.
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
      {/* Headline: huge serif numeral + filled verdict pill */}
      <div className="flex items-end gap-3">
        <span
          className="font-display font-semibold leading-none tabular"
          style={{
            fontSize: '64px',
            color,
            letterSpacing: '-0.04em',
            transition: 'color 200ms ease',
          }}
          aria-label={`Composite mean ${Math.round(range.mean)}`}
        >
          {Math.round(range.mean)}
        </span>
        <div className="pb-1">
          <span
            className="inline-block rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] shadow-card"
            style={{ background: color, color: 'var(--card)' }}
          >
            {label}
          </span>
          {hasRange && (
            <p className="mt-1 text-[11px] uppercase tracking-[0.10em] tabular text-ink-3">
              Range {Math.round(range.min)}<span className="px-0.5">–</span>{Math.round(range.max)}
            </p>
          )}
        </div>
      </div>

      {/* Track: bracket from min→max with a marker at the mean */}
      <div className="mt-4">
        <div className="relative h-4 overflow-hidden rounded-full" style={{ background: 'var(--card-2)', boxShadow: 'inset 0 0 0 1px var(--line-soft)' }} role="presentation">
          {[25, 50, 75].map((t) => (
            <span
              key={t}
              aria-hidden
              className="absolute top-1/2 h-2 w-px -translate-y-1/2"
              style={{ left: `${t}%`, background: 'var(--ink-3)', opacity: 0.35 }}
            />
          ))}
          {hasRange && (
            <span
              className="absolute inset-y-0 rounded-full"
              style={{
                left: `${range.min}%`,
                right: `${100 - range.max}%`,
                background: `color-mix(in srgb, ${color} 42%, transparent)`,
                transition: 'left 400ms ease, right 400ms ease, background 200ms ease',
              }}
              aria-hidden
            />
          )}
          <span
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${range.mean}%`,
              background: color,
              boxShadow: '0 0 0 3px var(--card), 0 2px 5px rgba(46,42,34,0.30)',
              transition: 'left 400ms ease, background 200ms ease',
            }}
            aria-hidden
          />
        </div>

        <div className="mt-1 flex justify-between text-[10px] font-semibold uppercase tracking-[0.10em] tabular text-ink-3">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>

      {/* Driver prose: the axis name gets a highlighter mark, the verb gets a
          verdict-colored underline. The thesis lives here. */}
      {driverProse && (
        <p className="mt-5 text-[13.5px] leading-relaxed text-ink">
          <span className={`font-bold ${band ? MARK_BY_BAND[band] : 'mark-sand'}`}>
            {driverProse.axisLabel}
          </span>{' '}
          is{' '}
          <span
            className="font-bold u-bold"
            style={{
              textDecorationColor:
                driverProse.direction === 'lifts'
                  ? 'var(--verdict-excellent)'
                  : 'var(--verdict-poor)',
            }}
          >
            {driverProse.direction === 'lifts' ? 'lifting' : 'dragging'}
          </span>{' '}
          your score{driverProse.tail}
        </p>
      )}
    </div>
  );
}

interface DriverProse {
  axisLabel: string;
  direction: 'lifts' | 'drags';
  tail: string;
}

function describeDriver(
  pillars: Pillars,
  weights: Record<string, number>,
): DriverProse | null {
  const driver = topMarginalDriver(pillars, weights as Parameters<typeof topMarginalDriver>[1]);
  if (!driver) return null;
  const p = pillars[driver.axis];
  const axisLabel = AXIS_LABEL[driver.axis];

  if (p.disagreement && p.ratings.length >= 2) {
    const sorted = [...p.ratings].sort((a, b) => a.score - b.score);
    const low = sorted[0]!;
    const high = sorted[sorted.length - 1]!;
    return {
      axisLabel,
      direction: driver.direction,
      tail:
        ` — ${low.sourceName} (${FUNDING_LABEL[low.fundingModel]}) scores it ` +
        `${Math.round(low.score)} while ${high.sourceName} ` +
        `(${FUNDING_LABEL[high.fundingModel]}) scores it ${Math.round(high.score)}.`,
    };
  }

  const sole = p.ratings[0];
  if (sole) {
    return {
      axisLabel,
      direction: driver.direction,
      tail: ` — ${sole.sourceName} (${FUNDING_LABEL[sole.fundingModel]}) scores it ${Math.round(sole.score)}.`,
    };
  }
  return { axisLabel, direction: driver.direction, tail: '.' };
}
