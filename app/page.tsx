import Link from 'next/link';
import { mockRepository } from '@/lib/data/mock-repository';
import { MiniRaterSpread } from '@/components/MiniRaterSpread';
import { Sonion } from '@/components/Sonion';
import { BrandMark } from '@/components/BrandMark';
import { ScoreDial } from '@/components/ScoreDial';
import { AXES } from '@/lib/domain/types';
import { VERDICT_VAR, verdictBand } from '@/lib/domain/verdict';

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
    <main className="relative pb-10">
      {/* ─── HERO ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-5 pt-2 pb-7">
        {/* Atmospheric corner washes */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-16 h-72 w-72 rounded-full anim-shimmer"
          style={{
            background:
              'radial-gradient(closest-side, var(--halo-leaf), transparent 70%)',
            filter: 'blur(2px)',
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -left-24 top-40 h-60 w-60 rounded-full"
          style={{
            background:
              'radial-gradient(closest-side, var(--halo-amber), transparent 70%)',
            filter: 'blur(2px)',
            opacity: 0.7,
          }}
        />

        {/* eyebrow w/ tiny sprout glyph */}
        <p className="relative flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.32em] text-ink-2 anim-rise">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path
              d="M6 11 V 5 M 6 6 C 3 6 2 4 2 2 C 4 2 6 3 6 5 M 6 6 C 9 6 10 4 10 2 C 8 2 6 3 6 5"
              stroke="var(--accent-deep)"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          greenlens · vol. 01
        </p>

        {/* Editorial display title */}
        <h1
          className="relative mt-3 font-display text-[46px] font-semibold leading-[0.92] text-ink anim-rise"
          style={{ animationDelay: '60ms' }}
        >
          The <span className="mark-leaf font-bold">second</span>
          <br />
          <span className="italic u-bold" style={{ color: 'var(--accent-deep)' }}>
            opinion
          </span>{' '}
          on every
          <br />
          shelf.
        </h1>

        {/* Sonion + thesis row */}
        <div
          className="relative mt-5 flex items-end gap-3 anim-rise"
          style={{ animationDelay: '140ms' }}
        >
          <Sonion mood="happy" size={108} halo />
          <div className="pb-2">
            <p className="text-[13px] leading-snug text-ink">
              I pull every public rater into one view —{' '}
              <span className="font-display italic font-bold mark-amber" style={{ color: 'var(--ink)' }}>
                and never hide
              </span>{' '}
              where they disagree.
            </p>
            <p className="mt-1 text-[11px] text-ink-3">— Sonion, your guide</p>
          </div>
        </div>

        {/* Search bar — stylized */}
        <form
          method="get"
          action="/"
          className="relative mt-7 anim-rise"
          style={{ animationDelay: '220ms' }}
        >
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

          {/* Or: simulated scan */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled
              className="group inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-[11px] font-medium text-ink-2"
              style={{
                background: 'var(--card-2)',
                border: '1px dashed var(--line)',
              }}
              aria-label="Scan a barcode (simulated, coming soon)"
            >
              <BarcodeGlyph />
              Scan a barcode
              <span className="text-[10px] uppercase tracking-wider text-ink-3">soon</span>
            </button>
            {query && (
              <Link
                href="/"
                className="rounded-pill bg-card px-3 py-1.5 text-[11px] font-medium text-ink-2"
                style={{ border: '1px solid var(--line)' }}
              >
                Clear
              </Link>
            )}
          </div>
        </form>
      </section>

      {/* ─── LEGEND CHIPS ───────────────────────────────────────────────── */}
      <section className="px-5 pb-4">
        <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.20em] text-ink-3">
          <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
          The verdict scale
          <span className="h-px flex-1" style={{ background: 'var(--line)' }} />
        </p>
        <div className="flex items-stretch gap-1">
          {(['bad', 'poor', 'fair', 'good', 'excellent'] as const).map((band, i) => (
            <div
              key={band}
              className="flex-1 rounded-pill px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-[0.10em] shadow-card"
              style={{
                background: VERDICT_VAR[band],
                color: 'var(--card)',
              }}
            >
              <span className="opacity-60 tabular">0{i + 1}</span>{' '}
              <span>{band}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── PRODUCT FEED ───────────────────────────────────────────────── */}
      <section className="px-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-[22px] font-semibold leading-none text-ink">
            {query ? (
              <>
                Results <span className="italic text-ink-2">for</span>{' '}
                <span style={{ color: 'var(--accent-deep)' }}>“{query}”</span>
              </>
            ) : (
              <>
                On the <span className="italic" style={{ color: 'var(--accent-deep)' }}>shelf</span>
              </>
            )}
          </h2>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">
            {products.length} entries
          </span>
        </div>

        {products.length === 0 ? (
          <div className="relative overflow-hidden rounded-card bg-card px-5 py-7 text-sm text-ink-2 shadow-card halo-tr"
               style={{ border: '1px solid var(--line)', ['--halo' as string]: 'var(--halo-amber)' }}>
            <p className="halo-content font-display italic">Nothing matched yet.</p>
            <p className="halo-content mt-1 text-[12px]">
              The catalog is small until Open Beauty Facts ingestion lands.
            </p>
          </div>
        ) : (
          <ul className="space-y-3.5">
            {products.map(({ product, brand, pillars }, i) => {
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
                <li key={product.id} className="anim-rise" style={{ animationDelay: `${260 + i * 70}ms` }}>
                  <Link
                    href={`/product/${product.id}`}
                    className="relative block overflow-hidden rounded-card bg-card shadow-card transition hover:shadow-lift halo-br"
                    style={{
                      border: '1px solid var(--line)',
                      ['--halo' as string]: haloVar,
                    }}
                  >
                    <div className="halo-content flex items-stretch gap-3 p-3.5">
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
      </section>

      {/* ─── THESIS FOOTER ─────────────────────────────────────────────── */}
      <section className="px-5 pt-8">
        <div
          className="relative overflow-hidden rounded-card px-5 py-5 halo-tl"
          style={{
            background: 'var(--espresso)',
            ['--halo' as string]: 'rgba(124, 132, 102, 0.30)',
            color: 'var(--card)',
          }}
        >
          <p className="halo-content font-display text-[10px] font-semibold uppercase tracking-[0.30em]" style={{ color: 'var(--accent-warm)' }}>
            the one rule
          </p>
          <p className="halo-content mt-2 font-display text-[20px] font-semibold leading-snug">
            Never <span className="italic mark-amber" style={{ color: 'var(--ink)' }}>blend</span> a score that hides
            <br />
            <span className="u-bold" style={{ textDecorationColor: 'var(--accent-warm)' }}>who disagrees</span>.
          </p>
          <p className="halo-content mt-3 text-[11px] leading-relaxed" style={{ color: '#D5CCB7' }}>
            Weights are yours, computed at read time, never stored. Funding model
            travels with every rating.
          </p>
        </div>
      </section>
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
