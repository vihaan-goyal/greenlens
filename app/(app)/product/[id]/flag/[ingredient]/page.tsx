import Link from 'next/link';
import { notFound } from 'next/navigation';
import { repository } from '@/lib/data';
import { MatchProvenance } from '@/components/MatchProvenance';
import { VERDICT_VAR } from '@/lib/domain/verdict';
import {
  FUNDING_LABEL,
  type IngredientRaterPosition,
  type IngredientStance,
  isIllustrative,
} from '@/lib/domain/types';

interface PageProps {
  params: Promise<{ id: string; ingredient: string }>;
}

const STANCE_LABEL: Record<IngredientStance, string> = {
  concern: 'Concern',
  caution: 'Caution',
  safe: 'Safe',
  unknown: 'No position',
};

const STANCE_COLOR: Record<IngredientStance, string> = {
  concern: 'var(--verdict-bad)',
  caution: 'var(--verdict-fair)',
  safe: 'var(--verdict-excellent)',
  unknown: 'var(--ink-3)',
};

function groupByStance(positions: IngredientRaterPosition[]) {
  const map: Record<IngredientStance, IngredientRaterPosition[]> = {
    safe: [], caution: [], concern: [], unknown: [],
  };
  for (const p of positions) map[p.stance].push(p);
  return map;
}

export default async function FlagPage({ params }: PageProps) {
  const { id, ingredient } = await params;
  const base = await repository.getProduct(id);
  if (!base) notFound();
  const flag = await repository.getIngredientFlag(id, ingredient);
  if (!flag) notFound();

  const stances = new Set(
    flag.positions.map((p) => p.stance).filter((s) => s !== 'unknown'),
  );
  const hasSplit = stances.size > 1;

  // Left-stripe color: amber when split, else the dominant stance color.
  const stripeColor = hasSplit
    ? 'var(--verdict-poor)'
    : STANCE_COLOR[flag.positions[0]?.stance ?? 'unknown'];

  return (
    <main className="mx-auto w-full max-w-4xl px-5 pt-5 pb-4 md:px-8 md:pt-7">
      {/* ─── BREADCRUMB ─────────────────────────────────────────────────── */}
      <nav className="mb-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        <Link href="/browse" className="hover:text-ink">Catalog</Link>
        <span aria-hidden>/</span>
        <Link href={`/product/${id}`} className="truncate hover:text-ink">
          {base.product.displayName}
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink">Flag</span>
      </nav>

      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <header
        className="relative mb-6 overflow-hidden rounded-card anim-rise"
        style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
      >
        <div className="flex">
          {/* Verdict stripe on the left edge */}
          <div className="w-1.5 shrink-0" style={{ background: stripeColor }} aria-hidden />
          <div className="flex-1 p-5 md:p-6">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: 'var(--verdict-poor)' }}
            >
              Flagged ingredient
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <h1 className="font-display text-[28px] font-semibold leading-tight text-ink md:text-[34px]">
                {flag.name}
              </h1>
              {hasSplit && (
                <span
                  className="inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
                  style={{
                    background: 'color-mix(in srgb, var(--verdict-poor) 12%, transparent)',
                    color: 'var(--verdict-poor)',
                    border: '1px solid color-mix(in srgb, var(--verdict-poor) 28%, transparent)',
                  }}
                >
                  Raters disagree
                </span>
              )}
            </div>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-2">
              {flag.explanation}
            </p>
          </div>
        </div>
      </header>

      {/* ─── SPLIT GRID ─────────────────────────────────────────────────── */}
      {hasSplit && (
        <section className="mb-8 anim-rise" style={{ animationDelay: '80ms' }}>
          <SplitGrid positions={flag.positions} />
        </section>
      )}

      {/* ─── RATER CARDS ────────────────────────────────────────────────── */}
      <section
        className="mb-8 anim-rise"
        style={{ animationDelay: hasSplit ? '140ms' : '80ms' }}
      >
        <div
          className="mb-3 flex items-baseline justify-between border-b pb-2"
          style={{ borderColor: 'var(--line)' }}
        >
          <h2 className="font-display text-[18px] font-semibold text-ink">
            Where each rater lands
          </h2>
          <span
            className="text-[9.5px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: 'var(--accent-deep)' }}
          >
            funding shown
          </span>
        </div>
        <ul className="grid gap-3 md:grid-cols-2">
          {flag.positions.map((pos) => (
            <li key={pos.sourceId}>
              <RaterCard pos={pos} />
            </li>
          ))}
        </ul>
      </section>

      {/* ─── COVERAGE ───────────────────────────────────────────────────── */}
      <section className="mb-8">
        <MatchProvenance pillars={base.pillars} />
      </section>

      {/* ─── OTHER NOTES ────────────────────────────────────────────────── */}
      {flag.notes.length > 0 && (
        <section>
          <h2
            className="mb-3 border-b pb-2 font-display text-[18px] font-semibold text-ink"
            style={{ borderColor: 'var(--line)' }}
          >
            Other notes
          </h2>
          <ul className="flex flex-wrap gap-2">
            {flag.notes.map((n) => (
              <li
                key={n.label}
                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] font-medium text-ink"
                style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: VERDICT_VAR[n.band] }}
                  aria-hidden
                />
                {n.label}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

/* ── SPLIT GRID ──────────────────────────────────────────────────────────── */

const SPLIT_ZONES: IngredientStance[] = ['safe', 'caution', 'concern'];

function SplitGrid({ positions }: { positions: IngredientRaterPosition[] }) {
  const byStance = groupByStance(positions);

  return (
    <div
      className="overflow-hidden rounded-card"
      style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
    >
      {/* Header row */}
      <div
        className="border-b px-5 py-3"
        style={{ borderColor: 'var(--line)', background: 'var(--card-2)' }}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-[0.22em]"
          style={{ color: 'var(--verdict-poor)' }}
        >
          Raters don&apos;t agree — here&apos;s where each one stands
        </p>
      </div>

      {/* Three-column stance breakdown */}
      <div className="grid grid-cols-3">
        {SPLIT_ZONES.map((stance, i) => {
          const raters = byStance[stance];
          const color = STANCE_COLOR[stance];
          const isLast = i === SPLIT_ZONES.length - 1;
          return (
            <div
              key={stance}
              className="p-4"
              style={{ borderRight: isLast ? 'none' : '1px solid var(--line)' }}
            >
              {/* Stance label */}
              <div className="mb-3 flex items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: color }}
                  aria-hidden
                />
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.16em]"
                  style={{ color }}
                >
                  {STANCE_LABEL[stance]}
                </span>
              </div>

              {/* Raters in this column */}
              {raters.length === 0 ? (
                <p className="text-[11.5px] text-ink-3">—</p>
              ) : (
                <ul className="space-y-2">
                  {raters.map((p) => (
                    <li
                      key={p.sourceId}
                      className="rounded-xl px-3 py-2.5"
                      style={{
                        background: `color-mix(in srgb, ${color} 10%, var(--card-2))`,
                        border: `1px solid color-mix(in srgb, ${color} 22%, var(--line))`,
                      }}
                    >
                      <p className="text-[12.5px] font-semibold text-ink">{p.sourceName}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-[0.10em] text-ink-3">
                        {FUNDING_LABEL[p.fundingModel]}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── RATER CARD ──────────────────────────────────────────────────────────── */

function RaterCard({ pos }: { pos: IngredientRaterPosition }) {
  const color = STANCE_COLOR[pos.stance];
  return (
    <div
      className="flex h-full flex-col rounded-card p-4"
      style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
    >
      {/* Stance verdict — first thing the eye hits */}
      <div
        className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-xl px-3 py-1.5"
        style={{
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
        }}
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: color }}
          aria-hidden
        />
        <span
          className="text-[11px] font-bold uppercase tracking-[0.14em]"
          style={{ color }}
        >
          {STANCE_LABEL[pos.stance]}
        </span>
      </div>

      {/* Source + funding + illustrative chip */}
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div>
          <p className="text-[14px] font-semibold text-ink">{pos.sourceName}</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
            {FUNDING_LABEL[pos.fundingModel]}
          </p>
        </div>
        {isIllustrative(pos.sourceId) && (
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
            style={{ color: 'var(--verdict-poor)', border: '1px solid var(--verdict-poor)' }}
            title="Illustrative data — this rater isn't integrated yet; the stance is shown for demonstration, not pulled from the source."
          >
            illustrative
          </span>
        )}
      </div>

      {/* Reasoning */}
      <p className="mt-auto text-[13px] leading-relaxed text-ink-2">{pos.reasoning}</p>
    </div>
  );
}
