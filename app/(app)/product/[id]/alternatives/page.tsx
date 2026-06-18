import Link from 'next/link';
import { notFound } from 'next/navigation';
import { repository } from '@/lib/data';
import { AXIS_LABEL } from '@/lib/domain/types';
import { MiniRaterSpread } from '@/components/MiniRaterSpread';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AlternativesPage({ params }: PageProps) {
  const { id } = await params;
  const base = await repository.getProduct(id);
  if (!base) notFound();

  const alternatives = await repository.listAlternatives(id);

  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-4 pb-10 md:px-6 md:pt-8">
      <nav className="mb-6 text-xs text-ink-3">
        <Link href={`/product/${id}`} className="hover:text-ink">
          ← {base.product.displayName}
        </Link>
      </nav>

      <header className="mb-5">
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Cleaner alternatives</h1>
        <p className="mt-2 text-sm text-ink-2">
          Same category, ranked by <span className="text-ink">ingredient safety</span> only. Never by
          affiliate payout — even after a revenue model exists.
        </p>
      </header>

      {alternatives.length === 0 ? (
        <p className="rounded-card bg-card px-4 py-6 text-sm text-ink-2 ring-1 ring-line">
          No cleaner alternatives in the current catalog. More land as Open Beauty Facts ingestion comes
          online.
        </p>
      ) : (
        <ul className="space-y-4">
          {alternatives.map(({ view, cleaner, tradeoffs }) => (
            <li key={view.product.id}>
              <Link
                href={`/product/${view.product.id}`}
                className="block rounded-card bg-card p-5 shadow-card ring-1 ring-line transition hover:ring-accent"
              >
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-3">
                  {view.brand.name}
                </p>
                <p className="mt-0.5 text-sm font-medium leading-snug text-ink">
                  {view.product.displayName}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-3">
                  {view.product.sizeValue}
                  {view.product.sizeUnit}
                </p>

                <div className="mt-3">
                  <MiniRaterSpread pillars={view.pillars} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-ink-3">
                      What's cleaner
                    </p>
                    {cleaner.length === 0 ? (
                      <p className="mt-1 text-xs text-ink-2">No axis is meaningfully cleaner.</p>
                    ) : (
                      <ul className="mt-1 space-y-0.5 text-xs text-ink">
                        {cleaner.map((c) => (
                          <li key={c.axis}>
                            {AXIS_LABEL[c.axis]}{' '}
                            <span
                              style={{ color: 'var(--verdict-excellent)' }}
                              className="tabular"
                            >
                              +{Math.round(c.delta)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Tradeoff</p>
                    {tradeoffs.length === 0 ? (
                      <p className="mt-1 text-xs text-ink-2">No tradeoff in rated axes.</p>
                    ) : (
                      <ul className="mt-1 space-y-0.5 text-xs text-ink">
                        {tradeoffs.map((t) => (
                          <li key={t.axis}>
                            {AXIS_LABEL[t.axis]}{' '}
                            <span style={{ color: 'var(--verdict-poor)' }} className="tabular">
                              {Math.round(t.delta)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
