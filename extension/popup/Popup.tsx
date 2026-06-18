import { useEffect, useRef, useState } from 'react';
import type { ContentState, ContentToPopup, VerdictPayload } from '../shared/messages';
import {
  AXES,
  AXIS_LABEL,
  FUNDING_LABEL,
  type IngredientFlag,
  type IngredientStance,
  type Pillars,
  type Weights,
} from '@/lib/domain/types';
import { defaultWeights, overall, overallRange, topMarginalDriver } from '@/lib/domain/scoring';
import { VERDICT_LABEL, VERDICT_VAR, verdictBand } from '@/lib/domain/verdict';
import { Sonion, type SonionMood } from '@/components/Sonion';

/** Where we are inside the popup. Two screens, no real router. */
type Nav = { kind: 'verdict' } | { kind: 'flag'; slug: string };

const WEIGHTS_KEY = 'greenlens.weights';

/**
 * Toolbar popup. Two responsibilities, in priority order:
 *   1. Show the rater-by-rater detail for whatever the active Amazon tab is
 *      looking at. This is the thesis of Greenlens — every source named,
 *      every funding model named, disagreement made visible.
 *   2. Let the user adjust their per-axis weighting. The composite is
 *      recomputed at render time and never persisted.
 *
 * The popup queries the active tab's content script for its current state
 * (verdict / unknown / idle). MV3 service workers go to sleep so we don't
 * cache there; the content script is the authoritative view.
 */
export function Popup() {
  const [tabState, setTabState] = useState<ContentState | null>(null);
  const [weights, setWeights] = useState<Weights>(defaultWeights);
  const [nav, setNav] = useState<Nav>({ kind: 'verdict' });
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted weights.
  useEffect(() => {
    chrome.storage.local.get([WEIGHTS_KEY], (s) => {
      const v = s[WEIGHTS_KEY] as Partial<Weights> | undefined;
      if (v) setWeights({ ...defaultWeights(), ...v });
    });
    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
  }, []);

  // Ask the active tab what it's currently showing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        if (!cancelled) setTabState({ kind: 'idle' });
        return;
      }
      try {
        const reply = (await chrome.tabs.sendMessage(tab.id, {
          kind: 'getCurrentState',
        })) as ContentToPopup;
        if (!cancelled) {
          setTabState(reply.kind === 'none' ? { kind: 'idle' } : reply);
        }
      } catch {
        // Active tab isn't ours — no content script to talk to.
        if (!cancelled) setTabState({ kind: 'idle' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateWeight = (axis: keyof Weights, value: number) => {
    const next: Weights = { ...weights, [axis]: Math.max(0, value) };
    setWeights(next);
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      chrome.storage.local.set({ [WEIGHTS_KEY]: next });
    }, 150);
  };

  const verdict = tabState?.kind === 'verdict' ? tabState.payload : null;
  const mood = headerMood(verdict?.pillars, weights);

  // Flag detail screen takes over the popup — no header chrome, no weight
  // controls. Returns the user to the verdict via the back button.
  if (nav.kind === 'flag' && verdict) {
    const flag = verdict.flags.find((f) => f.slug === nav.slug);
    if (flag) {
      return <FlagDetailScreen flag={flag} onBack={() => setNav({ kind: 'verdict' })} />;
    }
    // Flag missing — fall back to verdict.
  }

  return (
    <main>
      <header className="gl-header">
        <div>
          <h1 className="gl-wordmark">Greenlens</h1>
          <p className="gl-header-tag">For your weighting</p>
        </div>
        <Sonion mood={mood} size={42} idle />
      </header>

      {tabState === null && <section className="gl-section gl-blank" />}

      {tabState?.kind === 'verdict' && (
        <ProductPanel
          payload={tabState.payload}
          weights={weights}
          onOpenFlag={(slug) => setNav({ kind: 'flag', slug })}
        />
      )}

      {tabState?.kind === 'unknown' && <UnknownBlock rawName={tabState.rawName} />}

      {tabState?.kind === 'idle' && <IdleBlock />}

      <section className="gl-section">
        <p className="gl-eyebrow">Your weighting</p>
        {AXES.map((axis) => (
          <label key={axis} className="gl-weight">
            <span className="gl-weight-head">
              <span>{AXIS_LABEL[axis]}</span>
              <span className="gl-weight-value">{weights[axis].toFixed(1)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={3}
              step={0.1}
              value={weights[axis]}
              onChange={(e) => updateWeight(axis, Number(e.target.value))}
            />
          </label>
        ))}
        <p className="gl-foot">
          The composite is computed from these weights at read time — never
          stored, never blended behind your back.
        </p>
      </section>
    </main>
  );
}

// ─── product panel ─────────────────────────────────────────────────────────

function ProductPanel({
  payload,
  weights,
  onOpenFlag,
}: {
  payload: VerdictPayload;
  weights: Weights;
  onOpenFlag: (slug: string) => void;
}) {
  const o = overall(payload.pillars, weights);
  const range = overallRange(payload.pillars, weights);
  const band = verdictBand(o);
  const color = band ? VERDICT_VAR[band] : 'var(--ink-3)';
  const driver = topMarginalDriver(payload.pillars, weights);

  return (
    <section className="gl-section">
      <p className="gl-eyebrow">Looking at</p>
      <h2 className="gl-product-name">{payload.product.displayName}</h2>
      <p className="gl-brand">{payload.brand.name}</p>

      <div className="gl-ring-wrap" style={{ flexDirection: 'column' }}>
        <VerdictRing
          mean={o ?? 0}
          min={range?.min ?? 0}
          max={range?.max ?? 0}
          color={color}
          label={band ? VERDICT_LABEL[band] : 'No data'}
          available={o !== null}
        />
        {band && (
          <span className="gl-band-pill" style={{ background: color }}>
            {VERDICT_LABEL[band]}
          </span>
        )}
      </div>
      {range && range.max - range.min > 0.5 && (
        <p className="gl-ring-range">
          rater range <b>{Math.round(range.min)}–{Math.round(range.max)}</b>
        </p>
      )}
      {driver && (
        <p
          className="gl-foot"
          style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: 'var(--ink)' }}
        >
          <span className={driverMarkClass(band)}>
            {capitalize(AXIS_LABEL[driver.axis].toLowerCase())}
          </span>{' '}
          is{' '}
          <span
            className="gl-u-bold"
            style={{
              fontWeight: 700,
              textDecorationColor:
                driver.direction === 'lifts'
                  ? 'var(--verdict-excellent)'
                  : 'var(--verdict-poor)',
            }}
          >
            {driver.direction === 'lifts' ? 'carrying' : 'dragging'}
          </span>{' '}
          your composite.
        </p>
      )}

      {AXES.map((axis) => (
        <PillarRow
          key={axis}
          pillars={payload.pillars}
          axis={axis}
          flags={axis === 'ingredient_safety' ? payload.flags : []}
          onOpenFlag={onOpenFlag}
        />
      ))}
    </section>
  );
}

function PillarRow({
  pillars,
  axis,
  flags,
  onOpenFlag,
}: {
  pillars: Pillars;
  axis: keyof Pillars;
  flags: IngredientFlag[];
  onOpenFlag: (slug: string) => void;
}) {
  const p = pillars[axis];
  const band = verdictBand(p.representative);
  const color = band ? VERDICT_VAR[band] : 'var(--ink-3)';
  const rep = p.representative;
  const spread = p.spread;
  const split = p.disagreement && spread;

  return (
    <div className="gl-pillar" style={{ color }}>
      <div className="gl-pillar-head">
        <span className="gl-pillar-label" style={{ color: 'var(--ink-2)' }}>
          {AXIS_LABEL[axis]}
          {split ? (
            <span className="gl-split-pill">
              Split
              <span className="gl-split-pill__arrow">·</span>
              {Math.round(spread.min)}
              <span className="gl-split-pill__arrow">→</span>
              {Math.round(spread.max)}
            </span>
          ) : p.ratings.length > 1 ? (
            <span className="gl-agree-pill">Raters agree</span>
          ) : null}
        </span>
        <span className={`gl-pillar-rep${rep === null ? ' gl-pillar-rep--none' : ''}`}>
          {rep === null ? '—' : Math.round(rep)}
        </span>
      </div>

      <div className="gl-pillar-track">
        <span className="gl-pillar-track-mid" aria-hidden />
        {split && (
          <span
            className="gl-pillar-spread"
            style={{ left: `${spread.min}%`, right: `${100 - spread.max}%` }}
            aria-hidden
          />
        )}
        {p.ratings.map((r) => {
          const rband = verdictBand(r.score);
          const rcolor = rband ? VERDICT_VAR[rband] : 'var(--ink-3)';
          return (
            <span
              key={r.sourceId}
              className="gl-pillar-dot"
              style={{ left: `${Math.max(0, Math.min(100, r.score))}%`, color: rcolor }}
              aria-label={`${r.sourceName} ${Math.round(r.score)}`}
            />
          );
        })}
        {p.ratings.length === 0 && rep !== null && (
          <span className="gl-pillar-fill" style={{ left: 0, width: `${rep}%` }} />
        )}
      </div>

      {p.ratings.length > 0 && (
        <ul className="gl-raters">
          {p.ratings.map((r) => (
            <li key={r.sourceId} className="gl-rater">
              <span style={{ color: 'var(--ink)' }}>
                <span className="gl-rater-name">{r.sourceName}</span>
                <span className="gl-rater-funding">{FUNDING_LABEL[r.fundingModel]}</span>
              </span>
              <span className="gl-rater-score">{Math.round(r.score)}</span>
            </li>
          ))}
        </ul>
      )}

      {flags.length > 0 && (
        <div className="gl-flagchips">
          <p className="gl-flagchips-label">Specifically</p>
          {flags.map((f) => (
            <button
              key={f.slug}
              type="button"
              className="gl-flagchip"
              onClick={() => onOpenFlag(f.slug)}
              aria-label={`Open per-rater detail for ${f.name}`}
            >
              <span className="gl-flagchip-name">{f.name}</span>
              <span className="gl-flagchip-meta">{flagSplitLabel(f)}</span>
              <span className="gl-flagchip-chev" aria-hidden>›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A one-word summary of what the raters did on this ingredient. */
function flagSplitLabel(f: IngredientFlag): string {
  const stances = new Set(f.positions.map((p) => p.stance));
  if (stances.size <= 1) return 'Raters agree';
  if (stances.has('concern')) return 'Raters split (concern)';
  return 'Raters split';
}

// ─── flag detail screen ────────────────────────────────────────────────────
// The thesis screen. One ingredient, every rater's stance, every funding
// model, every reasoning sentence. Never blended.

function FlagDetailScreen({ flag, onBack }: { flag: IngredientFlag; onBack: () => void }) {
  const summary = summarizeStances(flag);

  return (
    <main>
      <header className="gl-flag-head">
        <button
          type="button"
          className="gl-flag-back"
          onClick={onBack}
          aria-label="Back to verdict"
        >
          <span aria-hidden>‹</span> Back
        </button>
        <p className="gl-eyebrow">Ingredient flag</p>
        <h2 className="gl-flag-name">{flag.name}</h2>
        {summary && (
          <span
            className={`gl-flag-summary ${
              summary.kind === 'split' ? 'gl-flag-summary--split' : 'gl-flag-summary--agree'
            }`}
          >
            <span className="gl-flag-summary__dot" aria-hidden />
            {summary.label}
          </span>
        )}
      </header>

      <section className="gl-section">
        <p className="gl-flag-explanation">{flag.explanation}</p>
      </section>

      <section className="gl-section">
        <p className="gl-eyebrow">Where each rater lands</p>
        <ul className="gl-rater-positions">
          {flag.positions.map((p) => (
            <li key={p.sourceId} className="gl-rater-position" data-stance={p.stance}>
              <header className="gl-rater-position-head">
                <span className="gl-rater-position-stance" data-stance={p.stance}>
                  {STANCE_LABEL[p.stance]}
                </span>
                <span className="gl-rater-position-funding">
                  {FUNDING_LABEL[p.fundingModel]}
                </span>
              </header>
              <p className="gl-rater-position-source">{p.sourceName}</p>
              <p className="gl-rater-position-reasoning">{p.reasoning}</p>
            </li>
          ))}
        </ul>
      </section>

      {flag.notes.length > 0 && (
        <section className="gl-section">
          <p className="gl-eyebrow">Other notes</p>
          <ul className="gl-notes">
            {flag.notes.map((n, i) => (
              <li key={i} className="gl-note">
                <span
                  className="gl-note-dot"
                  style={{ background: VERDICT_VAR[n.band] }}
                  aria-hidden
                />
                <span>{n.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

/** Roll the per-rater stances into one short banner. Split if more than one
 *  distinct stance is present; agree if not. The label names the count so
 *  the user reads it at a glance instead of decoding three cards first. */
function summarizeStances(flag: IngredientFlag): { kind: 'split' | 'agree'; label: string } | null {
  if (flag.positions.length === 0) return null;
  const counts: Partial<Record<IngredientStance, number>> = {};
  for (const p of flag.positions) {
    counts[p.stance] = (counts[p.stance] ?? 0) + 1;
  }
  const entries = Object.entries(counts) as Array<[IngredientStance, number]>;
  if (entries.length === 1) {
    const [stance, count] = entries[0]!;
    return {
      kind: 'agree',
      label: `All ${count} agree · ${STANCE_LABEL[stance].toLowerCase()}`,
    };
  }
  // Order: concern, caution, safe, unknown (loudest first so the chip leads
  // with the most-cautious stance the reader needs to see).
  const order: IngredientStance[] = ['concern', 'caution', 'safe', 'unknown'];
  const parts = order
    .filter((s) => counts[s])
    .map((s) => `${counts[s]} ${STANCE_LABEL[s].toLowerCase()}`);
  return { kind: 'split', label: `Raters split · ${parts.join(' · ')}` };
}

const STANCE_LABEL: Record<IngredientStance, string> = {
  concern: 'Concern',
  caution: 'Caution',
  safe: 'Safe',
  unknown: 'Unknown',
};

// ─── verdict ring (popup-scaled, simpler than ScoreRing) ───────────────────

interface RingProps {
  mean: number;
  min: number;
  max: number;
  color: string;
  label: string;
  available: boolean;
}

function VerdictRing({ mean, min, max, color, label, available }: RingProps) {
  const size = 140;
  const thickness = 10;
  const r = (size - thickness) / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const SWEEP = 270;
  const arcLen = circ * (SWEEP / 360);
  const gap = circ - arcLen;
  const baseRot = 135;

  const dashMean = arcLen * (mean / 100);
  const bandStart = arcLen * (min / 100);
  const bandLen = Math.max(0, arcLen * ((max - min) / 100));

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`Verdict ${label}`}>
      <g transform={`rotate(${baseRot} ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--card-2)" strokeWidth={thickness} strokeLinecap="round" strokeDasharray={`${arcLen} ${gap}`} />
        {available && bandLen > 0.5 && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeOpacity={0.25} strokeWidth={thickness} strokeLinecap="round" strokeDasharray={`0 ${bandStart} ${bandLen} ${circ}`} />
        )}
        {available && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round" strokeDasharray={`${dashMean} ${circ}`} />
        )}
      </g>
      <text x={cx} y={cy - 2} textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontWeight={600} fontSize={size * 0.32} fill="var(--ink)" style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em' }}>
        {available ? Math.round(mean) : '—'}
      </text>
      <text x={cx} y={cy + 22} textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontSize={13} fontStyle="italic" fill={color}>
        {label}
      </text>
    </svg>
  );
}

// ─── empty states ──────────────────────────────────────────────────────────

function IdleBlock() {
  return (
    <section className="gl-section gl-blank">
      <Sonion mood="neutral" size={56} idle />
      <p className="gl-blank-title">Open a cosmetic product on Amazon</p>
      <p className="gl-blank-body">
        I show every rating source side-by-side once you land on a product page.
        In the meantime, your weighting is yours to set.
      </p>
    </section>
  );
}

function UnknownBlock({ rawName }: { rawName: string }) {
  return (
    <section className="gl-section gl-blank">
      <Sonion mood="neutral" size={56} idle />
      <p className="gl-blank-title">Not in catalog yet</p>
      <p className="gl-blank-body" style={{ fontSize: 12.5 }}>
        <span style={{ color: 'var(--ink)' }}>{rawName}</span>
      </p>
      <p className="gl-blank-body">
        Recall on the tail is genuinely worse — we&apos;d rather say so than fake a number.
      </p>
    </section>
  );
}

// ─── helpers ───────────────────────────────────────────────────────────────

function headerMood(pillars: Pillars | undefined, weights: Weights): SonionMood {
  if (!pillars) return 'neutral';
  const o = overall(pillars, weights);
  if (o === null) return 'neutral';
  if (o >= 70) return 'happy';
  if (o >= 55) return 'neutral';
  return 'concerned';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Pick a highlighter color keyed to the composite verdict band. */
function driverMarkClass(band: ReturnType<typeof verdictBand>): string {
  switch (band) {
    case 'excellent':
    case 'good':
      return 'gl-mark-leaf';
    case 'fair':
      return 'gl-mark-amber';
    case 'poor':
      return 'gl-mark-clay';
    case 'bad':
      return 'gl-mark-rose';
    default:
      return 'gl-mark-sand';
  }
}
