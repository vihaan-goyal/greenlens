import Link from 'next/link';

/**
 * Site footer. Grounds every app page (a floating column with no bottom edge is
 * a big part of why the app didn't read as a "website"). It restates the thesis,
 * gives a clear secondary navigation, and labels the funding-honesty stance that
 * is the product's whole point.
 */
export function SiteFooter() {
  return (
    <footer className="relative mt-16 border-t" style={{ borderColor: 'var(--line)' }}>
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-12 md:grid-cols-[1.4fr_1fr_1fr] md:px-8">
        {/* Thesis */}
        <div>
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-[9px]"
              style={{ background: 'var(--espresso)' }}
            >
              <svg width="13" height="13" viewBox="0 0 12 12" aria-hidden>
                <path
                  d="M6 11 V 5 M 6 6 C 3 6 2 4 2 2 C 4 2 6 3 6 5 M 6 6 C 9 6 10 4 10 2 C 8 2 6 3 6 5"
                  stroke="var(--accent-warm)"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </span>
            <span className="font-display text-[17px] font-semibold text-ink">Greenlens</span>
          </div>
          <p className="mt-3 max-w-xs text-[12.5px] leading-relaxed text-ink-2">
            Every public rating on one cosmetic, the places they disagree kept
            visible, and a single score whose weighting{' '}
            <span className="u-bold font-semibold">you</span> control.
          </p>
        </div>

        {/* Navigate */}
        <nav>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-3">Navigate</p>
          <ul className="mt-3 space-y-2 text-[13px] font-medium text-ink-2">
            <li><Link href="/browse" className="hover:text-ink">Catalog</Link></li>
            <li><Link href="/#install" className="hover:text-ink">Browser extension</Link></li>
            <li><Link href="/" className="hover:text-ink">How it works</Link></li>
          </ul>
        </nav>

        {/* Principles */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-3">The one rule</p>
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-2">
            We never blend a score that hides who disagrees. Funding model travels
            with every rating. Weights are computed at read time and never stored.
          </p>
        </div>
      </div>

      <div
        className="border-t"
        style={{ borderColor: 'var(--line)', background: 'var(--card-2)' }}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-1 px-5 py-4 text-[11px] text-ink-3 md:flex-row md:items-center md:px-8">
          <span className="uppercase tracking-[0.18em]">Cosmetics only · lead with safety</span>
          <span>Open data via Open Beauty Facts · no EWG/Yuka scraping</span>
        </div>
      </div>
    </footer>
  );
}
