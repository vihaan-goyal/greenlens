import Link from 'next/link';
import { notFound } from 'next/navigation';
import { mockRepository, ingredientSlug } from '@/lib/data/mock-repository';
import { RaterSpread } from '@/components/RaterSpread';
import { CompositeRange } from '@/components/CompositeRange';
import { WeightControls } from '@/components/WeightControls';
import { ScoreRing } from '@/components/ScoreRing';
import { PillarBars } from '@/components/PillarBars';
import { DisagreementCallout } from '@/components/DisagreementCallout';
import { BrandMark } from '@/components/BrandMark';
import { SonionReactive } from '@/components/SonionReactive';

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const view = await mockRepository.getProduct(id);
  if (!view) notFound();

  const { product, brand, pillars } = view;
  const flags = await mockRepository.listIngredientFlags(product.id);
  const alternatives = await mockRepository.listAlternatives(product.id);

  return (
    <main className="relative px-5 pt-3 pb-12">
      {/* Back chip */}
      <nav className="mb-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-2"
          style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
        >
          <span>←</span> back
        </Link>
      </nav>

      {/* ─── HERO ───────────────────────────────────────────────────────── */}
      <section className="relative mb-5 overflow-hidden rounded-card halo-tr anim-rise"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--line)',
          ['--halo' as string]: 'var(--halo-leaf)',
        }}
      >
        <div className="halo-content p-5">
          <div className="flex items-center gap-2.5">
            <BrandMark name={brand.name} size={38} accent="var(--accent-deep)" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">
                {brand.name}
              </p>
              <p className="font-display text-[20px] font-semibold leading-tight text-ink line-clamp-2">
                {product.displayName}
              </p>
            </div>
          </div>

          <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-ink-3">
            {product.category} · {product.sizeValue}
            {product.sizeUnit}
            {product.gtin && <span> · GTIN {product.gtin}</span>}
          </p>

          {/* Ring centerpiece */}
          <div className="relative mt-4 flex flex-col items-center justify-center">
            <ScoreRing pillars={pillars} size={252} thickness={16} />
          </div>

          {/* Pillar bars under the dial */}
          <div className="mt-2 px-1">
            <PillarBars pillars={pillars} height={120} />
          </div>
        </div>
      </section>

      {/* ─── DISAGREEMENT CALLOUT ──────────────────────────────────────── */}
      <section className="mb-5 anim-rise" style={{ animationDelay: '120ms' }}>
        <DisagreementCallout pillars={pillars} />
      </section>

      {/* ─── ALTERNATIVES + FLAGS TILES ────────────────────────────────── */}
      <section className="mb-5 grid grid-cols-2 gap-3 anim-rise" style={{ animationDelay: '180ms' }}>
        {alternatives.length > 0 ? (
          <Link
            href={`/product/${product.id}/alternatives`}
            className="relative overflow-hidden rounded-card p-3.5 halo-bl"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--line)',
              ['--halo' as string]: 'var(--halo-leaf)',
            }}
          >
            <div className="halo-content">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--verdict-excellent)' }}>
                Cleaner options
              </p>
              <p className="mt-1 font-display text-[18px] font-semibold leading-none text-ink">
                {alternatives.length}{' '}
                <span className="italic font-medium text-ink-2">found</span>
              </p>
              <p className="mt-2 text-[10.5px] leading-snug text-ink-2">
                Ranked by ingredient safety. Tradeoffs named for each.
              </p>
              <span className="mt-3 inline-block text-[11px] font-semibold" style={{ color: 'var(--accent-deep)' }}>
                See better →
              </span>
            </div>
          </Link>
        ) : (
          <div
            className="rounded-card p-3.5"
            style={{ background: 'var(--card-2)', border: '1px solid var(--line)' }}
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-3">
              Alternatives
            </p>
            <p className="mt-1 font-display text-[16px] font-semibold leading-tight text-ink">
              Nothing beats this on safety.
            </p>
          </div>
        )}

        {flags.length > 0 ? (
          <Link
            href={`/product/${product.id}/flag/${flags[0]!.slug}`}
            className="relative overflow-hidden rounded-card p-3.5 halo-br"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--line)',
              ['--halo' as string]: 'var(--halo-clay)',
            }}
          >
            <div className="halo-content">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--verdict-poor)' }}>
                Flagged
              </p>
              <p className="mt-1 font-display text-[18px] font-semibold leading-none text-ink">
                {flags.length}{' '}
                <span className="italic font-medium text-ink-2">
                  {flags.length === 1 ? 'ingredient' : 'ingredients'}
                </span>
              </p>
              <p className="mt-2 text-[10.5px] leading-snug text-ink-2">
                Where raters split on the chemistry.
              </p>
              <span className="mt-3 inline-block text-[11px] font-semibold" style={{ color: 'var(--accent-deep)' }}>
                What's flagged →
              </span>
            </div>
          </Link>
        ) : (
          <div
            className="rounded-card p-3.5"
            style={{ background: 'var(--card-2)', border: '1px solid var(--line)' }}
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-3">
              Flags
            </p>
            <p className="mt-1 font-display text-[16px] font-semibold leading-tight text-ink">
              No ingredient flags.
            </p>
          </div>
        )}
      </section>

      {/* ─── EVERY RATER ────────────────────────────────────────────────── */}
      <section className="mb-5 anim-rise" style={{ animationDelay: '240ms' }}>
        <SectionLabel kicker="the receipts" title="Every rater, every axis" />
        <div
          className="rounded-card p-4"
          style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
        >
          <RaterSpread pillars={pillars} />
        </div>
      </section>

      {/* ─── COMPOSITE RANGE ───────────────────────────────────────────── */}
      <section className="mb-5 anim-rise" style={{ animationDelay: '280ms' }}>
        <SectionLabel kicker="your composite" title="Weighted by what you care about" />
        <div
          className="rounded-card p-4"
          style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
        >
          <CompositeRange pillars={pillars} />
        </div>
      </section>

      {/* ─── WEIGHTS ───────────────────────────────────────────────────── */}
      <section className="mb-6 anim-rise" style={{ animationDelay: '320ms' }}>
        <WeightControls />
      </section>

      {/* ─── FLAGGED LIST ──────────────────────────────────────────────── */}
      {flags.length > 0 && (
        <section className="mb-6">
          <SectionLabel kicker="contested chemistry" title="Flagged ingredients" />
          <ul className="space-y-2">
            {flags.map((f) => (
              <li key={f.slug}>
                <Link
                  href={`/product/${product.id}/flag/${f.slug}`}
                  className="flex items-center justify-between rounded-card px-4 py-3 transition hover:shadow-card"
                  style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
                >
                  <span className="font-display text-[15px] font-medium text-ink">{f.name}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                    {f.positions.length} positions →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ─── INGREDIENTS ───────────────────────────────────────────────── */}
      <section>
        <SectionLabel kicker="as labeled" title="Ingredients" />
        <ul className="flex flex-wrap gap-1.5">
          {product.ingredients.map((name) => {
            const slug = ingredientSlug(name);
            const flagged = flags.some((f) => f.slug === slug);
            const inner = (
              <span
                className={`rounded-pill px-2.5 py-1 text-[11px] ${
                  flagged
                    ? 'font-semibold text-ink'
                    : 'text-ink-2'
                }`}
                style={{
                  background: flagged ? 'var(--card)' : 'var(--card-2)',
                  border: flagged
                    ? '1px solid var(--verdict-poor)'
                    : '1px solid var(--line-soft)',
                }}
              >
                {name}
                {flagged && (
                  <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--verdict-poor)' }}>
                    · flagged
                  </span>
                )}
              </span>
            );
            return (
              <li key={name}>
                {flagged ? (
                  <Link href={`/product/${product.id}/flag/${slug}`}>{inner}</Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ─── FLOATING SONION ───────────────────────────────────────────── */}
      <div className="pointer-events-none fixed bottom-12 right-5 z-40">
        <div className="pointer-events-auto">
          <SonionReactive pillars={pillars} size={84} halo />
        </div>
      </div>
    </main>
  );
}

function SectionLabel({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between">
      <h2 className="font-display text-[17px] font-semibold leading-none text-ink">
        {title}
      </h2>
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--accent-deep)' }}>
        {kicker}
      </span>
    </div>
  );
}
