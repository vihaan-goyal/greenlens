import { AXES, AXIS_LABEL, type Axis, type Pillars, type Source } from '@/lib/domain/types';
import { DISAGREEMENT_THRESHOLD } from '@/lib/domain/scoring';
import { VERDICT_VAR, verdictBand } from '@/lib/domain/verdict';

/**
 * "How this score is built" — an honest, collapsible disclosure of the scoring
 * pipeline, shown on the product page. Two halves:
 *   1. four plain-language steps describing exactly what the domain code does
 *      (collect raw rater scores → normalize to 0–100 → average per axis while
 *      keeping the spread → weighted overall computed live, never persisted), and
 *   2. a worked example built from *this* product's own ratings so the reader can
 *      watch real native scores become one pillar number.
 *
 * Native <details>/<summary> so it collapses with no client JS and respects
 * prefers-reduced-motion for free. Pure presentation of pillars + sources.
 */
export function ScoreMethodology({
  pillars,
  sources,
}: {
  pillars: Pillars;
  sources: Source[];
}) {
  const sourceById = new Map(sources.map((s) => [s.id, s] as const));
  const example = pickExampleAxis(pillars);

  return (
    <details
      className="group rounded-card open:shadow-card"
      style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--accent-deep)' }}>
            no black box
          </p>
          <h3 className="mt-0.5 font-display text-[16px] font-semibold leading-tight text-ink">
            How this score is built
          </h3>
        </div>
        <span
          aria-hidden
          className="shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-180"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 6 L 8 10 L 12 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </summary>

      <div className="px-4 pb-4">
        <p className="mb-4 text-[12.5px] leading-relaxed text-ink-2">
          We don&apos;t rate products ourselves. We collect what each public rater
          already says, put every scale on common ground, and keep the
          disagreements visible instead of averaging them away.
        </p>

        {/* Four steps */}
        <ol className="space-y-3.5">
          <Step n={1} title="Collect each rater's own score">
            Every source keeps its native verdict for this product. We never
            invent a score for an axis a source didn&apos;t measure.
          </Step>
          <Step n={2} title="Normalize to 0–100, higher = better">
            Raters use different scales — EWG&apos;s 1–10 where{' '}
            <em>low means safe</em>, Yuka&apos;s 0–100 where high means safe. We
            map them all onto one 0–100 axis and flip the ones that run backwards
            so the numbers are finally comparable.
          </Step>
          <Step n={3} title="Average per axis — but keep the spread">
            Scores on the same axis become one representative number (their mean).
            When raters split by {DISAGREEMENT_THRESHOLD}+ points we flag it
            and keep every rater&apos;s number — a disagreement is never blended
            into silence.
          </Step>
          <Step n={4} title="Your weights make the overall">
            The ring is the weighted average of the four pillars using{' '}
            <em>your</em> weights. It&apos;s computed fresh every time and never
            stored — there&apos;s no hidden &ldquo;objective&rdquo; default.
          </Step>
        </ol>

        {/* Worked example from this product */}
        {example && (
          <WorkedExample pillars={pillars} axis={example} sourceById={sourceById} />
        )}
      </div>
    </details>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular"
        style={{ background: 'var(--card-2)', color: 'var(--accent-deep)', border: '1px solid var(--line)' }}
      >
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-ink-2">{children}</p>
      </div>
    </li>
  );
}

function WorkedExample({
  pillars,
  axis,
  sourceById,
}: {
  pillars: Pillars;
  axis: Axis;
  sourceById: Map<string, Source>;
}) {
  const p = pillars[axis];
  const rep = p.representative;
  if (rep === null) return null;
  const band = verdictBand(rep);
  const repColor = band ? VERDICT_VAR[band] : 'var(--ink-3)';

  return (
    <div
      className="mt-5 rounded-card p-3.5"
      style={{ background: 'var(--card-2)', border: '1px solid var(--line-soft)' }}
    >
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-ink-3">
        worked example · {AXIS_LABEL[axis]}
      </p>

      <ul className="mt-2.5 space-y-2">
        {p.ratings.map((r) => {
          const src = sourceById.get(r.sourceId);
          const rBand = verdictBand(r.score);
          const rColor = rBand ? VERDICT_VAR[rBand] : 'var(--ink-3)';
          return (
            <li key={r.sourceId} className="flex items-center gap-2 text-[12px]">
              <span className="min-w-0 flex-1 truncate text-ink">{r.sourceName}</span>
              <span className="shrink-0 tabular text-ink-2">
                {fmtRaw(r.raw)} on {src ? scaleLabel(src) : '—'}
              </span>
              <span aria-hidden className="shrink-0 text-ink-3">→</span>
              <span
                className="w-8 shrink-0 text-right font-display text-[15px] font-semibold tabular"
                style={{ color: rColor }}
              >
                {Math.round(r.score)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t pt-2.5" style={{ borderColor: 'var(--line-soft)' }}>
        <span className="text-[11.5px] text-ink-2">
          {p.ratings.length > 1
            ? `Average of ${p.ratings.map((r) => Math.round(r.score)).join(' · ')}`
            : 'Single rater'}
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
            pillar
          </span>
          <span className="font-display text-[18px] font-semibold tabular" style={{ color: repColor }}>
            {Math.round(rep)}
          </span>
        </span>
      </div>

      {p.disagreement && (
        <p className="mt-2.5 text-[11.5px] leading-snug text-ink-2">
          Raters split here, so this {Math.round(rep)} is a midpoint, not a
          consensus — the spread stays on the &ldquo;every rater&rdquo; list above.
        </p>
      )}
    </div>
  );
}

/** Native scale described in one phrase: "EWG's 1–10 (lower = better)". */
function scaleLabel(src: Source): string {
  const dir = src.scaleDirection === 'lower_is_better' ? ', lower = better' : '';
  return `${fmtRaw(src.scaleMin)}–${fmtRaw(src.scaleMax)}${dir}`;
}

function fmtRaw(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * Pick the most instructive axis for the worked example: the one with the most
 * raters, preferring an axis where they disagree (the thesis), falling back to
 * the canonical AXES order on ties.
 */
function pickExampleAxis(pillars: Pillars): Axis | null {
  let best: Axis | null = null;
  for (const axis of AXES) {
    const p = pillars[axis];
    if (p.ratings.length === 0) continue;
    if (best === null) {
      best = axis;
      continue;
    }
    const bp = pillars[best];
    const score = (n: number, dis: boolean) => n * 2 + (dis ? 1 : 0);
    if (score(p.ratings.length, p.disagreement) > score(bp.ratings.length, bp.disagreement)) {
      best = axis;
    }
  }
  return best;
}
