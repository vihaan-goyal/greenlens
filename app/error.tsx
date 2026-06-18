'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Sonion } from '@/components/Sonion';

/**
 * Route-level error boundary. Catches render/runtime errors in a route segment
 * and offers recovery (`reset()`) instead of leaving the App Router stuck on
 * "missing required error components, refreshing…". Must be a client component.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface it in the console for debugging; never swallow silently.
    console.error('Greenlens route error:', error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <Sonion mood="concerned" size={88} idle />
      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--verdict-poor)' }}>
        Something broke
      </p>
      <h1 className="mt-1 font-display text-[22px] font-semibold leading-tight text-ink">
        That didn&apos;t load.
      </h1>
      <p className="mt-2 max-w-[300px] text-[13px] leading-relaxed text-ink-2">
        An error happened while building this page. It&apos;s on our end, not
        yours.
      </p>
      <div className="mt-5 flex items-center gap-2.5">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-pill px-4 py-2 text-[12.5px] font-semibold"
          style={{ background: 'var(--accent-deep)', color: 'var(--card)' }}
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-pill px-4 py-2 text-[12.5px] font-semibold text-ink-2"
          style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
        >
          Home
        </Link>
      </div>
    </main>
  );
}
