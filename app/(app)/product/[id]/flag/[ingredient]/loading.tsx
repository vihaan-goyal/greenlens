import { Skel } from '@/components/ui/Skeleton';

export default function FlagLoading() {
  return (
    <main
      className="mx-auto w-full max-w-4xl px-5 pt-5 pb-4 md:px-8 md:pt-7"
      aria-busy="true"
      aria-label="Loading ingredient flag"
    >
      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-1.5">
        <Skel className="h-3 w-12" />
        <Skel className="h-3 w-2 rounded-none opacity-30" />
        <Skel className="h-3 w-40" />
        <Skel className="h-3 w-2 rounded-none opacity-30" />
        <Skel className="h-3 w-10" />
      </div>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="mb-6 overflow-hidden rounded-card p-5 md:p-6 space-y-3"
        style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
      >
        <Skel className="h-3 w-36" />
        <Skel className="h-9 w-56" />
        <Skel className="h-4 w-full" />
        <Skel className="h-4 w-5/6" />
        <Skel className="h-4 w-3/4" />
      </div>

      {/* ── Rater positions ─────────────────────────────────────────────── */}
      <section className="mb-8">
        <div
          className="mb-3 flex items-baseline justify-between border-b pb-2"
          style={{ borderColor: 'var(--line)' }}
        >
          <Skel className="h-5 w-44" />
          <Skel className="h-3 w-24" />
        </div>
        <ul className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li
              key={i}
              className="space-y-2.5 rounded-card p-4"
              style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1.5">
                  <Skel className="h-4 w-28" />
                  <Skel className="h-3 w-20" />
                </div>
                <Skel className="h-6 w-16 shrink-0 rounded-full" />
              </div>
              <Skel className="h-3 w-full" />
              <Skel className="h-3 w-5/6" />
            </li>
          ))}
        </ul>
      </section>

      {/* ── Match provenance ────────────────────────────────────────────── */}
      <Skel className="h-20 w-full rounded-card" />
    </main>
  );
}
