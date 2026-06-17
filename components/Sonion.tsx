import type { CSSProperties } from 'react';

export type SonionMood = 'happy' | 'neutral' | 'concerned';

interface Props {
  mood?: SonionMood;
  size?: number;
  /** Show the soft halo bloom behind the character. */
  halo?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Idle bob animation. */
  idle?: boolean;
}

/**
 * Sonion — small male sprout guide. The mood prop is a second readout of the
 * verdict, not decoration: straight brows + open eyes for happy, slightly
 * angled brows + flat mouth for neutral, angled brows + small frown for
 * concerned. No blush per CLAUDE.md's masculine spec.
 */
export function Sonion({
  mood = 'neutral',
  size = 132,
  halo = false,
  idle = true,
  className,
  style,
}: Props) {
  const m = MOOD[mood];

  return (
    <div
      className={`relative inline-block ${idle ? 'anim-drift' : ''} ${className ?? ''}`}
      style={{ width: size, height: size, ...style }}
      aria-hidden
    >
      {halo && (
        <span
          className="absolute inset-0 anim-shimmer"
          style={{
            background:
              'radial-gradient(closest-side, var(--halo-leaf), transparent 70%)',
            filter: 'blur(2px)',
          }}
        />
      )}

      <svg
        viewBox="0 0 132 132"
        width={size}
        height={size}
        className="relative"
        role="img"
        aria-label={`Sonion looks ${mood}`}
      >
        <defs>
          <radialGradient id="son-body" cx="38%" cy="32%" r="78%">
            <stop offset="0%" stopColor="#FBF6EA" />
            <stop offset="55%" stopColor="#F2E9D2" />
            <stop offset="100%" stopColor="#E0D2B0" />
          </radialGradient>
          <radialGradient id="son-leaf" cx="40%" cy="35%" r="80%">
            <stop offset="0%" stopColor="#9CB075" />
            <stop offset="60%" stopColor="#6E8854" />
            <stop offset="100%" stopColor="#4F6A3C" />
          </radialGradient>
          <linearGradient id="son-stem" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#7A8D52" />
            <stop offset="100%" stopColor="#56683A" />
          </linearGradient>
          <radialGradient id="son-cheek" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(199, 145, 96, 0.0)" />
            <stop offset="100%" stopColor="rgba(199, 145, 96, 0)" />
          </radialGradient>
        </defs>

        {/* Soft ground shadow */}
        <ellipse cx="66" cy="120" rx="30" ry="4" fill="rgba(46, 42, 34, 0.10)" />

        {/* Leaf cluster — three leaves splayed asymmetrically */}
        <g transform="translate(66 24)">
          {/* center leaf */}
          <path
            d="M0 0 C 4 -14 4 -22 0 -28 C -4 -22 -4 -14 0 0 Z"
            fill="url(#son-leaf)"
          />
          <path d="M0 -2 L 0 -24" stroke="#3F5630" strokeWidth="0.7" strokeLinecap="round" />
          {/* left leaf */}
          <g transform="rotate(-38)">
            <path
              d="M0 0 C 5 -10 5 -18 0 -24 C -5 -18 -5 -10 0 0 Z"
              fill="url(#son-leaf)"
              opacity="0.95"
            />
            <path d="M0 -2 L 0 -20" stroke="#3F5630" strokeWidth="0.7" strokeLinecap="round" />
          </g>
          {/* right leaf */}
          <g transform="rotate(34)">
            <path
              d="M0 0 C 5 -10 5 -18 0 -24 C -5 -18 -5 -10 0 0 Z"
              fill="url(#son-leaf)"
              opacity="0.95"
            />
            <path d="M0 -2 L 0 -20" stroke="#3F5630" strokeWidth="0.7" strokeLinecap="round" />
          </g>
        </g>

        {/* Stem */}
        <path
          d="M66 26 C 64 32 68 36 66 44"
          stroke="url(#son-stem)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />

        {/* Head — slightly egg-shaped, narrower at top */}
        <path
          d="M30 78 C 30 55 44 42 66 42 C 88 42 102 55 102 78 C 102 96 88 106 66 106 C 44 106 30 96 30 78 Z"
          fill="url(#son-body)"
          stroke="#C9BC9A"
          strokeWidth="1.2"
        />

        {/* Subtle facial contour shadow */}
        <path
          d="M30 78 C 30 92 44 104 66 106 C 60 96 56 88 56 78 Z"
          fill="rgba(149, 130, 92, 0.12)"
        />

        {/* Brows — straight (masculine, per spec) — mood tilts subtly */}
        <g
          transform={`translate(0 0)`}
          stroke="#3C3528"
          strokeWidth="2.6"
          strokeLinecap="round"
        >
          <line
            x1="46"
            y1={64 + m.browL.y}
            x2="58"
            y2={64 + m.browL.y + m.browL.tilt}
          />
          <line
            x1="74"
            y1={64 + m.browR.y + m.browR.tilt}
            x2="86"
            y2={64 + m.browR.y}
          />
        </g>

        {/* Eyes */}
        {m.eyesOpen ? (
          <>
            <ellipse cx="52" cy="74" rx="3.4" ry="4.2" fill="#2A241B" />
            <ellipse cx="80" cy="74" rx="3.4" ry="4.2" fill="#2A241B" />
            {/* highlights */}
            <circle cx="53.2" cy="72.6" r="1.1" fill="#FBF6EA" />
            <circle cx="81.2" cy="72.6" r="1.1" fill="#FBF6EA" />
          </>
        ) : (
          <>
            <path d="M48 74 Q 52 78 56 74" stroke="#2A241B" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M76 74 Q 80 78 84 74" stroke="#2A241B" strokeWidth="2" fill="none" strokeLinecap="round" />
          </>
        )}

        {/* Mouth */}
        <path
          d={m.mouth}
          stroke="#2A241B"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

interface BrowSpec {
  y: number;
  tilt: number;
}

interface MoodSpec {
  browL: BrowSpec;
  browR: BrowSpec;
  eyesOpen: boolean;
  mouth: string;
}

const MOOD: Record<SonionMood, MoodSpec> = {
  // y is vertical offset from baseline 64; tilt is endpoint y delta.
  happy: {
    browL: { y: 0, tilt: 0 },
    browR: { y: 0, tilt: 0 },
    eyesOpen: true,
    // gentle smile
    mouth: 'M 56 89 Q 66 96 76 89',
  },
  neutral: {
    browL: { y: 1, tilt: -1 },
    browR: { y: 1, tilt: 1 },
    eyesOpen: true,
    // flat
    mouth: 'M 58 90 L 74 90',
  },
  concerned: {
    // inner brows down
    browL: { y: -1, tilt: 4 },
    browR: { y: -1, tilt: -4 },
    eyesOpen: true,
    // subtle frown
    mouth: 'M 56 93 Q 66 87 76 93',
  },
};
