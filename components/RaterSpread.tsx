import {
  AXES,
  AXIS_LABEL,
  FUNDING_LABEL,
  type FundingModel,
  type Pillars,
} from '@/lib/domain/types';
import { VERDICT_VAR, verdictBand } from '@/lib/domain/verdict';

/**
 * The product-page hero. Per-axis, each rater is a row with name + a prominent
 * funding chip + a 0–100 track with a verdict-colored dot at the rater's
 * normalized score. Same-axis disagreement is called out in the axis header,
 * with a connecting bracket between the extreme raters so the spread reads as
 * one object, not two dots. Pure presentation of pillars — no weights.
 */
export function RaterSpread({ pillars }: { pillars: Pillars }) {
  return (
    <div className="space-y-7" aria-label="Where each rater lands">
      {AXES.map((axis) => {
        const p = pillars[axis];
        if (p.ratings.length === 0) return null;

        const split = p.disagreement && p.spread;
        const lo = p.spread?.min ?? null;
        const hi = p.spread?.max ?? null;

        return (
          <section key={axis}>
            <header className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-[12px] font-bold uppercase tracking-[0.16em] text-ink">
                {split ? (
                  <span className="mark-clay">{AXIS_LABEL[axis]}</span>
                ) : (
                  AXIS_LABEL[axis]
                )}
              </h3>
              {split && lo !== null && hi !== null ? (
                <span
                  className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] tabular shadow-card"
                  style={{
                    background: 'var(--verdict-poor)',
                    color: 'var(--card)',
                  }}
                >
                  Split · {Math.round(hi - lo)} pts apart
                </span>
              ) : p.ratings.length > 1 ? (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.10em]"
                  style={{ background: 'var(--card-2)', color: 'var(--ink-2)' }}
                >
                  Raters agree
                </span>
              ) : null}
            </header>

            <ul className="space-y-4">
              {p.ratings.map((r) => {
                const band = verdictBand(r.score);
                const color = band ? VERDICT_VAR[band] : 'var(--ink-3)';
                const left = Math.max(0, Math.min(100, r.score));

                return (
                  <li key={r.sourceId}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[14px] font-semibold text-ink">
                          {r.sourceName}
                        </span>
                        <FundingChip funding={r.fundingModel} />
                      </div>
                      <span
                        className="shrink-0 font-display text-[20px] font-semibold leading-none tabular"
                        style={{ color }}
                        aria-label={`Normalized score ${Math.round(r.score)}`}
                      >
                        {Math.round(r.score)}
                      </span>
                    </div>

                    <div
                      className="relative h-2.5 rounded-full"
                      style={{
                        background: 'var(--card-2)',
                        boxShadow: 'inset 0 0 0 1px var(--line-soft)',
                      }}
                      role="presentation"
                    >
                      {[25, 50, 75].map((t) => (
                        <span
                          key={t}
                          aria-hidden
                          className="absolute top-1/2 h-1.5 w-px -translate-y-1/2"
                          style={{ left: `${t}%`, background: 'var(--ink-3)', opacity: 0.35 }}
                        />
                      ))}
                      <span
                        className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
                        style={{
                          left: `${left}%`,
                          background: color,
                          boxShadow: '0 0 0 2.5px var(--card), 0 1px 3px rgba(46,42,34,0.30)',
                        }}
                        aria-hidden
                      />
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Footer bracket: when split, name the two extremes inline so the
                spread isn't just a visual — it's stated in plain language. */}
            {split && lo !== null && hi !== null && p.ratings.length >= 2 && (
              <p className="mt-3 text-[11.5px] leading-snug text-ink-2">
                Lowest{' '}
                <span className="tabular font-bold text-ink">
                  {Math.round(lo)}
                </span>{' '}
                · highest{' '}
                <span className="tabular font-bold text-ink">
                  {Math.round(hi)}
                </span>{' '}
                · gap{' '}
                <span className="tabular font-bold" style={{ color: 'var(--verdict-poor)' }}>
                  {Math.round(hi - lo)}
                </span>
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

const FUNDING_TONE: Record<FundingModel, { bg: string; fg: string; border: string }> = {
  // Neutral palette by design — funding model is *information*, not a value
  // judgment. We don't want to silently code "ad-supported = bad" via color.
  // We do, however, want it to read as a distinct stamp: thin outlined pill
  // on cream instead of a filled tag.
  nonprofit:    { bg: 'transparent', fg: 'var(--ink)', border: 'var(--ink-2)' },
  independent:  { bg: 'transparent', fg: 'var(--ink)', border: 'var(--ink-2)' },
  ad_supported: { bg: 'transparent', fg: 'var(--ink)', border: 'var(--ink-2)' },
  subscription: { bg: 'transparent', fg: 'var(--ink)', border: 'var(--ink-2)' },
};

function FundingChip({ funding }: { funding: FundingModel }) {
  const tone = FUNDING_TONE[funding];
  return (
    <span
      className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
      style={{
        background: tone.bg,
        color: tone.fg,
        border: `1px solid ${tone.border}`,
      }}
    >
      {FUNDING_LABEL[funding]}
    </span>
  );
}
