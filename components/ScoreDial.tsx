import { AXES, type Pillars } from '@/lib/domain/types';
import { VERDICT_VAR, verdictBand } from '@/lib/domain/verdict';

interface Props {
  pillars: Pillars;
  size?: number;
}

/**
 * Server-rendered, thumbnail-sized score dial for list rows. Uses equal
 * weights for the on-card readout — the personalized composite lives on the
 * product page where the weights store is wired. This is consistent with
 * CLAUDE.md: never persisted, always recomputed, equal-weights default named
 * (not hidden).
 */
export function ScoreDial({ pillars, size = 76 }: Props) {
  let sum = 0;
  let n = 0;
  for (const axis of AXES) {
    const r = pillars[axis].representative;
    if (r === null) continue;
    sum += r;
    n += 1;
  }
  const mean = n === 0 ? null : sum / n;
  const band = verdictBand(mean);
  const color = band ? VERDICT_VAR[band] : 'var(--ink-3)';

  const stroke = 7;
  const r = (size - stroke) / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const SWEEP = 270;
  const arcLen = circ * (SWEEP / 360);
  const dashGap = circ - arcLen;
  const fill = mean === null ? 0 : arcLen * (mean / 100);
  const rotation = 135;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      aria-label={mean === null ? 'No data' : `Composite ${Math.round(mean)}`}
    >
      <g transform={`rotate(${rotation} ${cx} ${cy})`}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--card-2)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${dashGap}`}
        />
        {mean !== null && (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${fill} ${circ}`}
          />
        )}
      </g>
      <text
        x={cx}
        y={cy + 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Fraunces, Georgia, serif"
        fontWeight="600"
        fontSize={size * 0.36}
        fill="var(--ink)"
        style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em' }}
      >
        {mean === null ? '—' : Math.round(mean)}
      </text>
    </svg>
  );
}
