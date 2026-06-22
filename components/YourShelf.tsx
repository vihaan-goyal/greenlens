'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useShelf } from '@/lib/shelf-store';
import type { ShelfBranch, ShelfCard, ShelfCatalog } from '@/lib/shelf-catalog';
import { ScoreDial } from '@/components/ScoreDial';
import { MiniRaterSpread } from '@/components/MiniRaterSpread';
import { BrandMark } from '@/components/BrandMark';
import { AXES, type Axis } from '@/lib/domain/types';
import { VERDICT_VAR, verdictBand } from '@/lib/domain/verdict';

const AXIS_SHORT: Record<Axis, string> = {
  ingredient_safety: 'Safety',
  environmental: 'Eco',
  labor: 'Labor',
  packaging: 'Pkg',
};

function meanOf(card: ShelfCard): number | null {
  let sum = 0;
  let n = 0;
  for (const axis of AXES) {
    const r = card.pillars[axis].representative;
    if (r === null) continue;
    sum += r;
    n += 1;
  }
  return n === 0 ? null : sum / n;
}

/**
 * "On your shelf" — the products you've looked up, newest first, each one
 * removable, with its cleaner alternatives drawn as branches growing off it.
 * Reads persisted history from the shelf store; everything shown is recomputed
 * from the server-provided catalog (scores are never persisted).
 */
export function YourShelf({ catalog }: { catalog: ShelfCatalog }) {
  // Gate on mount so SSR and first client render agree (persisted state only
  // exists on the client) — avoids a hydration mismatch / flash.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const ids = useShelf((s) => s.ids);
  const remove = useShelf((s) => s.remove);
  const clear = useShelf((s) => s.clear);

  if (!mounted) {
    return null;
  }

  const cards = ids.map((id) => catalog.products[id]).filter((c): c is ShelfCard => !!c);

  // Empty shelf renders nothing — the browsable catalog below it is what a
  // first-time visitor does instead, so there's no dead-end empty-state card.
  if (cards.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-[22px] font-semibold leading-none text-ink md:text-[26px]">
          On <span className="italic" style={{ color: 'var(--accent-deep)' }}>your</span> shelf
        </h2>
        <button
          type="button"
          onClick={clear}
          className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3 transition hover:text-ink-2"
        >
          Clear all
        </button>
      </div>

      <ul className="space-y-7">
        {cards.map((card) => {
          const branches = (catalog.alternatives[card.id] ?? [])
            .map((b) => ({ branch: b, alt: catalog.products[b.id] }))
            .filter((x): x is { branch: ShelfBranch; alt: ShelfCard } => !!x.alt);

          return (
            <li key={card.id}>
              <ShelfNode card={card} onRemove={() => remove(card.id)} />

              {branches.length > 0 && (
                <div className="shelf-branches mt-2">
                  <p className="mb-2 ml-1 text-[9.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--accent-deep)' }}>
                    cleaner options branching off
                  </p>
                  <ul>
                    {branches.map(({ branch, alt }) => (
                      <li key={alt.id} className="shelf-branch">
                        <BranchNode card={alt} branch={branch} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ─── the searched product (the trunk) ───────────────────────────────────── */
function ShelfNode({ card, onRemove }: { card: ShelfCard; onRemove: () => void }) {
  const mean = meanOf(card);
  const band = verdictBand(mean);
  const color = band ? VERDICT_VAR[band] : 'var(--ink-3)';
  const halo =
    band === 'excellent' || band === 'good'
      ? 'var(--halo-leaf)'
      : band === 'fair'
        ? 'var(--halo-amber)'
        : 'var(--halo-clay)';

  return (
    <article
      className="relative overflow-hidden rounded-card bg-card shadow-card transition hover:shadow-lift halo-br"
      style={{ border: '1px solid var(--line)', ['--halo' as string]: halo }}
    >
      {/* Full-card click target underneath; content is non-interactive so clicks
          fall through to this link, while the remove button sits above it. */}
      <Link
        href={`/product/${card.id}`}
        aria-label={`${card.displayName} by ${card.brandName}`}
        className="absolute inset-0 z-0 rounded-card"
      />

      <div className="halo-content pointer-events-none relative z-[1] flex items-stretch gap-3 p-3.5">
        <div
          className="relative flex shrink-0 flex-col items-center justify-center rounded-2xl px-3 py-2"
          style={{ background: 'var(--card-2)', border: '1px solid var(--line-soft)' }}
        >
          <ScoreDial pillars={card.pillars} size={68} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
          <div className="flex items-center gap-2 pr-8">
            <BrandMark name={card.brandName} size={28} accent={color} />
            <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
              {card.brandName}
            </span>
          </div>
          <p className="font-display text-[16px] font-semibold leading-tight text-ink line-clamp-2">
            {card.displayName}
          </p>
          <div className="flex items-center justify-between gap-2 text-[10px] text-ink-3">
            <span className="uppercase tracking-[0.10em]">
              {card.category}
              {card.sizeValue ? ` · ${card.sizeValue}${card.sizeUnit ?? ''}` : ''}
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

      <div className="halo-content pointer-events-none relative z-[1] px-3.5 pb-3" style={{ borderTop: '1px dashed var(--line-soft)' }}>
        <div className="pt-3">
          <MiniRaterSpread pillars={card.pillars} />
        </div>
      </div>

      {/* Remove — sits above the overlay link. */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${card.displayName} from your shelf`}
        className="absolute right-2.5 top-2.5 z-[2] flex h-6 w-6 items-center justify-center rounded-full text-ink-3 transition hover:text-ink"
        style={{ background: 'var(--card-2)', border: '1px solid var(--line)' }}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M2 2 L 9 9 M 9 2 L 2 9" />
        </svg>
      </button>
    </article>
  );
}

/* ─── an alternative (a branch) ──────────────────────────────────────────── */
function BranchNode({ card, branch }: { card: ShelfCard; branch: ShelfBranch }) {
  const mean = meanOf(card);
  const band = verdictBand(mean);
  const color = band ? VERDICT_VAR[band] : 'var(--ink-3)';

  return (
    <Link
      href={`/product/${card.id}`}
      className="relative flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card transition hover:shadow-lift"
      style={{ border: '1px solid var(--line)' }}
    >
      <div className="shrink-0">
        <ScoreDial pillars={card.pillars} size={46} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-3">
            {card.brandName}
          </span>
          <span
            className="rounded-pill px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.10em]"
            style={{ color: 'var(--card)', background: color }}
          >
            {band ?? '—'}
          </span>
        </div>
        <p className="truncate font-display text-[13px] font-semibold leading-tight text-ink">
          {card.displayName}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {branch.cleaner.map((c) => (
            <span
              key={`c-${c.axis}`}
              className="rounded-pill px-1.5 py-0.5 text-[9px] font-semibold tabular"
              style={{ background: 'color-mix(in srgb, var(--verdict-excellent) 16%, transparent)', color: 'var(--verdict-excellent)' }}
            >
              +{Math.round(c.delta)} {AXIS_SHORT[c.axis]}
            </span>
          ))}
          {branch.tradeoffs.map((t) => (
            <span
              key={`t-${t.axis}`}
              className="rounded-pill px-1.5 py-0.5 text-[9px] font-semibold tabular"
              style={{ background: 'color-mix(in srgb, var(--verdict-poor) 16%, transparent)', color: 'var(--verdict-poor)' }}
            >
              {Math.round(t.delta)} {AXIS_SHORT[t.axis]}
            </span>
          ))}
          {branch.cleaner.length === 0 && branch.tradeoffs.length === 0 && (
            <span className="text-[9px] text-ink-3">cleaner on safety, even elsewhere</span>
          )}
        </div>
      </div>

      <span aria-hidden className="shrink-0 text-ink-3">›</span>
    </Link>
  );
}
