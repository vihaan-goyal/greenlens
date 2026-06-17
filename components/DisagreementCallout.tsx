import { detectDisagreements } from '@/lib/domain/disagreement';
import { AXIS_LABEL, FUNDING_LABEL, type Pillars } from '@/lib/domain/types';
import { VERDICT_VAR, verdictBand } from '@/lib/domain/verdict';

/**
 * Pulls the loudest same-axis disagreement to the front of the page. Two
 * rater chips with their funding model, separated by a heavy "vs", over a
 * track that shows where each sits on 0–100. This screen is the product's
 * thesis (CLAUDE.md), so it gets dramatic real estate, not a footnote.
 */
export function DisagreementCallout({ pillars }: { pillars: Pillars }) {
  const ds = detectDisagreements(pillars);
  if (ds.length === 0) return null;
  // Pick the widest spread — that's the most newsworthy split.
  const d = [...ds].sort((a, b) => b.spread - a.spread)[0]!;

  const lowBand = verdictBand(d.low.score);
  const highBand = verdictBand(d.high.score);
  const lowColor = lowBand ? VERDICT_VAR[lowBand] : 'var(--ink-3)';
  const highColor = highBand ? VERDICT_VAR[highBand] : 'var(--ink-3)';

  return (
    <div
      className="relative overflow-hidden rounded-card halo-br"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        ['--halo' as string]: 'var(--halo-clay)',
      }}
    >
      <div className="halo-content p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.20em]" style={{ color: 'var(--verdict-poor)' }}>
            raters split
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
            {AXIS_LABEL[d.axis]}
          </p>
        </div>

        <p className="mt-1 font-display text-[18px] font-semibold leading-snug text-ink">
          A <span className="italic">{Math.round(d.spread)}-point</span> gap
          between the two loudest voices.
        </p>

        {/* Versus row */}
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <RaterCorner
            name={d.low.sourceName}
            funding={d.low.fundingModel}
            score={d.low.score}
            color={lowColor}
            align="left"
          />
          <span
            className="font-display text-[20px] font-semibold italic"
            style={{ color: 'var(--ink-3)' }}
          >
            vs
          </span>
          <RaterCorner
            name={d.high.sourceName}
            funding={d.high.fundingModel}
            score={d.high.score}
            color={highColor}
            align="right"
          />
        </div>

        {/* Shared track */}
        <div className="relative mt-4 h-2 rounded-pill" style={{ background: 'var(--card-2)' }}>
          <span
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
            style={{ left: `${d.low.score}%`, background: lowColor }}
          />
          <span
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
            style={{ left: `${d.high.score}%`, background: highColor }}
          />
          <span
            className="absolute top-1/2 -translate-y-1/2 rounded-pill"
            style={{
              left: `${d.low.score}%`,
              width: `${d.high.score - d.low.score}%`,
              height: 3,
              background:
                'repeating-linear-gradient(90deg, rgba(46,42,34,0.35) 0 4px, transparent 4px 8px)',
            }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[9px] font-semibold uppercase tracking-wider text-ink-3">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>
    </div>
  );
}

function RaterCorner({
  name,
  funding,
  score,
  color,
  align,
}: {
  name: string;
  funding: keyof typeof FUNDING_LABEL;
  score: number;
  color: string;
  align: 'left' | 'right';
}) {
  return (
    <div className={`flex flex-col ${align === 'right' ? 'items-end text-right' : 'items-start'}`}>
      <span
        className="font-display tabular text-[28px] font-semibold leading-none"
        style={{ color, letterSpacing: '-0.04em' }}
      >
        {Math.round(score)}
      </span>
      <span className="mt-1 text-[12px] font-semibold leading-tight text-ink">{name}</span>
      <span
        className="mt-1 rounded-pill px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
        style={{ background: 'var(--card-2)', color: 'var(--ink-2)' }}
      >
        {FUNDING_LABEL[funding as keyof typeof FUNDING_LABEL]}
      </span>
    </div>
  );
}
