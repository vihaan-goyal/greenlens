import Image from 'next/image';
import Link from 'next/link';
import type { ProductView } from '@/lib/data/repository';
import { AXES, type Pillars } from '@/lib/domain/types';
import { VERDICT_VAR, verdictBand } from '@/lib/domain/verdict';
import { ScoreDial } from '@/components/ScoreDial';
import { BrandMark } from '@/components/BrandMark';
import { MiniRaterSpread } from '@/components/MiniRaterSpread';
import { localProductImage } from '@/lib/product-images';
import { productAmazonUrl } from '@/lib/product-amazon';

/**
 * The standard catalog product card. Server component — drops into the search
 * results, default catalog grid, and disagreements feed.
 *
 * Cards with a downloaded product photo show a 130px image header and overlay
 * the score on the image. Cards without a photo use the compact dial layout.
 */

/** Equal-weight mean of the pillar representatives, or null if nothing rated. */
export function meanOfPillars(pillars: Pillars): number | null {
  const reps = AXES.map((a) => pillars[a].representative).filter(
    (r): r is number => r !== null,
  );
  return reps.length ? reps.reduce((a, b) => a + b, 0) / reps.length : null;
}

export function ProductCard({
  view,
  animationDelay,
}: {
  view: ProductView;
  animationDelay?: number;
}) {
  const { product, brand, pillars } = view;
  const mean = meanOfPillars(pillars);
  const band = verdictBand(mean);
  const color = band ? VERDICT_VAR[band] : 'var(--ink-3)';
  const imageUrl = localProductImage(product.id);
  const amazonUrl = productAmazonUrl(product.id);

  return (
    // Outer div — card chrome, hover shadow, rise animation.
    // Inner Link wraps the content area; Amazon link sits in the footer as a
    // sibling (not a descendant) of the Link, avoiding nested-anchor HTML.
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-card bg-card transition hover:shadow-lift anim-rise"
      style={{
        border: '1px solid var(--line)',
        borderTop: `2.5px solid ${color}`,
        boxShadow: '0 2px 8px rgba(46,42,34,0.05)',
        ...(animationDelay !== undefined ? { animationDelay: `${animationDelay}ms` } : {}),
      }}
    >
      {imageUrl ? (
        /* ── Image header (known products) ─────────────────────────── */
        <>
          <Link href={`/product/${product.id}`} className="flex flex-1 flex-col overflow-hidden">
            <div className="relative h-[130px] shrink-0 overflow-hidden" style={{ background: 'var(--card-2)' }}>
              <Image
                src={imageUrl}
                alt={product.displayName}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                style={{ objectFit: 'cover' }}
              />
              {/* Score badge overlaid on image */}
              {mean !== null && band && (
                <div
                  className="absolute bottom-2 left-2 flex items-baseline gap-1.5 rounded-xl px-2.5 py-1.5"
                  style={{
                    background: 'rgba(46,42,34,0.68)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  <span
                    className="font-display text-[20px] font-semibold leading-none tabular"
                    style={{ color: 'var(--card)' }}
                  >
                    {Math.round(mean)}
                  </span>
                  <span
                    className="text-[9px] font-bold uppercase tracking-[0.12em] leading-none"
                    style={{ color }}
                  >
                    {band}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 px-3.5 pt-3 pb-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                {brand.name}
              </p>
              <p className="mt-0.5 font-display text-[15px] font-semibold leading-tight text-ink line-clamp-2">
                {product.displayName}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.10em] text-ink-3">
                {product.category}
                {product.sizeValue ? ` · ${product.sizeValue}${product.sizeUnit}` : ''}
              </p>
            </div>
          </Link>

          {/* Footer: rater spread + Amazon link (outside the Link — no nested anchors) */}
          <div className="px-3.5 pb-3" style={{ borderTop: '1px dashed var(--line-soft)' }}>
            <div className="flex items-center justify-between gap-2 pt-3">
              <MiniRaterSpread pillars={pillars} />
              {amazonUrl && (
                <a
                  href={amazonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-1 rounded-pill px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] transition hover:opacity-70"
                  style={{
                    color: 'var(--ink-2)',
                    border: '1px solid var(--line)',
                    background: 'var(--card-2)',
                  }}
                >
                  Amazon ↗
                </a>
              )}
            </div>
          </div>
        </>
      ) : (
        /* ── Compact dial layout (OBF / unphoto'd products) ────────── */
        <>
          <Link href={`/product/${product.id}`} className="flex flex-1 items-stretch gap-3 p-3.5">
            <div
              className="relative flex shrink-0 flex-col items-center justify-center rounded-2xl px-3 py-2"
              style={{ background: 'var(--card-2)', border: '1px solid var(--line-soft)' }}
            >
              <ScoreDial pillars={pillars} size={68} />
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
              <div className="flex items-center gap-2">
                <BrandMark name={brand.name} size={28} accent={color} />
                <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                  {brand.name}
                </span>
              </div>
              <p className="font-display text-[16px] font-semibold leading-tight text-ink line-clamp-2">
                {product.displayName}
              </p>
              <div className="flex items-center justify-between gap-2 text-[10px] text-ink-3">
                <span className="uppercase tracking-[0.10em]">
                  {product.category}
                  {product.sizeValue ? ` · ${product.sizeValue}${product.sizeUnit}` : ''}
                </span>
                <span
                  className="rounded-pill px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
                  style={{ color: 'var(--card)', background: color }}
                >
                  {band ?? 'no data'}
                </span>
              </div>
            </div>
          </Link>

          <div className="px-3.5 pb-3" style={{ borderTop: '1px dashed var(--line-soft)' }}>
            <div className="pt-3">
              <MiniRaterSpread pillars={pillars} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
