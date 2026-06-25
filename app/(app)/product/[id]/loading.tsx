import { Skel } from '@/components/ui/Skeleton';

export default function ProductLoading() {
  return (
    <main
      className="relative mx-auto w-full max-w-6xl px-5 pt-5 pb-4 md:px-8 md:pt-7"
      aria-busy="true"
      aria-label="Loading product"
    >
      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-1.5">
        <Skel className="h-3 w-12" />
        <Skel className="h-3 w-2 rounded-none opacity-30" />
        <Skel className="h-3 w-20" />
        <Skel className="h-3 w-2 rounded-none opacity-30" />
        <Skel className="h-3 w-40" />
      </div>

      {/* ── Title band ──────────────────────────────────────────────────── */}
      <div
        className="overflow-hidden rounded-card"
        style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
      >
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
          <div className="flex items-center gap-3.5">
            <Skel className="h-[46px] w-[46px] shrink-0 rounded-full" />
            <div className="space-y-2">
              <Skel className="h-3 w-20" />
              <Skel className="h-7 w-56" />
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Skel className="h-6 w-24 rounded-pill" />
            <Skel className="h-6 w-16 rounded-pill" />
            <Skel className="h-6 w-28 rounded-pill" />
          </div>
        </div>
      </div>

      {/* ── Two-column body ─────────────────────────────────────────────── */}
      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">

        {/* ── Scorecard aside ─────────────────────────────────────────── */}
        <aside className="space-y-4 lg:order-2">
          {/* Ring card */}
          <div
            className="overflow-hidden rounded-card p-4"
            style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
          >
            <Skel className="mx-auto mb-4 h-3 w-28" />
            <div className="flex justify-center">
              <Skel className="h-[236px] w-[236px] rounded-full" />
            </div>
            {/* Pillar bars */}
            <div
              className="mt-3 space-y-3 border-t pt-3"
              style={{ borderColor: 'var(--line-soft)' }}
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skel className="h-3 w-20 shrink-0" />
                  <Skel className="h-2 flex-1 rounded-full" />
                  <Skel className="h-3 w-7 shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* Quick-exit tiles */}
          <div className="grid grid-cols-2 gap-3">
            <Skel className="h-[88px] rounded-card" />
            <Skel className="h-[88px] rounded-card" />
          </div>

          {/* Sonion area */}
          <div
            className="flex items-center gap-3 rounded-card p-3.5"
            style={{ background: 'var(--card-2)', border: '1px solid var(--line)' }}
          >
            <Skel className="h-[64px] w-[64px] shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skel className="h-3 w-full" />
              <Skel className="h-3 w-3/4" />
              <Skel className="h-3 w-1/2" />
            </div>
          </div>
        </aside>

        {/* ── Receipts ────────────────────────────────────────────────── */}
        <div className="mt-6 min-w-0 space-y-6 lg:order-1 lg:mt-0">
          {/* Disagreement callout */}
          <Skel className="h-[72px] w-full rounded-card" />

          {/* Rater spread section */}
          <section>
            <SectionLabelSkel />
            <div
              className="space-y-3 rounded-card p-4 md:p-5"
              style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skel className="h-4 w-24 shrink-0" />
                  <Skel className="h-2 flex-1 rounded-full" />
                  <Skel className="h-4 w-8 shrink-0" />
                </div>
              ))}
            </div>
          </section>

          {/* Score methodology */}
          <Skel className="h-32 w-full rounded-card" />

          {/* Weight controls + composite range */}
          <section>
            <SectionLabelSkel wide />
            <Skel className="h-52 w-full rounded-card" />
          </section>
        </div>
      </div>
    </main>
  );
}

function SectionLabelSkel({ wide }: { wide?: boolean }) {
  return (
    <div
      className="mb-2.5 flex items-baseline justify-between border-b pb-2"
      style={{ borderColor: 'var(--line)' }}
    >
      <Skel className={`h-5 ${wide ? 'w-64' : 'w-48'}`} />
      <Skel className="h-3 w-20" />
    </div>
  );
}
