import Link from 'next/link';
import { repository } from '@/lib/data';
import { detectDisagreements } from '@/lib/domain/disagreement';
import { ProductCard } from '@/components/ProductCard';
import { DisagreementCallout } from '@/components/DisagreementCallout';

/**
 * The thesis, made browsable. Every product where the public raters most
 * disagree about the *same* axis — ranked by how wide the split is — so the
 * conflict Greenlens refuses to average away becomes something you can explore
 * directly, not just stumble onto product by product.
 *
 * Server component (inside the (app) group, so it inherits the site chrome).
 * Reuses the pure `detectDisagreements` for ranking and the existing
 * `DisagreementCallout` to render each split — no new disagreement UI.
 */
export default async function DisagreementsPage() {
  const products = await repository.listProducts();

  // Keep only products with a real same-axis split, ranked widest-first.
  const ranked = products
    .map((view) => {
      const ds = detectDisagreements(view.pillars);
      const widest = ds.length ? Math.max(...ds.map((d) => d.spread)) : 0;
      return { view, widest };
    })
    .filter((x) => x.widest > 0)
    .sort((a, b) => b.widest - a.widest);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pt-5 pb-4 md:px-8 md:pt-7">
      <nav className="mb-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        <Link href="/browse" className="hover:text-ink">Catalog</Link>
        <span aria-hidden>/</span>
        <span className="text-ink">Where they disagree</span>
      </nav>

      <header
        className="relative mb-6 overflow-hidden rounded-card halo-tr anim-rise"
        style={{ background: 'var(--card)', border: '1px solid var(--line)', ['--halo' as string]: 'var(--halo-clay)' }}
      >
        <div className="halo-content p-5 md:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--verdict-poor)' }}>
            the thesis
          </p>
          <h1 className="mt-1 font-display text-[28px] font-semibold leading-tight text-ink md:text-[34px]">
            Where the raters split
          </h1>
          <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-ink-2">
            We never average a conflict into silence. Here is every product where
            the public sources most disagree on the{' '}
            <span className="font-semibold text-ink">same axis</span> — ranked by
            how wide the gap is, with who funds each side kept in plain sight.
          </p>
        </div>
      </header>

      {ranked.length === 0 ? (
        <p className="rounded-card bg-card px-5 py-7 text-sm text-ink-2" style={{ border: '1px solid var(--line)' }}>
          No same-axis disagreements in the current catalog. As Open Beauty Facts
          ingestion grows, more splits surface here.
        </p>
      ) : (
        <ul className="space-y-4">
          {ranked.map(({ view }, i) => (
            <li
              key={view.product.id}
              className="anim-rise grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-stretch"
              style={{ animationDelay: `${Math.min(120 + i * 50, 640)}ms` }}
            >
              <ProductCard view={view} />
              <DisagreementCallout pillars={view.pillars} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
