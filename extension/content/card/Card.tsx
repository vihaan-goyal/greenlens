import { useMemo, useState } from 'react';
import type { VerdictPayload } from '../../shared/messages';
import { overall, overallRange, topMarginalDriver } from '@/lib/domain/scoring';
import { VERDICT_LABEL, VERDICT_VAR, verdictBand } from '@/lib/domain/verdict';
import { AXIS_PHRASE, type Weights } from '@/lib/domain/types';
import { Sonion, type SonionMood } from '@/components/Sonion';

interface Props {
  payload: VerdictPayload;
  weights: Weights;
}

/**
 * The in-page card. Visually compact — most of the dial / pillar / rater UX
 * lives in the popup; here we're trying to land one sentence and one number
 * without hijacking the page.
 *
 * Composite is computed at render time from `payload.pillars` + `weights`.
 * We never persist or transmit the blended number.
 */
export function Card({ payload, weights }: Props) {
  const [open, setOpen] = useState(false);
  const range = useMemo(() => overallRange(payload.pillars, weights), [payload, weights]);
  const o = useMemo(() => overall(payload.pillars, weights), [payload, weights]);
  const band = verdictBand(o);
  const mood: SonionMood = o === null || o < 55 ? 'concerned' : o < 70 ? 'neutral' : 'happy';
  const driver = useMemo(() => topMarginalDriver(payload.pillars, weights), [payload, weights]);

  const verdictLine = band ? VERDICT_LABEL[band] : 'No data';
  const color = band ? VERDICT_VAR[band] : 'var(--ink-3)';
  const sonionLine =
    driver && o !== null
      ? `${driver.direction === 'lifts' ? 'Your weighting is carried by' : 'Your weighting is dragged by'} ${AXIS_PHRASE[driver.axis]}.`
      : 'Tap to see who rates this and how.';

  return (
    <div className="gl-card" data-band={band ?? 'none'}>
      <button
        type="button"
        className="gl-trigger"
        aria-label={`Greenlens verdict: ${verdictLine} (${o === null ? 'no data' : Math.round(o)} out of 100)`}
        onClick={() => setOpen((v) => !v)}
      >
        <Sonion mood={mood} size={48} idle={!open} />
        <span className="gl-trigger-text">
          <span className="gl-trigger-score" style={{ color }}>
            {o === null ? '—' : Math.round(o)}
          </span>
          <span className="gl-trigger-band">{verdictLine}</span>
        </span>
      </button>

      {open && (
        <div className="gl-panel" role="dialog" aria-label="Greenlens verdict details">
          <header className="gl-panel-head">
            <p className="gl-eyebrow">For your weighting</p>
            <h2 className="gl-title">{payload.product.displayName}</h2>
            <p className="gl-brand">{payload.brand.name}</p>
          </header>
          <p className="gl-sonion-line">{sonionLine}</p>
          {range && range.max - range.min > 0.5 && (
            <p className="gl-range">
              Rater range <span className="gl-range-num">{Math.round(range.min)}–{Math.round(range.max)}</span>
            </p>
          )}
          <p className="gl-pillars">
            {Object.values(payload.pillars).map((p) => (
              <span key={p.axis} className="gl-pillar">
                <span className="gl-pillar-label">{AXIS_PHRASE[p.axis]}</span>
                <span className="gl-pillar-num">
                  {p.representative === null ? '—' : Math.round(p.representative)}
                </span>
                {p.disagreement && <span className="gl-disagree" title="Raters disagree" />}
              </span>
            ))}
          </p>
          <p className="gl-foot">
            Open the toolbar icon for full pillar controls and rater-by-rater detail.
          </p>
        </div>
      )}
    </div>
  );
}
