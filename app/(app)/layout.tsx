import { Suspense } from 'react';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';

/**
 * Shell for the app screens (catalog + product + detail pages). This is what
 * turns a set of stranded screens into one website: a persistent masthead at the
 * top, the page content on a warm canvas, and a grounding footer at the bottom.
 *
 * The whole thing is a flex column at min screen height so short pages still push
 * the footer to the bottom edge — no page ever floats in an unbounded void. Each
 * page owns its own max-width inside `main`, so the catalog can spread wide while
 * detail pages keep a comfortable two-column reading layout.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col" style={{ background: 'var(--bg)' }}>
      {/* Ambient botanical washes — fixed, desktop only, kept faint so wide
          screens stay warm without washing out the content. */}
      <span
        aria-hidden
        className="pointer-events-none fixed -right-40 -top-40 hidden h-[36rem] w-[36rem] rounded-full anim-shimmer md:block"
        style={{ background: 'radial-gradient(closest-side, var(--halo-leaf), transparent 70%)' }}
      />
      <span
        aria-hidden
        className="pointer-events-none fixed -left-48 bottom-0 hidden h-[32rem] w-[32rem] rounded-full md:block"
        style={{ background: 'radial-gradient(closest-side, var(--halo-amber), transparent 70%)' }}
      />

      {/* Suspense boundary for SiteHeader's useSearchParams (reflecting the
          active query in the masthead search). */}
      <Suspense fallback={<div className="h-[57px]" style={{ borderBottom: '1px solid var(--line)' }} />}>
        <SiteHeader />
      </Suspense>
      <div className="relative z-10 flex-1">{children}</div>
      <div className="relative z-10">
        <SiteFooter />
      </div>
    </div>
  );
}
