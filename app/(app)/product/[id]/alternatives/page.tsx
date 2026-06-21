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
    <main className="mx-auto w-full max-w-5xl px-5 pt-5 pb-4 md:px-8 md:pt-7">
      <nav className="mb-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        <Link href="/browse" className="hover:text-ink">Catalog</Link>
        <span aria-hidden>/</span>
        <Link href={`/product/${id}`} className="truncate hover:text-ink">{base.product.displayName}</Link>
        <span aria-hidden>/</span>
        <span className="text-ink">Alternatives</span>
      </nav>

      <header
        className="relative mb-6 overflow-hidden rounded-card halo-tr anim-rise"
        style={{ background: 'var(--card)', border: '1px solid var(--line)', ['--halo' as string]: 'var(--halo-leaf)' }}
      >
        <div className="halo-content p-5 md:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--verdict-excellent)' }}>
            Cleaner options
          </p>
          <h1 className="mt-1 font-display text-[28px] font-semibold leading-tight text-ink md:text-[34px]">
            Cleaner alternatives
          </h1>
          <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-ink-2">
            Same category, ranked by <span className="font-semibold text-ink">ingredient safety</span> only —
            never by affiliate payout, even after a revenue model exists.
          </p>
        </div>
      </header>

      {alternatives.length === 0 ? (
        <p className="rounded-card bg-card px-5 py-7 text-sm text-ink-2" style={{ border: '1px solid var(--line)' }}>
          No cleaner alternatives in the current catalog. More land as Open Beauty Facts ingestion comes
          online.
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {alternatives.map(({ view, cleaner, tradeoffs }) => (
            <li key={view.product.id} className="h-full">
              <Link
                href={`/product/${view.product.id}`}
                className="block h-full rounded-card bg-card p-5 shadow-card transition hover:shadow-lift"
                style={{ border: '1px solid var(--line)' }}
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
