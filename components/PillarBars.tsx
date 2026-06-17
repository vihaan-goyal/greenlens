import { AXES, AXIS_LABEL, type Axis, type Pillars } from '@/lib/domain/types';
import { VERDICT_VAR, verdictBand } from '@/lib/domain/verdict';

interface Props {
  pillars: Pillars;
  height?: number;
}

/**
 * Four upright pillars — one per axis — with a verdict-colored fill, a
 * faint translucent track behind, and a stark hatched zone when raters split.
 * The hatched band IS the disagreement: it lets you see at a glance which
 * axes have contested same-axis ratings without reading.
 */
export function PillarBars({ pillars, height = 168 }: Props) {
  return (
    <div className="flex items-end justify-between gap-2.5" style={{ height: height + 60 }}>
      {AXES.map((axis) => (
        <Pillar key={axis} axis={axis} summary={pillars[axis]} height={height} />
      ))}
    </div>
  );
}

function Pillar({
  axis,
  summary,
  height,
}: {
  axis: Axis;
  summary: Pillars[Axis];
  height: number;
}) {
  const rep = summary.representative;
  const band = verdictBand(rep);
  const color = band ? VERDICT_VAR[band] : 'var(--ink-3)';
  const pct = rep === null ? 0 : Math.max(0, Math.min(100, rep));
  const fillH = (pct / 100) * height;
  const split = summary.disagreement && summary.spread;
  const spreadH = split ? ((summary.spread!.max - summary.spread!.min) / 100) * height : 0;
  const spreadBottom = split ? (summary.spread!.min / 100) * height : 0;
  const icon = ICONS[axis];

  return (
    <div className="flex w-full flex-col items-center gap-2">
      {/* Big tabular score above pillar */}
      <div className="flex flex-col items-center leading-none">
        <span
          className="font-display tabular text-[22px] font-semibold"
          style={{ color }}
        >
          {rep === null ? '—' : Math.round(rep)}
        </span>
        {split && (
          <span
            className="mt-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider"
            style={{
              background: 'color-mix(in srgb, var(--verdict-poor) 14%, transparent)',
              color: 'var(--verdict-poor)',
            }}
          >
            ▲▼ split
          </span>
        )}
      </div>

      {/* Pillar column */}
      <div
        className="relative w-full overflow-hidden rounded-t-2xl rounded-b-md"
        style={{ height, background: 'var(--card-2)' }}
      >
        {/* Subtle horizontal rules at 25/50/75 */}
        {[0.25, 0.5, 0.75].map((t) => (
          <span
            key={t}
            className="absolute left-0 right-0"
            style={{
              bottom: `${t * 100}%`,
              borderTop: '1px dashed var(--line-soft)',
              opacity: 0.7,
            }}
          />
        ))}

        {/* Fill — gradient with verdict color */}
        {rep !== null && (
          <span
            className="absolute inset-x-0 bottom-0 rounded-t-2xl"
            style={{
              height: fillH,
              background: `linear-gradient(180deg, ${color} 0%, color-mix(in srgb, ${color} 75%, #2E2A22 25%) 100%)`,
              transition: 'height 700ms cubic-bezier(0.2, 0.7, 0.2, 1)',
              boxShadow: `0 -12px 30px -10px color-mix(in srgb, ${color} 65%, transparent)`,
            }}
          />
        )}

        {/* Disagreement band — hatched overlay marking min→max spread */}
        {split && (
          <span
            className="absolute inset-x-1 rounded-md"
            style={{
              bottom: spreadBottom,
              height: spreadH,
              background:
                'repeating-linear-gradient(135deg, rgba(46,42,34,0.18) 0 3px, transparent 3px 7px)',
              border: '1px dashed rgba(46, 42, 34, 0.35)',
            }}
            aria-hidden
          />
        )}

        {/* Per-rater dots */}
        {summary.ratings.map((r) => {
          const dotBand = verdictBand(r.score);
          const dotColor = dotBand ? VERDICT_VAR[dotBand] : 'var(--ink-3)';
          return (
            <span
              key={r.sourceId}
              className="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full ring-2 ring-card"
              style={{
                bottom: `calc(${r.score}% - 5px)`,
                background: dotColor,
              }}
              aria-label={`${r.sourceName} ${Math.round(r.score)}`}
            />
          );
        })}
      </div>

      {/* Axis label + icon */}
      <div className="flex items-center gap-1.5">
        <span className="text-ink-3" style={{ color: 'var(--ink-2)' }}>
          {icon}
        </span>
        <span className="text-[9.5px] font-semibold uppercase leading-tight tracking-[0.10em] text-ink-2">
          {AXIS_SHORT[axis]}
        </span>
      </div>
    </div>
  );
}

const AXIS_SHORT: Record<Axis, string> = {
  ingredient_safety: 'Safety',
  environmental: 'Eco',
  labor: 'Labor',
  packaging: 'Pkg',
};

/* Compact axis icons — 14px monoline, paired to each pillar. */
const ICONS: Record<Axis, React.ReactNode> = {
  ingredient_safety: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M7 1.5 L 12 4 V 7.5 C 12 10 9.5 12 7 12.5 C 4.5 12 2 10 2 7.5 V 4 Z" strokeLinejoin="round" />
      <path d="M5 7 L 6.5 8.5 L 9 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  environmental: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M2 12 C 2 6 6 2 12 2 C 12 8 8 12 2 12 Z" strokeLinejoin="round" />
      <path d="M2 12 L 8 6" strokeLinecap="round" />
    </svg>
  ),
  labor: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="7" cy="4.5" r="2" />
      <path d="M3 12 C 3 9 5 7.5 7 7.5 C 9 7.5 11 9 11 12" strokeLinecap="round" />
    </svg>
  ),
  packaging: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2" y="3.5" width="10" height="8.5" rx="1" />
      <path d="M2 6 L 12 6 M 7 3.5 L 7 12" />
    </svg>
  ),
};
