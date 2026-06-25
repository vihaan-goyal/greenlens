import Link from 'next/link';
import { repository } from '@/lib/data';
import { buildShelfCatalog } from '@/lib/shelf-catalog';
import type { ProductView } from '@/lib/data/repository';
import { Sonion } from '@/components/Sonion';
import { YourShelf } from '@/components/YourShelf';
import { ProductCard, meanOfPillars } from '@/components/ProductCard';
import { detectDisagreements } from '@/lib/domain/disagreement';
import { VERDICT_VAR } from '@/lib/domain/verdict';

type SortKey = 'contested' | 'best' | 'worst' | 'name';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'contested', label: 'Most contested' },
  { key: 'best', label: 'Best overall' },
  { key: 'worst', label: 'Worst overall' },
  { key: 'name', label: 'A–Z' },
];

interface HomeProps {
  searchParams: Promise<{ q?: string; category?: string; sort?: string }>;
}

export default async function HomePage({ searchParams }: HomeProps) {
  const sp = await searchParams;
  const query = sp.q?.trim() ?? '';
  // With a query → live search results (server-rendered grid).
  // Without → the browsable catalog: a "your shelf" strip (persisted look-up
  // history, client-rendered) on top of the full catalog grid, which is the
  // thing you actually do when your shelf is empty.
  const results = query ? await repository.searchProducts(query) : [];
  // buildShelfCatalog already calls listProducts() internally and returns the views,
  // so we reuse them here instead of firing a second identical query.
  const catalog = query ? null : await buildShelfCatalog();
  const allProducts = catalog?.views ?? results;

  return (
    <main className="relative pb-4">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
      {/* ─── HERO ───────────────────────────────────────────────────────── */}
      <section
        className="relative mt-6 overflow-hidden rounded-card anim-rise"
        style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
      >
        <div className="grid gap-5 p-5 md:grid-cols-[1.5fr_1fr] md:items-center md:p-7">
          {/* Left: the pitch */}
          <div>
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-ink-3">
              <span className="h-px w-6" style={{ background: 'var(--accent-deep)' }} />
              the catalog
            </p>
            <h1 className="mt-2.5 font-display text-[34px] font-semibold leading-[0.98] text-ink md:text-[44px]">
              The <span className="mark-leaf font-bold">second</span>{' '}
              <span className="italic u-bold" style={{ color: 'var(--accent-deep)' }}>opinion</span>{' '}
              on every shelf.
            </h1>
            <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-ink-2">
              Search a brand, product, or barcode. Greenlens pulls every public
              rater into one view —{' '}
              <span className="font-semibold text-ink">and never hides</span> where
              they disagree.
            </p>

            {/* Search bar */}
            <form method="get" action="/browse" className="mt-4 max-w-md">
              <div
                className="flex items-center gap-2 rounded-pill bg-card pl-4 pr-2 py-2 shadow-card"
                style={{ border: '1px solid var(--line)' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                  <circle cx="7" cy="7" r="4.5" stroke="var(--ink-2)" strokeWidth="1.6" fill="none" />
                  <path d="M10.5 10.5 L 14 14" stroke="var(--ink-2)" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                <input
                  id="q"
                  name="q"
                  type="text"
                  defaultValue={query}
                  placeholder="Search a brand, product, or barcode"
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
                  aria-label="Search products"
                />
                <button
                  type="submit"
                  className="rounded-pill bg-espresso px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-card"
                >
                  Look up
                </button>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled
                  className="group inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-[11px] font-medium text-ink-2"
                  style={{ background: 'var(--card-2)', border: '1px dashed var(--line)' }}
                  aria-label="Scan a barcode (simulated, coming soon)"
                >
                  <BarcodeGlyph />
                  Scan a barcode
                  <span className="text-[10px] uppercase tracking-wider text-ink-3">soon</span>
                </button>
                {query && (
                  <Link
                    href="/browse"
                    className="rounded-pill bg-card px-3 py-1.5 text-[11px] font-medium text-ink-2"
                    style={{ border: '1px solid var(--line)' }}
                  >
                    Clear
                  </Link>
                )}
              </div>
            </form>
          </div>

          {/* Right: Sonion greeting + the verdict scale legend */}
          <div className="relative flex flex-col gap-3 rounded-2xl p-4" style={{ background: 'var(--card-2)', border: '1px solid var(--line-soft)' }}>
            <div className="flex items-center gap-3">
              <Sonion mood="happy" size={72} halo />
              <p className="text-[12px] leading-snug text-ink-2">
                <span className="font-display italic font-semibold text-ink">Sonion</span>, your guide —
                I read the verdict so the spread is never a mystery.
              </p>
            </div>
            <div>
              <p className="mb-1.5 text-[9.5px] font-bold uppercase tracking-[0.2em] text-ink-3">
                The verdict scale
              </p>
              <div className="flex items-stretch gap-1">
                {(['bad', 'poor', 'fair', 'good', 'excellent'] as const).map((band, i) => (
                  <div
                    key={band}
                    className="flex-1 rounded-pill px-1.5 py-1.5 text-center text-[9px] font-bold uppercase tracking-[0.06em]"
                    style={{ background: VERDICT_VAR[band], color: 'var(--card)' }}
                  >
                    <span className="opacity-60 tabular">{i + 1}</span> {band}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEED: search results, or the browsable catalog ─────────────── */}
      {query ? (
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between border-b pb-2" style={{ borderColor: 'var(--line)' }}>
            <h2 className="font-display text-[22px] font-semibold leading-none text-ink md:text-[26px]">
              Results <span className="italic text-ink-2">for</span>{' '}
              <span style={{ color: 'var(--accent-deep)' }}>“{query}”</span>
            </h2>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">
              {results.length} {results.length === 1 ? 'match' : 'matches'}
            </span>
          </div>

          {results.length === 0 ? (
            <div className="rounded-card bg-card px-5 py-7 text-sm text-ink-2"
                 style={{ border: '1px solid var(--line)' }}>
              <p className="font-display italic">Nothing matched yet.</p>
              <p className="mt-1 text-[12px]">
                The catalog is small until Open Beauty Facts ingestion lands.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((view, i) => (
                <li key={view.product.id} className="h-full">
                  <ProductCard view={view} animationDelay={Math.min(220 + i * 55, 760)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          {catalog && (
            <section className="mt-8">
              <YourShelf catalog={catalog} />
            </section>
          )}
          <CatalogBrowser
            products={allProducts}
            category={sp.category ?? 'all'}
            sort={(sp.sort as SortKey) ?? 'contested'}
          />
        </>
      )}
      </div>
    </main>
  );
}

/* ─── The browsable catalog: category chips + sort + grid ────────────────── */
function maxSpread(view: ProductView): number {
  const ds = detectDisagreements(view.pillars);
  return ds.length ? Math.max(...ds.map((d) => d.spread)) : 0;
}

function CatalogBrowser({
  products,
  category,
  sort,
}: {
  products: ProductView[];
  category: string;
  sort: SortKey;
}) {
  // Distinct categories, alphabetized, for the filter chips.
  const categories = Array.from(new Set(products.map((p) => p.product.category))).sort();

  const filtered =
    category === 'all'
      ? products
      : products.filter((p) => p.product.category === category);

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'name') return a.product.displayName.localeCompare(b.product.displayName);
    if (sort === 'contested') return maxSpread(b) - maxSpread(a);
    // best / worst — by equal-weight mean, unrated products sink to the bottom.
    const ma = meanOfPillars(a.pillars);
    const mb = meanOfPillars(b.pillars);
    if (ma === null && mb === null) return 0;
    if (ma === null) return 1;
    if (mb === null) return -1;
    return sort === 'best' ? mb - ma : ma - mb;
  });

  // Build hrefs that preserve the other facet.
  const catHref = (c: string) =>
    `/browse?${new URLSearchParams({ ...(c !== 'all' ? { category: c } : {}), sort }).toString()}`;
  const sortHref = (s: SortKey) =>
    `/browse?${new URLSearchParams({ ...(category !== 'all' ? { category } : {}), sort: s }).toString()}`;

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b pb-2" style={{ borderColor: 'var(--line)' }}>
        <h2 className="font-display text-[22px] font-semibold leading-none text-ink md:text-[26px]">
          Browse the <span className="italic" style={{ color: 'var(--accent-deep)' }}>catalog</span>
        </h2>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">
          {sorted.length} {sorted.length === 1 ? 'product' : 'products'}
        </span>
      </div>

      {/* Controls: category chips (scrollable) + sort */}
      <div className="mb-5 flex flex-col gap-3">
        {/* Category strip — single scrollable row, no wrapping */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          <FacetChip href={catHref('all')} active={category === 'all'}>All</FacetChip>
          {categories.map((c) => (
            <FacetChip key={c} href={catHref(c)} active={category === c}>
              {c}
            </FacetChip>
          ))}
        </div>
        {/* Sort row */}
        <div className="flex items-center gap-1.5">
          <span className="shrink-0 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-ink-3">Sort</span>
          {SORTS.map((s) => (
            <FacetChip key={s.key} href={sortHref(s.key)} active={sort === s.key}>
              {s.label}
            </FacetChip>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-card bg-card px-5 py-7 text-sm text-ink-2" style={{ border: '1px solid var(--line)' }}>
          Nothing in this category yet.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((view, i) => (
            <li key={view.product.id} className="h-full">
              <ProductCard view={view} animationDelay={Math.min(120 + i * 45, 620)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FacetChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-pill px-3 py-1.5 text-[11px] font-semibold capitalize transition"
      style={{
        color: active ? 'var(--ink)' : 'var(--ink-2)',
        background: active ? 'var(--card)' : 'transparent',
        border: active ? '1px solid var(--line)' : '1px solid transparent',
      }}
    >
      {children}
    </Link>
  );
}

function BarcodeGlyph() {
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden>
      {[0, 2, 3.5, 5.5, 7, 9, 10.5, 12.5].map((x, i) => (
        <rect
          key={i}
          x={x}
          y={0}
          width={i % 3 === 0 ? 1.2 : 0.7}
          height="12"
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
