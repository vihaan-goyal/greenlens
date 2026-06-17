import {
  AXES,
  AXIS_LABEL,
  FUNDING_LABEL,
  type FundingModel,
  type Pillars,
} from '@/lib/domain/types';
import { VERDICT_VAR, verdictBand } from '@/lib/domain/verdict';

/**
 * The new product-page hero. Per-axis, each rater is a row with name + a
 * prominent funding chip + a 0–100 track with a verdict-colored dot at the
 * rater's normalized score. Same-axis disagreement is called out in the axis
 * header, not buried as a chip on a pillar. Pure presentation of pillars —
 * no weights, no composite. The composite range lives below in CompositeRange.
 */
export function RaterSpread({ pillars }: { pillars: Pillars }) {
  return (
    <div className="space-y-6" aria-label="Where each rater lands">
      {AXES.map((axis) => {
        const p = pillars[axis];
        if (p.ratings.length === 0) return null;

        return (
          <section key={axis}>
            <header className="mb-2.5 flex items-center justify-between gap-2">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-2">
                {AXIS_LABEL[axis]}
              </h3>
              {p.disagreement && p.spread ? (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                  style={{
                    background:
                      'color-mix(in srgb, var(--verdict-poor) 14%, transparent)',
                    color: 'var(--verdict-poor)',
                  }}
                >
                  Raters split · {Math.round(p.spread.max - p.spread.min)} pts apart
                </span>
              ) : p.ratings.length > 1 ? (
                <span className="text-[10px] uppercase tracking-wider text-ink-3">
                  Raters agree
                </span>
              ) : null}
            </header>

            <ul className="space-y-3">
              {p.ratings.map((r) => {
                const band = verdictBand(r.score);
                const color = band ? VERDICT_VAR[band] : 'var(--ink-3)';
                const left = Math.max(0, Math.min(100, r.score));

                return (
                  <li key={r.sourceId}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium text-ink">
                          {r.sourceName}
                        </span>
                        <FundingChip funding={r.fundingModel} />
                      </div>
                      <span
                        className="shrink-0 text-[13px] font-semibold tabular"
                        style={{ color }}
                        aria-label={`Normalized score ${Math.round(r.score)}`}
                      >
                        {Math.round(r.score)}
                      </span>
                    </div>

                    <div
                      className="relative h-2 rounded-full bg-card-2"
                      role="presentation"
                    >
                      <span
                        className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
                        style={{
                          left: `${left}%`,
                          background: color,
                        }}
                        aria-hidden
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

const FUNDING_TONE: Record<FundingModel, { bg: string; fg: string }> = {
  // Neutral palette by design — funding model is *information*, not a value
  // judgment. We don't want to silently code "ad-supported = bad" via color.
  nonprofit: { bg: 'var(--card-2)', fg: 'var(--ink-2)' },
  independent: { bg: 'var(--card-2)', fg: 'var(--ink-2)' },
  ad_supported: { bg: 'var(--card-2)', fg: 'var(--ink-2)' },
  subscription: { bg: 'var(--card-2)', fg: 'var(--ink-2)' },
};

function FundingChip({ funding }: { funding: FundingModel }) {
  const tone = FUNDING_TONE[funding];
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {FUNDING_LABEL[funding]}
    </span>
  );
}
