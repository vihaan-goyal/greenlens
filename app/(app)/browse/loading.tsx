import { Skel } from '@/components/ui/Skeleton';

export default function BrowseLoading() {
  return (
    <main className="relative pb-4" aria-busy="true" aria-label="Loading catalog">
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section
          className="mt-6 overflow-hidden rounded-card"
          style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
        >
          <div className="grid gap-5 p-5 md:grid-cols-[1.5fr_1fr] md:items-center md:p-7">
            {/* Left: headline + search */}
            <div className="space-y-3">
              <Skel className="h-3 w-24" />
              <Skel className="h-10 w-4/5" />
              <Skel className="h-4 w-3/5" />
              <Skel className="mt-4 h-11 w-full rounded-pill" />
              <div className="flex gap-2">
                <Skel className="h-8 w-36 rounded-pill" />
              </div>
            </div>
            {/* Right: Sonion + verdict scale */}
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{ background: 'var(--card-2)', border: '1px solid var(--line-soft)' }}
            >
              <div className="flex items-center gap-3">
                <Skel className="h-[72px] w-[72px] shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skel className="h-3 w-full" />
                  <Skel className="h-3 w-4/5" />
                </div>
              </div>
              <Skel className="h-3 w-24" />
              <Skel className="h-8 w-full rounded-pill" />
            </div>
          </div>
        </section>

        {/* ── Catalog ───────────────────────────────────────────────────── */}
        <section className="mt-10">
          <div
            className="mb-3 flex items-baseline justify-between border-b pb-2"
            style={{ borderColor: 'var(--line)' }}
          >
            <Skel className="h-7 w-52" />
            <Skel className="h-3 w-16" />
          </div>

          {/* Facet chips + sort */}
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {[72, 40, 56, 48, 64].map((w, i) => (
                <Skel key={i} className={`h-7 rounded-pill`} style={{ width: w }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Skel className="h-3 w-8" />
              {[80, 64, 72, 80].map((w, i) => (
                <Skel key={i} className={`h-7 rounded-pill`} style={{ width: w }} />
              ))}
            </div>
          </div>

          {/* Product card grid */}
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

function ProductCardSkeleton() {
  return (
    <li
      className="space-y-3 rounded-card p-4"
      style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
    >
      <div className="flex items-start gap-3">
        <Skel className="h-10 w-10 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skel className="h-3 w-1/3" />
          <Skel className="h-4 w-4/5" />
          <Skel className="h-3 w-1/2" />
        </div>
      </div>
      <Skel className="h-14 w-full rounded-xl" />
      <div className="flex items-center justify-between">
        <Skel className="h-3 w-1/3" />
        <Skel className="h-5 w-16 rounded-pill" />
      </div>
    </li>
  );
}
