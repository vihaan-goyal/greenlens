import Link from 'next/link';
import { Sonion } from '@/components/Sonion';

/**
 * 404 — reached when `notFound()` fires (e.g. a product page opened with an id
 * that isn't in the catalog, which is exactly what a stale extension deep link
 * can do). Honest and on-brand rather than Next's bare default.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <Sonion mood="concerned" size={88} idle />
      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--accent-deep)' }}>
        Not found
      </p>
      <h1 className="mt-1 font-display text-[22px] font-semibold leading-tight text-ink">
        I don&apos;t have that one.
      </h1>
      <p className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-ink-2">
        That product isn&apos;t in the catalog — coverage on the tail is genuinely
        thin, and we&apos;d rather say so than fake a page.
      </p>
      <Link
        href="/browse"
        className="mt-5 inline-flex items-center gap-1.5 rounded-pill px-4 py-2 text-[12.5px] font-semibold"
        style={{ background: 'var(--accent-deep)', color: 'var(--card)' }}
      >
        Search the catalog
      </Link>
    </main>
  );
}
