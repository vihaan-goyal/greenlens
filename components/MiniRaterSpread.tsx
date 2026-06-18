import { AXIS_LABEL, type Axis, type Pillars } from '@/lib/domain/types';
import { VERDICT_VAR, verdictBand } from '@/lib/domain/verdict';

interface Props {
  pillars: Pillars;
  /** Which axis to summarize. Defaults to ingredient_safety (personal-safety-first). */
  axis?: Axis;
  /** Show the axis label + split/agree chip above the track. */
  showHeader?: boolean;
}

/**
 * Compact rater spread for list rows. One axis, a thicker track, a real
 * bracket connecting min↔max when raters disagree, and the numeric range
 * inline so the controversy is legible in 200ms of scanning.
 */
export function MiniRaterSpread({
  pillars,
  axis = 'ingredient_safety',
  showHeader = true,
}: Props) {
  const p = pillars[axis];
  if (p.ratings.length === 0) return null;

  const split = p.disagreement && p.spread;
  const lo = p.spread?.min ?? null;
  const hi = p.spread?.max ?? null;

  return (
    <div>
      {showHeader && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[10px]">
          <span className="font-semibold uppercase tracking-[0.14em] text-ink-2">
            {AXIS_LABEL[axis]}
          </span>
          {split && lo !== null && hi !== null ? (
            <span
              className="rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.10em] tabular shadow-card"
              style={{
                background: 'var(--verdict-poor)',
                color: 'var(--card)',
              }}
            >
              Split · {Math.round(lo)}<span className="px-0.5 opacity-70">→</span>{Math.round(hi)}
            </span>
          ) : p.ratings.length > 1 ? (
            <span className="rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-[0.10em] text-ink-2" style={{ background: 'var(--card-2)' }}>
              Raters agree
            </span>
          ) : (
            <span className="uppercase tracking-[0.10em] text-ink-3">1 rater</span>
          )}
        </div>
      )}

      <div className="relative h-2 rounded-full" style={{ background: 'var(--card-2)', boxShadow: 'inset 0 0 0 1px var(--line-soft)' }}>
        {/* tick marks at 25/50/75 — anchor the eye on the 0–100 scale */}
        {[25, 50, 75].map((t) => (
          <span
            key={t}
            aria-hidden
            className="absolute top-1/2 h-1 w-px -translate-y-1/2"
            style={{ left: `${t}%`, background: 'var(--ink-3)', opacity: 0.35 }}
          />
        ))}

        {/* spread bracket — connects min↔max with a thick verdict-poor stroke */}
        {split && lo !== null && hi !== null && (
          <span
            aria-hidden
            className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full"
            style={{
              left: `${lo}%`,
              right: `${100 - hi}%`,
              background: 'var(--verdict-poor)',
              opacity: 0.55,
            }}
          />
        )}

        {/* rater dots — bigger, with a thick card-colored ring for separation */}
        {p.ratings.map((r) => {
          const band = verdictBand(r.score);
          const color = band ? VERDICT_VAR[band] : 'var(--ink-3)';
          return (
            <span
              key={r.sourceId}
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${Math.max(0, Math.min(100, r.score))}%`,
                background: color,
                boxShadow: '0 0 0 2px var(--card), 0 1px 2px rgba(46,42,34,0.25)',
              }}
              aria-label={`${r.sourceName} ${Math.round(r.score)}`}
            />
          );
        })}
      </div>
    </div>
  );
}
