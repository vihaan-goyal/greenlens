'use client';

import { useWeights } from '@/lib/store';
import { overallRange } from '@/lib/domain/scoring';
import { VERDICT_LABEL, VERDICT_VAR, verdictBand } from '@/lib/domain/verdict';
import type { Pillars } from '@/lib/domain/types';

interface Props {
  pillars: Pillars;
  size?: number;
  /** Stroke thickness of the main verdict arc. */
  thickness?: number;
}

/**
 * Quantize a computed SVG coordinate to 0.01px. Math.cos/Math.sin may differ by
 * ~1 ULP between the Node (server) and browser (client) V8 builds, which trips
 * React hydration on the tick endpoints; rounding well below pixel precision
 * makes both sides serialize the same string. Plain arithmetic is IEEE-stable,
 * so only the trig-derived coordinates need this.
 */
const px = (n: number): number => Math.round(n * 100) / 100;

/**
 * Hero composite dial. Pure SVG, no chart lib (per CLAUDE.md).
 *
 * Visual layers (back→front):
 *   1. faint paper-grain track
 *   2. axis-spread band — translucent arc from range.min → range.max
 *   3. solid verdict arc up to the weighted mean
 *   4. dial ticks every 10 along the rim, accented at 25/50/75
 *   5. center column: big tabular number, verdict label, subhead prose
 *
 * The mean marker is the only "single point" we show — the band makes the
 * uncertainty visible at a glance, satisfying CLAUDE.md's spread-first rule.
 */
export function ScoreRing({ pillars, size = 260, thickness = 14 }: Props) {
  const weights = useWeights((s) => s.weights);
  const range = overallRange(pillars, weights);

  const r = (size - thickness) / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;

  // We draw a 3/4 arc (270°), the classic dial. The arc starts at 135° (sw)
  // and sweeps clockwise to 45° (se), leaving the bottom 90° open.
  const SWEEP_DEG = 270;
  const sweepFrac = SWEEP_DEG / 360;
  const arcLen = circ * sweepFrac;
  const dashGap = circ - arcLen;
  // rotate so the gap sits at the bottom (start arc at -225° from 12 o'clock)
  const baseRotation = 135; // start angle in degrees from 3 o'clock CW

  const mean = range?.mean ?? 0;
  const min = range?.min ?? 0;
  const max = range?.max ?? 0;
  const band = verdictBand(range?.mean ?? null);
  const color = band ? VERDICT_VAR[band] : 'var(--ink-3)';
  const label = band ? VERDICT_LABEL[band] : 'No data';

  const meanDash = arcLen * (mean / 100);
  const bandStart = arcLen * (min / 100);
  const bandEnd = arcLen * (max / 100);
  const bandLen = Math.max(0, bandEnd - bandStart);

  return (
    <div className="relative inline-flex flex-col items-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="block"
        role="img"
        aria-label={`Composite ${Math.round(mean)} out of 100, ${label}`}
      >
        <defs>
          <radialGradient id="ring-bloom" cx="50%" cy="55%" r="50%">
            <stop offset="0%" stopColor={`color-mix(in srgb, ${color} 22%, transparent)`} />
            <stop offset="70%" stopColor="transparent" />
          </radialGradient>
          <linearGradient id="ring-color" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop
              offset="100%"
              stopColor={`color-mix(in srgb, ${color} 78%, #2E2A22 22%)`}
            />
          </linearGradient>
        </defs>

        {/* Center bloom */}
        <circle cx={cx} cy={cy} r={r - 6} fill="url(#ring-bloom)" />

        {/* Track */}
        <g transform={`rotate(${baseRotation} ${cx} ${cy})`}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--card-2)"
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${arcLen} ${dashGap}`}
          />

          {/* Uncertainty band — translucent verdict color */}
          {range && bandLen > 0.5 && (
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={color}
              strokeOpacity="0.22"
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDasharray={`0 ${bandStart} ${bandLen} ${circ}`}
              style={{ transition: 'stroke-dasharray 600ms ease' }}
            />
          )}

          {/* Mean arc — solid verdict color */}
          {range && (
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="url(#ring-color)"
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDasharray={`${meanDash} ${circ}`}
              style={{
                transition: 'stroke-dasharray 700ms cubic-bezier(0.2, 0.7, 0.2, 1)',
              }}
            />
          )}
        </g>

        {/* Tick marks every 10, plus accented 25 / 50 / 75 */}
        <g>
          {Array.from({ length: 11 }).map((_, i) => {
            const t = i / 10;
            const angleDeg = baseRotation + t * SWEEP_DEG;
            const a = (angleDeg * Math.PI) / 180;
            const inner = r - thickness / 2 - 6;
            const outer = r - thickness / 2 - 2;
            const x1 = px(cx + Math.cos(a) * inner);
            const y1 = px(cy + Math.sin(a) * inner);
            const x2 = px(cx + Math.cos(a) * outer);
            const y2 = px(cy + Math.sin(a) * outer);
            const accent = i === 0 || i === 5 || i === 10;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="var(--ink-3)"
                strokeOpacity={accent ? 0.55 : 0.25}
                strokeWidth={accent ? 1.5 : 1}
                strokeLinecap="round"
              />
            );
          })}
        </g>

        {/* Mean marker dot on the arc */}
        {range && (
          <g
            transform={`rotate(${baseRotation + SWEEP_DEG * (mean / 100)} ${cx} ${cy})`}
            style={{ transition: 'transform 700ms cubic-bezier(0.2, 0.7, 0.2, 1)' }}
          >
            <circle
              cx={cx + r}
              cy={cy}
              r={thickness / 2 + 2}
              fill="var(--card)"
              stroke={color}
              strokeWidth="2.5"
            />
          </g>
        )}

        {/* Center labels */}
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          fontFamily="Fraunces, Georgia, serif"
          fontWeight="600"
          fontSize={size * 0.30}
          fill="var(--ink)"
          style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em' }}
        >
          {range ? Math.round(mean) : '—'}
        </text>
        <text
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          fontFamily="Manrope, sans-serif"
          fontSize="10"
          fontWeight="600"
          letterSpacing="0.22em"
          fill="var(--ink-3)"
        >
          OUT OF 100
        </text>
        <text
          x={cx}
          y={cy + 36}
          textAnchor="middle"
          fontFamily="Fraunces, Georgia, serif"
          fontSize="15"
          fontStyle="italic"
          fontWeight="500"
          fill={color}
        >
          {label}
        </text>
      </svg>

      {/* Range readout sits just below the dial */}
      {range && max - min > 0.5 && (
        <p className="-mt-2 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-3">
          range <span className="tabular text-ink-2">{Math.round(min)}–{Math.round(max)}</span>
        </p>
      )}
    </div>
  );
}
