import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { repository, ingredientSlug } from '@/lib/data';
import { localProductImage } from '@/lib/product-images';
import { RaterSpread } from '@/components/RaterSpread';
import { CompositeRange } from '@/components/CompositeRange';
import { WeightControls } from '@/components/WeightControls';
import { ScoreRing } from '@/components/ScoreRing';
import { PillarBars } from '@/components/PillarBars';
import { ScoreMethodology } from '@/components/ScoreMethodology';
import { DisagreementCallout } from '@/components/DisagreementCallout';
import { MatchProvenance } from '@/components/MatchProvenance';
import { BrandMark } from '@/components/BrandMark';
import { SonionReactive } from '@/components/SonionReactive';
import { RecordView } from '@/components/RecordView';

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Product detail. Laid out as a real website page rather than a phone column:
 * a full-width title band, then a two-column body — the long "receipts" read down
 * the main column while a **sticky scorecard** (the reactive ring + pillar bars +
 * Sonion + quick exits) stays pinned on the right as you scroll. Sliding the
 * weight controls in the main column visibly moves the ring in the sidebar, which
 * makes the "you own the weighting" thesis tangible.
 *
 * On narrow screens it collapses to one column with the scorecard on top, so the
 * verdict is the first thing you see.
 */
export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const view = await repository.getProduct(id);
  if (!view) notFound();

  const { product, brand, pillars, sources } = view;
  const flags = await repository.listIngredientFlags(product.id);
  const alternatives = await repository.listAlternatives(product.id);
  const imageUrl = localProductImage(product.id);

  return (
    <main className="relative mx-auto w-full max-w-6xl px-5 pt-5 pb-4 md:px-8 md:pt-7">
      {/* Records this look-up onto "your shelf" (client-side, localStorage). */}
      <RecordView id={product.id} />

      {/* ─── BREADCRUMB ─────────────────────────────────────────────────── */}
      <nav className="mb-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        <Link href="/browse" className="hover:text-ink">Catalog</Link>
        <span aria-hidden>/</span>
        <span className="text-ink-2">{brand.name}</span>
        <span aria-hidden>/</span>
        <span className="truncate text-ink">{product.displayName}</span>
      </nav>

      {/* ─── TITLE BAND ─────────────────────────────────────────────────── */}
      <header
        className="relative overflow-hidden rounded-card anim-rise"
        style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
      >
        <div className="flex min-h-[130px]">
          {/* Product photo — shown when a local image exists */}
          {imageUrl && (
            <div
              className="relative hidden w-[150px] shrink-0 sm:block"
              style={{ borderRight: '1px solid var(--line)' }}
            >
              <Image
                src={imageUrl}
                alt={product.displayName}
                fill
                sizes="150px"
                style={{ objectFit: 'cover' }}
                priority
              />
            </div>
          )}

          {/* Info column */}
          <div className="flex flex-1 flex-col justify-between gap-3 p-5 md:p-6">
            <div className="flex items-start gap-3.5">
              {!imageUrl && <BrandMark name={brand.name} size={46} accent="var(--accent-deep)" />}
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">
                  {brand.name}
                </p>
                <h1 className="font-display text-[24px] font-semibold leading-tight text-ink md:text-[30px]">
                  {product.displayName}
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Meta>{product.category}</Meta>
              {product.sizeValue && (
                <Meta>{product.sizeValue}{product.sizeUnit}</Meta>
              )}
              {product.gtin && <Meta>GTIN {product.gtin}</Meta>}
            </div>
          </div>
        </div>
      </header>

      {/* ─── TWO-COLUMN BODY ────────────────────────────────────────────── */}
      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
        {/* ── SCORECARD (right on desktop, top on mobile) ──────────────── */}
        <aside className="lg:order-2 lg:sticky lg:top-[88px]">
          <div className="space-y-4 anim-rise" style={{ animationDelay: '80ms' }}>
            <div
              className="rounded-card"
              style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
            >
              <div className="p-4">
                <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-[0.22em] text-ink-3">
                  Your composite
                </p>
                <div className="flex flex-col items-center">
                  <ScoreRing pillars={pillars} size={236} thickness={15} />
                </div>
                <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--line-soft)' }}>
                  <PillarBars pillars={pillars} height={108} />
                </div>
              </div>
            </div>

            {/* Quick exits — the two CLAUDE.md actions, always reachable. */}
            <div className="grid grid-cols-2 gap-3">
              {alternatives.length > 0 ? (
                <QuickTile
                  href={`/product/${product.id}/alternatives`}
                  kicker="Cleaner options"
                  kickerColor="var(--verdict-excellent)"
                  count={alternatives.length}
                  label="found"
                  cta="See better →"
                  halo="var(--halo-leaf)"
                />
              ) : (
                <FlatTile kicker="Alternatives" line="Nothing beats this on safety." />
              )}
              {flags.length > 0 ? (
                <QuickTile
                  href={`/product/${product.id}/flag/${flags[0]!.slug}`}
                  kicker="Flagged"
                  kickerColor="var(--verdict-poor)"
                  count={flags.length}
                  label={flags.length === 1 ? 'ingredient' : 'ingredients'}
                  cta="What's flagged →"
                  halo="var(--halo-clay)"
                />
              ) : (
                <FlatTile kicker="Flags" line="No ingredient flags." />
              )}
            </div>

            {/* Sonion reads the verdict and reacts to weight changes. */}
            <div
              className="flex items-end justify-between gap-3 overflow-hidden rounded-card p-3.5"
              style={{ background: 'var(--card-2)', border: '1px solid var(--line)' }}
            >
              <div className="pb-1">
                <p className="text-[9px] font-semibold uppercase tracking-[0.20em] text-ink-3">
                  Sonion
                </p>
                <p className="mt-1 max-w-[120px] text-[11.5px] leading-snug text-ink-2">
                  Slide a weight and he'll comment honestly.
                </p>
              </div>
              <SonionReactive pillars={pillars} size={72} />
            </div>
          </div>
        </aside>

        {/* ── RECEIPTS (left on desktop) ───────────────────────────────── */}
        <div className="mt-6 min-w-0 space-y-6 lg:order-1 lg:mt-0">
          {/* Disagreement callout — the thesis, up top. */}
          <div className="anim-rise" style={{ animationDelay: '120ms' }}>
            <DisagreementCallout pillars={pillars} />
          </div>

          {/* Every rater, every axis. */}
          <section className="anim-rise" style={{ animationDelay: '160ms' }}>
            <SectionLabel kicker="the receipts" title="Every rater, every axis" />
            <div
              className="rounded-card p-4 md:p-5"
              style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
            >
              <RaterSpread pillars={pillars} />
            </div>
            <div className="mt-3">
              <MatchProvenance pillars={pillars} />
            </div>
          </section>

          {/* How the score is built. */}
          <section className="anim-rise" style={{ animationDelay: '200ms' }}>
            <ScoreMethodology pillars={pillars} sources={sources} />
          </section>

          {/* Your composite — controls + the range they produce. */}
          <section className="anim-rise" style={{ animationDelay: '220ms' }}>
            <SectionLabel kicker="your composite" title="Weighted by what you care about" />
            <div className="space-y-3">
              <WeightControls />
              <div
                className="rounded-card p-4 md:p-5"
                style={{ background: 'var(--card)', border: '1px solid var(--line)' }}
              >
                <CompositeRange pillars={pillars} />
              </div>
            </div>
          </section>

          {/* Flagged ingredients list. */}
          {flags.length > 0 && (
            <section>
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

          {/* Ingredients. */}
          <section>
            <SectionLabel kicker="as labeled" title="Ingredients" />
            <ul className="flex flex-wrap gap-1.5">
              {product.ingredients.map((name) => {
                const slug = ingredientSlug(name);
                const flagged = flags.some((f) => f.slug === slug);
                const inner = (
                  <span
                    className={`rounded-pill px-2.5 py-1 text-[11px] ${
                      flagged ? 'font-semibold text-ink' : 'text-ink-2'
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
                      <span
                        className="ml-1.5 text-[9px] font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--verdict-poor)' }}
                      >
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
        </div>
      </div>
    </main>
  );
}

function Meta({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded-pill px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-2"
      style={{ background: 'var(--card-2)', border: '1px solid var(--line-soft)' }}
    >
      {children}
    </span>
  );
}

function QuickTile({
  href,
  kicker,
  kickerColor,
  count,
  label,
  cta,
  halo,
}: {
  href: string;
  kicker: string;
  kickerColor: string;
  count: number;
  label: string;
  cta: string;
  halo: string;
}) {
  return (
    <Link
      href={href}
      className="relative overflow-hidden rounded-card p-3.5 transition hover:shadow-card"
      style={{ background: 'var(--card)', border: '1px solid var(--line)', ['--halo' as string]: halo }}
    >
      <div className="halo-content">
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em]" style={{ color: kickerColor }}>
          {kicker}
        </p>
        <p className="mt-1 font-display text-[18px] font-semibold leading-none text-ink">
          {count} <span className="text-[12px] italic font-medium text-ink-2">{label}</span>
        </p>
        <span className="mt-2.5 inline-block text-[11px] font-semibold" style={{ color: 'var(--accent-deep)' }}>
          {cta}
        </span>
      </div>
    </Link>
  );
}

function FlatTile({ kicker, line }: { kicker: string; line: string }) {
  return (
    <div className="rounded-card p-3.5" style={{ background: 'var(--card-2)', border: '1px solid var(--line)' }}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-3">{kicker}</p>
      <p className="mt-1 font-display text-[15px] font-semibold leading-tight text-ink">{line}</p>
    </div>
  );
}

function SectionLabel({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between border-b pb-2" style={{ borderColor: 'var(--line)' }}>
      <h2 className="font-display text-[18px] font-semibold leading-none text-ink">{title}</h2>
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--accent-deep)' }}>
        {kicker}
      </span>
    </div>
  );
}
