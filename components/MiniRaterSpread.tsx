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
 * Compact rater spread for list rows. Renders one axis as a thin track with a
 * verdict-colored dot per rater. Funding model is intentionally omitted at
 * this density — the list is for scanning ("is there controversy here?"),
 * the funding chips live on the product page where there's room for them.
 */
export function MiniRaterSpread({
  pillars,
  axis = 'ingredient_safety',
  showHeader = true,
}: Props) {
  const p = pillars[axis];
  if (p.ratings.length === 0) return null;

  return (
    <div>
      {showHeader && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[10px]">
          <span className="font-medium uppercase tracking-[0.14em] text-ink-3">
            {AXIS_LABEL[axis]}
          </span>
          {p.disagreement && p.spread ? (
            <span
              className="rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-wider"
              style={{
                background:
                  'color-mix(in srgb, var(--verdict-poor) 14%, transparent)',
                color: 'var(--verdict-poor)',
              }}
            >
              Split · {Math.round(p.spread.max - p.spread.min)} pts
            </span>
          ) : p.ratings.length > 1 ? (
            <span className="uppercase tracking-wider text-ink-3">Raters agree</span>
          ) : (
            <span className="uppercase tracking-wider text-ink-3">1 rater</span>
          )}
        </div>
      )}

      <div className="relative h-1.5 rounded-full bg-card-2">
        {p.ratings.map((r) => {
          const band = verdictBand(r.score);
          const color = band ? VERDICT_VAR[band] : 'var(--ink-3)';
          return (
            <span
              key={r.sourceId}
              className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-card"
              style={{
                left: `${Math.max(0, Math.min(100, r.score))}%`,
                background: color,
              }}
              aria-label={`${r.sourceName} ${Math.round(r.score)}`}
            />
          );
        })}
      </div>
    </div>
  );
}
