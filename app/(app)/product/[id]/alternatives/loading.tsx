import { Skel } from '@/components/ui/Skeleton';

export default function AlternativesLoading() {
  return (
    <main
      className="mx-auto w-full max-w-5xl px-5 pt-5 pb-4 md:px-8 md:pt-7"
      aria-busy="true"
      aria-label="Loading alternatives"
    >
      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-1.5">
        <Skel className="h-3 w-12" />
        <Skel className="h-3 w-2 rounded-none opacity-30" />
        <Skel className="h-3 w-40" />
        <Skel className="h-3 w-2 rounded-none opacity-30" />
        <Skel className="h-3 w-24" />
      </div>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="mb-6 overflow-hidden rounded-card p-5 md:p-6 space-y-3"
        style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
      >
        <Skel className="h-3 w-28" />
        <Skel className="h-9 w-64" />
        <Skel className="h-4 w-full max-w-xl" />
        <Skel className="h-4 w-3/4 max-w-xl" />
      </div>

      {/* ── Alternative cards ───────────────────────────────────────────── */}
      <ul className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li
            key={i}
            className="space-y-3 rounded-card p-5"
            style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
          >
            <Skel className="h-3 w-1/3" />
            <Skel className="h-4 w-4/5" />
            <Skel className="h-3 w-1/4" />
            {/* Mini rater spread */}
            <Skel className="h-10 w-full rounded-xl" />
            {/* Cleaner / tradeoff grid */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-2">
                <Skel className="h-3 w-24" />
                <Skel className="h-3 w-20" />
                <Skel className="h-3 w-16" />
              </div>
              <div className="space-y-2">
                <Skel className="h-3 w-16" />
                <Skel className="h-3 w-20" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
