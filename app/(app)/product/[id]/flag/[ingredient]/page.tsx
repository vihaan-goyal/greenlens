import Link from 'next/link';
import { notFound } from 'next/navigation';
import { repository } from '@/lib/data';
import { VERDICT_VAR } from '@/lib/domain/verdict';
import {
  FUNDING_LABEL,
  type IngredientStance,
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
    <main className="mx-auto w-full max-w-xl px-5 pt-4 pb-10 md:px-6 md:pt-8">
      <nav className="mb-6 text-xs text-ink-3">
        <Link href={`/product/${id}`} className="hover:text-ink">
          ← {base.product.displayName}
        </Link>
      </nav>

      <header className="mb-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-ink-3">Flagged ingredient</p>
        <h1 className="mt-1 text-[22px] font-semibold leading-tight text-ink">{flag.name}</h1>
      </header>

      <section className="mb-8 rounded-card bg-card p-5 ring-1 ring-line">
        <p className="text-sm leading-relaxed text-ink">{flag.explanation}</p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-3">
          Where each rater lands
        </h2>
        <ul className="space-y-3">
          {flag.positions.map((pos) => (
            <li
              key={pos.sourceId}
              className="rounded-card bg-card p-4 ring-1 ring-line"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{pos.sourceName}</p>
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

      {flag.notes.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-3">
            Other notes
          </h2>
          <ul className="flex flex-wrap gap-2">
            {flag.notes.map((n) => (
              <li
                key={n.label}
                className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs text-ink ring-1 ring-line"
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
