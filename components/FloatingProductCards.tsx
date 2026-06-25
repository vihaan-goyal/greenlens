'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Sonion } from './Sonion';
import type { VerdictBand } from '@/lib/domain/types';
import { VERDICT_VAR } from '@/lib/domain/verdict';

export interface SpotlightProduct {
  id: string;
  displayName: string;
  brandName: string;
  category: string;
  score: number;
  band: VerdictBand;
  imageUrl: string;
}

const CATEGORY_THEME: Record<string, { bg: string; accent: string }> = {
  serum:            { bg: '#EBF0E4', accent: '#5E7B53' },
  moisturizer:      { bg: '#F4EDE0', accent: '#BC8255' },
  lotion:           { bg: '#F0EBE0', accent: '#C99560' },
  cleanser:         { bg: '#E4EBF0', accent: '#6E8899' },
  sunscreen:        { bg: '#F5F0DC', accent: '#B5904A' },
  mascara:          { bg: '#E8E4E0', accent: '#3A342B' },
  'hair treatment': { bg: '#EDE4F0', accent: '#8A5E9A' },
  'lip balm':       { bg: '#F0E4E4', accent: '#B0655A' },
};
const DEFAULT_THEME = { bg: '#EEE9E0', accent: '#7C8466' };

function CategoryIllustration({ category, accent }: { category: string; accent: string }) {
  if (category === 'serum') return (
    <svg width="48" height="64" viewBox="0 0 48 64" fill="none" aria-hidden>
      <rect x="16" y="20" width="16" height="36" rx="4" fill={accent} opacity="0.18" />
      <rect x="19" y="20" width="10" height="36" rx="3" fill={accent} opacity="0.25" />
      <rect x="20" y="8" width="8" height="14" rx="2" fill={accent} opacity="0.3" />
      <rect x="22" y="4" width="4" height="8" rx="1" fill={accent} opacity="0.5" />
      <ellipse cx="24" cy="40" rx="5" ry="8" fill={accent} opacity="0.12" />
    </svg>
  );
  if (category === 'moisturizer' || category === 'lotion') return (
    <svg width="56" height="48" viewBox="0 0 56 48" fill="none" aria-hidden>
      <ellipse cx="28" cy="36" rx="22" ry="8" fill={accent} opacity="0.12" />
      <rect x="10" y="14" width="36" height="24" rx="8" fill={accent} opacity="0.18" />
      <rect x="14" y="18" width="28" height="16" rx="5" fill={accent} opacity="0.2" />
      <rect x="18" y="6" width="20" height="10" rx="4" fill={accent} opacity="0.28" />
      <path d="M 20 6 Q 28 2 36 6" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.4" />
    </svg>
  );
  if (category === 'sunscreen') return (
    <svg width="44" height="64" viewBox="0 0 44 64" fill="none" aria-hidden>
      <rect x="8" y="18" width="28" height="38" rx="6" fill={accent} opacity="0.18" />
      <rect x="12" y="22" width="20" height="30" rx="4" fill={accent} opacity="0.22" />
      <rect x="14" y="10" width="16" height="10" rx="3" fill={accent} opacity="0.3" />
      <ellipse cx="22" cy="10" rx="5" ry="2.5" fill={accent} opacity="0.35" />
    </svg>
  );
  if (category === 'cleanser') return (
    <svg width="52" height="60" viewBox="0 0 52 60" fill="none" aria-hidden>
      <rect x="10" y="16" width="32" height="36" rx="8" fill={accent} opacity="0.16" />
      <rect x="16" y="22" width="20" height="26" rx="5" fill={accent} opacity="0.2" />
      <ellipse cx="26" cy="16" rx="10" ry="5" fill={accent} opacity="0.25" />
      <rect x="22" y="8" width="8" height="10" rx="2" fill={accent} opacity="0.3" />
    </svg>
  );
  if (category === 'mascara') return (
    <svg width="20" height="68" viewBox="0 0 20 68" fill="none" aria-hidden>
      <rect x="4" y="24" width="12" height="36" rx="6" fill={accent} opacity="0.25" />
      <rect x="5" y="10" width="10" height="16" rx="3" fill={accent} opacity="0.35" />
      <path d="M 10 4 L 10 12" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
  if (category === 'hair treatment') return (
    <svg width="48" height="56" viewBox="0 0 48 56" fill="none" aria-hidden>
      <rect x="12" y="14" width="24" height="32" rx="12" fill={accent} opacity="0.18" />
      <rect x="16" y="18" width="16" height="24" rx="8" fill={accent} opacity="0.22" />
      <ellipse cx="24" cy="14" rx="8" ry="4" fill={accent} opacity="0.3" />
      <rect x="20" y="6" width="8" height="10" rx="3" fill={accent} opacity="0.28" />
    </svg>
  );
  return (
    <svg width="44" height="56" viewBox="0 0 44 56" fill="none" aria-hidden>
      <rect x="8" y="16" width="28" height="32" rx="10" fill={accent} opacity="0.18" />
      <rect x="12" y="20" width="20" height="24" rx="6" fill={accent} opacity="0.22" />
      <rect x="14" y="8" width="16" height="10" rx="4" fill={accent} opacity="0.28" />
    </svg>
  );
}

function ProductCard({
  product,
  side,
  delay,
}: {
  product: SpotlightProduct;
  side: 'left' | 'right';
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Try local file first (higher quality when downloaded), fall back to external URL
  const localExts = ['jpg', 'png', 'webp'];
  const [srcIndex, setSrcIndex] = useState(0);
  const srcs = [
    ...localExts.map((ext) => `/products/${product.id}.${ext}`),
    product.imageUrl,
  ];
  const imgFailed = srcIndex >= srcs.length;
  const theme = CATEGORY_THEME[product.category] ?? DEFAULT_THEME;
  const mood = product.score >= 70 ? 'happy' : product.score >= 55 ? 'neutral' : 'concerned';
  const scoreColor = VERDICT_VAR[product.band];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = `translateX(${side === 'left' ? '-36px' : '36px'})`;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setTimeout(() => {
            if (!el) return;
            el.style.transition = 'opacity 620ms cubic-bezier(0.2, 0.7, 0.2, 1), transform 620ms cubic-bezier(0.2, 0.7, 0.2, 1)';
            el.style.opacity = '1';
            el.style.transform = 'translateX(0)';
          }, delay);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [side, delay]);

  return (
    <div ref={ref}>
    <Link
      href={`/product/${product.id}`}
      className="block w-[260px] overflow-hidden rounded-[20px] transition-transform duration-200 hover:-translate-y-1"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        boxShadow: '0 2px 8px rgba(46,42,34,0.06), 0 14px 32px -12px rgba(46,42,34,0.18)',
      }}
    >
      {/* Image or illustrated placeholder */}
      <div
        className="relative flex h-[160px] items-center justify-center overflow-hidden"
        style={{ background: theme.bg }}
      >
        {!imgFailed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={srcs[srcIndex]}
            alt={product.displayName}
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setSrcIndex((i) => i + 1)}
          />
        )}
        {imgFailed && (
          <div style={{ transform: 'scale(1.7)' }}>
            <CategoryIllustration category={product.category} accent={theme.accent} />
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
          {product.brandName}
        </p>
        <p className="mt-1 text-[15px] font-semibold leading-snug text-ink line-clamp-2">
          {product.displayName}
        </p>
        <div className="mt-3.5 flex items-center gap-3">
          <Sonion mood={mood} size={36} />
          <div className="flex items-baseline gap-1.5">
            <span
              className="font-display text-[28px] font-semibold tabular leading-none"
              style={{ color: scoreColor }}
            >
              {Math.round(product.score)}
            </span>
            <span
              className="text-[11px] font-bold uppercase tracking-[0.1em] leading-none"
              style={{ color: scoreColor }}
            >
              {product.band}
            </span>
          </div>
        </div>
      </div>
    </Link>
    </div>
  );
}

/** Left sidebar — call inside the three-column flex layout in page.tsx */
export function LeftProductColumn({ products }: { products: SpotlightProduct[] }) {
  const items = products.filter((_, i) => i % 2 === 0);
  return (
    <div
      className="hidden [@media(min-width:1440px)]:flex w-[260px] shrink-0 flex-col gap-5"
      style={{ paddingTop: '100px' }}
    >
      {items.map((p, i) => (
        <ProductCard key={p.id} product={p} side="left" delay={i * 130} />
      ))}
    </div>
  );
}

/** Right sidebar — call inside the three-column flex layout in page.tsx */
export function RightProductColumn({ products }: { products: SpotlightProduct[] }) {
  const items = products.filter((_, i) => i % 2 === 1);
  return (
    <div
      className="hidden [@media(min-width:1440px)]:flex w-[260px] shrink-0 flex-col gap-5"
      style={{ paddingTop: '260px' }}
    >
      {items.map((p, i) => (
        <ProductCard key={p.id} product={p} side="right" delay={i * 130 + 65} />
      ))}
    </div>
  );
}
