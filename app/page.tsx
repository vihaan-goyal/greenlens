import Link from 'next/link';
import { mockRepository } from '@/lib/data/mock-repository';
import { MiniRaterSpread } from '@/components/MiniRaterSpread';

interface HomeProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function HomePage({ searchParams }: HomeProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';
  const products = query
    ? await mockRepository.searchProducts(query)
    : await mockRepository.listProducts();

  return (
    <main className="px-5 pt-6 pb-6">
      <header className="mb-7">
        <p className="text-[11px] uppercase tracking-[0.18em] text-ink-3">greenlens</p>
        <h1 className="mt-2 text-[26px] font-semibold leading-tight text-ink">
          What every rater says, and where they disagree.
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          Personal safety first. You set the weights, we never hide the spread.
        </p>
      </header>

      <section className="mb-8">
        <form method="get" action="/" className="space-y-3">
          <label
            className="block text-xs font-medium uppercase tracking-wider text-ink-3"
            htmlFor="q"
          >
            Search
          </label>
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={query}
            placeholder="Brand, product name, or barcode"
            className="w-full rounded-card bg-card px-4 py-3 text-sm text-ink shadow-card outline-none ring-1 ring-line placeholder:text-ink-3 focus:ring-accent"
            aria-label="Search products"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="rounded-full bg-espresso px-4 py-2 text-xs font-medium text-card shadow-card"
            >
              Search
            </button>
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 rounded-full bg-card-2 px-4 py-2 text-xs font-medium text-ink-2 disabled:opacity-90"
              aria-label="Scan a barcode (simulated, coming in a later phase)"
            >
              <span aria-hidden>▢</span> Scan a barcode <span className="text-ink-3">(soon)</span>
            </button>
            {query && (
              <Link
                href="/"
                className="rounded-full bg-card-2 px-4 py-2 text-xs font-medium text-ink-2"
              >
                Clear
              </Link>
            )}
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-3">
          {query ? `Results for "${query}"` : 'Recent'}
        </h2>

        {products.length === 0 ? (
          <p className="rounded-card bg-card px-4 py-6 text-sm text-ink-2 ring-1 ring-line">
            No products matched. The catalog is small until Open Beauty Facts ingestion lands.
          </p>
        ) : (
          <ul className="space-y-3">
            {products.map(({ product, brand, pillars }) => (
              <li key={product.id}>
                <Link
                  href={`/product/${product.id}`}
                  className="block rounded-card bg-card px-4 py-4 shadow-card ring-1 ring-line transition hover:ring-accent"
                >
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-3">
                    {brand.name}
                  </p>
                  <p className="mt-0.5 text-sm font-medium leading-snug text-ink">
                    {product.displayName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-3">
                    {product.sizeValue}
                    {product.sizeUnit}
                  </p>

                  <div className="mt-3">
                    <MiniRaterSpread pillars={pillars} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-10 text-[11px] leading-relaxed text-ink-3">
        Scores are weighted by your priorities at read time. Conflicting opinions on the same axis are
        never blended.
      </footer>
    </main>
  );
}
