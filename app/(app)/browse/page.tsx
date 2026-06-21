import Link from 'next/link';
import { repository } from '@/lib/data';
import { buildShelfCatalog } from '@/lib/shelf-catalog';
import { MiniRaterSpread } from '@/components/MiniRaterSpread';
import { Sonion } from '@/components/Sonion';
import { BrandMark } from '@/components/BrandMark';
import { ScoreDial } from '@/components/ScoreDial';
import { YourShelf } from '@/components/YourShelf';
import { AXES } from '@/lib/domain/types';
import { VERDICT_VAR, verdictBand } from '@/lib/domain/verdict';

interface HomeProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function HomePage({ searchParams }: HomeProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';
  // With a query → live search results (server-rendered grid).
  // Without → "your shelf": persisted look-up history, rendered client-side
  // from this lookup table so it can read localStorage and stay removable.
  const results = query ? await repository.searchProducts(query) : [];
  const catalog = query ? null : await buildShelfCatalog();

  return (
    <main className="relative pb-4">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
      {/* ─── HERO ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-card halo-tr anim-rise mt-6"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--line)',
          ['--halo' as string]: 'var(--halo-leaf)',
        }}
      >
        <div className="halo-content grid gap-5 p-5 md:grid-cols-[1.5fr_1fr] md:items-center md:p-7">
          {/* Left: the pitch */}
          <div className="relative">
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

      {/* ─── FEED: search results, or your shelf ────────────────────────── */}
      <section className="mt-8">
        {!query && catalog ? (
          <YourShelf catalog={catalog} />
        ) : (
          <>
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
          <div className="relative overflow-hidden rounded-card bg-card px-5 py-7 text-sm text-ink-2 shadow-card halo-tr"
               style={{ border: '1px solid var(--line)', ['--halo' as string]: 'var(--halo-amber)' }}>
            <p className="halo-content font-display italic">Nothing matched yet.</p>
            <p className="halo-content mt-1 text-[12px]">
              The catalog is small until Open Beauty Facts ingestion lands.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map(({ product, brand, pillars }, i) => {
              const reps = AXES.map((a) => pillars[a].representative).filter(
                (r): r is number => r !== null,
              );
              const mean = reps.length ? reps.reduce((a, b) => a + b, 0) / reps.length : null;
              const band = verdictBand(mean);
              const color = band ? VERDICT_VAR[band] : 'var(--ink-3)';
              const haloVar =
                band === 'excellent' || band === 'good'
                  ? 'var(--halo-leaf)'
                  : band === 'fair'
                    ? 'var(--halo-amber)'
                    : 'var(--halo-clay)';

              return (
                <li key={product.id} className="h-full anim-rise" style={{ animationDelay: `${Math.min(220 + i * 55, 760)}ms` }}>
                  <Link
                    href={`/product/${product.id}`}
                    className="relative flex h-full flex-col overflow-hidden rounded-card bg-card shadow-card transition hover:shadow-lift halo-br"
                    style={{
                      border: '1px solid var(--line)',
                      ['--halo' as string]: haloVar,
                    }}
                  >
                    <div className="halo-content flex flex-1 items-stretch gap-3 p-3.5">
                      {/* Score dial */}
                      <div
                        className="relative flex shrink-0 flex-col items-center justify-center rounded-2xl px-3 py-2"
                        style={{
                          background: 'var(--card-2)',
                          border: `1px solid var(--line-soft)`,
                        }}
                      >
                        <ScoreDial pillars={pillars} size={68} />
                      </div>

                      {/* Product info */}
                      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
                        <div className="flex items-center gap-2">
                          <BrandMark name={brand.name} size={28} accent={color} />
                          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                            {brand.name}
                          </span>
                        </div>
                        <p className="font-display text-[16px] font-semibold leading-tight text-ink line-clamp-2">
                          {product.displayName}
                        </p>
                        <div className="flex items-center justify-between gap-2 text-[10px] text-ink-3">
                          <span className="uppercase tracking-[0.10em]">
                            {product.category} · {product.sizeValue}
                            {product.sizeUnit}
                          </span>
                          <span
                            className="rounded-pill px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] shadow-card"
                            style={{
                              color: 'var(--card)',
                              background: color,
                            }}
                          >
                            {band ?? 'no data'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Mini rater spread — pinned to the bottom edge */}
                    <div
                      className="halo-content px-3.5 pb-3"
                      style={{ borderTop: '1px dashed var(--line-soft)' }}
                    >
                      <div className="pt-3">
                        <MiniRaterSpread pillars={pillars} />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
          </>
        )}
      </section>
      </div>
    </main>
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
