'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Persistent masthead for the app screens. This is the single biggest thing that
 * makes Greenlens read as a *website* rather than a stranded screen: a fixed
 * wordmark, primary navigation with an unambiguous active state, and an always-
 * present lookup field. Every page hangs off this bar, so you always know where
 * you are and how to get anywhere else.
 *
 * Client component only for the active-link highlight (usePathname). The search
 * is a plain GET form, so it works with or without JS.
 */
export function SiteHeader() {
  const pathname = usePathname() ?? '';
  const onCatalog = pathname === '/browse' || pathname.startsWith('/product');

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'color-mix(in srgb, var(--bg) 80%, transparent)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-5 md:px-8">
        {/* ─── Wordmark ─────────────────────────────────────────────────── */}
        <Link href="/browse" className="group flex shrink-0 items-center gap-2.5 py-3">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-[10px]"
            style={{ background: 'var(--espresso)' }}
          >
            <svg width="15" height="15" viewBox="0 0 12 12" aria-hidden>
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
          <span className="flex flex-col leading-none">
            <span className="font-display text-[19px] font-semibold tracking-tight text-ink">
              Greenlens
            </span>
            <span className="mt-0.5 text-[8.5px] font-bold uppercase tracking-[0.24em] text-ink-3">
              the field guide
            </span>
          </span>
        </Link>

        {/* ─── Primary nav ──────────────────────────────────────────────── */}
        <nav className="ml-2 hidden items-center gap-1 md:flex">
          <NavLink href="/browse" active={onCatalog}>
            Catalog
          </NavLink>
          <NavLink href="/#install" active={false}>
            Extension
          </NavLink>
          <NavLink href="/" active={pathname === '/'}>
            How it works
          </NavLink>
        </nav>

        {/* ─── Lookup ───────────────────────────────────────────────────── */}
        <form method="get" action="/browse" className="ml-auto flex min-w-0 items-center">
          <div
            className="flex min-w-0 items-center gap-2 rounded-pill bg-card pl-3.5 pr-1.5 py-1.5"
            style={{ border: '1px solid var(--line)' }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden className="shrink-0">
              <circle cx="7" cy="7" r="4.5" stroke="var(--ink-3)" strokeWidth="1.6" fill="none" />
              <path d="M10.5 10.5 L 14 14" stroke="var(--ink-3)" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              name="q"
              type="text"
              placeholder="Look up a product"
              aria-label="Search products"
              className="w-28 min-w-0 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-3 focus:w-40 md:w-36 md:focus:w-52"
              style={{ transition: 'width 220ms cubic-bezier(0.2,0.7,0.2,1)' }}
            />
            <button
              type="submit"
              aria-label="Search"
              className="shrink-0 rounded-pill bg-espresso px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-card"
            >
              Go
            </button>
          </div>
        </form>
      </div>
    </header>
  );
}

function NavLink({
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
      className="relative rounded-pill px-3 py-1.5 text-[13px] font-semibold transition"
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
