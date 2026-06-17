interface Props {
  name: string;
  size?: number;
  /** Verdict color used for the ring outline, falls back to ink. */
  accent?: string;
}

/**
 * Tiny circular monogram in lieu of a real logo. Two initials, big serif,
 * thin verdict-tinted outline. Gives every product row a visual anchor.
 */
export function BrandMark({ name, size = 44, accent = 'var(--ink-3)' }: Props) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: 'var(--card)',
        border: `1.5px solid ${accent}`,
        boxShadow: `0 0 0 4px color-mix(in srgb, ${accent} 12%, transparent)`,
      }}
      aria-hidden
    >
      <span
        className="font-display font-semibold"
        style={{
          color: 'var(--ink)',
          fontSize: size * 0.42,
          letterSpacing: '-0.04em',
          lineHeight: 1,
        }}
      >
        {initials}
      </span>
    </span>
  );
}
