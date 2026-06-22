import Link from 'next/link';
import type { ProductView } from '@/lib/data/repository';
import { AXES, type Pillars } from '@/lib/domain/types';
import { VERDICT_VAR, verdictBand } from '@/lib/domain/verdict';
import { ScoreDial } from '@/components/ScoreDial';
import { BrandMark } from '@/components/BrandMark';
import { MiniRaterSpread } from '@/components/MiniRaterSpread';

/**
 * The standard catalog product card: a score dial, brand mark, name,
 * category/size, a verdict badge, and the mini rater spread pinned to the
 * bottom. Extracted so the search results, the default catalog grid, and the
 * disagreements feed all render the exact same card instead of three copies.
 *
 * Server component (no interactivity beyond the link), so it drops straight into
 * the server-rendered grids.
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
  const haloVar =
    band === 'excellent' || band === 'good'
      ? 'var(--halo-leaf)'
      : band === 'fair'
        ? 'var(--halo-amber)'
        : 'var(--halo-clay)';

  return (
    <Link
      href={`/product/${product.id}`}
      className="relative flex h-full flex-col overflow-hidden rounded-card bg-card shadow-card transition hover:shadow-lift halo-br anim-rise"
      style={{
        border: '1px solid var(--line)',
        ['--halo' as string]: haloVar,
        ...(animationDelay !== undefined ? { animationDelay: `${animationDelay}ms` } : {}),
      }}
    >
      <div className="halo-content flex flex-1 items-stretch gap-3 p-3.5">
        {/* Score dial */}
        <div
          className="relative flex shrink-0 flex-col items-center justify-center rounded-2xl px-3 py-2"
          style={{ background: 'var(--card-2)', border: '1px solid var(--line-soft)' }}
        >
          <ScoreDial pillars={pillars} size={68} />
        </div>

        {/* Product info */}
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
              {product.category} · {product.sizeValue}
              {product.sizeUnit}
            </span>
            <span
              className="rounded-pill px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] shadow-card"
              style={{ color: 'var(--card)', background: color }}
            >
              {band ?? 'no data'}
            </span>
          </div>
        </div>
      </div>

      {/* Mini rater spread — pinned to the bottom edge */}
      <div className="halo-content px-3.5 pb-3" style={{ borderTop: '1px dashed var(--line-soft)' }}>
        <div className="pt-3">
          <MiniRaterSpread pillars={pillars} />
        </div>
      </div>
    </Link>
  );
}
