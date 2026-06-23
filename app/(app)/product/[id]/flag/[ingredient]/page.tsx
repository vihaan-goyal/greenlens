import Link from 'next/link';
import { notFound } from 'next/navigation';
import { repository } from '@/lib/data';
import { MatchProvenance } from '@/components/MatchProvenance';
import { VERDICT_VAR } from '@/lib/domain/verdict';
import {
  FUNDING_LABEL,
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

export default async function FlagPage({ params }: PageProps) {
  const { id, ingredient } = await params;
  const base = await repository.getProduct(id);
  if (!base) notFound();
  const flag = await repository.getIngredientFlag(id, ingredient);
  if (!flag) notFound();

  return (
    <main className="mx-auto w-full max-w-4xl px-5 pt-5 pb-4 md:px-8 md:pt-7">
      <nav className="mb-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        <Link href="/browse" className="hover:text-ink">Catalog</Link>
        <span aria-hidden>/</span>
        <Link href={`/product/${id}`} className="truncate hover:text-ink">{base.product.displayName}</Link>
        <span aria-hidden>/</span>
        <span className="text-ink">Flag</span>
      </nav>

      <header
        className="relative mb-6 overflow-hidden rounded-card halo-tr anim-rise"
        style={{ background: 'var(--card)', border: '1px solid var(--line)', ['--halo' as string]: 'var(--halo-clay)' }}
      >
        <div className="halo-content p-5 md:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--verdict-poor)' }}>
            Flagged ingredient
          </p>
          <h1 className="mt-1 font-display text-[28px] font-semibold leading-tight text-ink md:text-[34px]">{flag.name}</h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink">{flag.explanation}</p>
        </div>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 flex items-baseline justify-between border-b pb-2 font-display text-[18px] font-semibold text-ink" style={{ borderColor: 'var(--line)' }}>
          Where each rater lands
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--accent-deep)' }}>
            funding shown
          </span>
        </h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {flag.positions.map((pos) => (
            <li
              key={pos.sourceId}
              className="rounded-card bg-card p-4"
              style={{ border: '1px solid var(--line)' }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    {pos.sourceName}
                    {isIllustrative(pos.sourceId) && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
                        style={{ color: 'var(--verdict-poor)', border: '1px solid var(--verdict-poor)' }}
                        title="Illustrative data — this rater isn't integrated yet; the stance is shown for demonstration, not pulled from the source."
                      >
                        illustrative
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] uppercase tracking-wider text-ink-3">
                    {FUNDING_LABEL[pos.fundingModel]}
                  </p>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider"
                  style={{
                    color: STANCE_COLOR[pos.stance],
                    background: `color-mix(in srgb, ${STANCE_COLOR[pos.stance]} 14%, transparent)`,
                  }}
                >
                  {STANCE_LABEL[pos.stance]}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{pos.reasoning}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Product-level coverage caveat. The per-rater stances above are
          hand-authored, so match confidence applies to the product's whole rating
          set, not to an individual stance — surface it here for the same honesty. */}
      <section className="mb-8">
        <MatchProvenance pillars={base.pillars} />
      </section>

      {flag.notes.length > 0 && (
        <section>
          <h2 className="mb-3 border-b pb-2 font-display text-[18px] font-semibold text-ink" style={{ borderColor: 'var(--line)' }}>
            Other notes
          </h2>
          <ul className="flex flex-wrap gap-2">
            {flag.notes.map((n) => (
              <li
                key={n.label}
                className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs text-ink"
                style={{ border: '1px solid var(--line)' }}
              >
                <span
                  className="h-2 w-2 rounded-full"
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
