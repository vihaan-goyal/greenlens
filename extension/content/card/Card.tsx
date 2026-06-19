import { useMemo } from 'react';
import type { VerdictPayload } from '../../shared/messages';
import { overall, overallRange, topMarginalDriver } from '@/lib/domain/scoring';
import { VERDICT_LABEL, VERDICT_VAR, verdictBand } from '@/lib/domain/verdict';
import { AXIS_PHRASE, type Weights } from '@/lib/domain/types';
import { Sonion, type SonionMood } from '@/components/Sonion';
import { Floater } from './Floater';
import { usePanel } from './usePanel';
import { productUrl } from '../../shared/config';

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
  const { open, toggle, close, ref: cardRef, cardClass } = usePanel();
  const range = useMemo(() => overallRange(payload.pillars, weights), [payload, weights]);
  const o = useMemo(() => overall(payload.pillars, weights), [payload, weights]);
  const band = verdictBand(o);
  const mood: SonionMood = o === null || o < 55 ? 'concerned' : o < 70 ? 'neutral' : 'happy';
  const driver = useMemo(() => topMarginalDriver(payload.pillars, weights), [payload, weights]);

  const verdictLine = band ? VERDICT_LABEL[band] : 'No data';
  const color = band ? VERDICT_VAR[band] : 'var(--ink-3)';
  const markClass = MARK_BY_BAND[band ?? 'sand'];

  return (
    <Floater onDragStart={close} dragDisabled={open}>
    <div ref={cardRef} className={cardClass} data-band={band ?? 'none'}>
      <button
        type="button"
        className="gl-trigger"
        aria-label={`Greenlens verdict: ${verdictLine} (${o === null ? 'no data' : Math.round(o)} out of 100)`}
        onClick={toggle}
      >
        <Sonion mood={mood} size={60} idle={!open} />
        <span className="gl-trigger-text">
          <span className="gl-trigger-score" style={{ color }}>
            {o === null ? '—' : Math.round(o)}
          </span>
          <span className="gl-trigger-band" data-band={band ?? 'none'}>
            {verdictLine}
          </span>
        </span>
      </button>

      {open && (
        <div className="gl-panel" role="dialog" aria-label="Greenlens verdict details">
          <header className="gl-panel-head">
            <p className="gl-eyebrow">For your weighting</p>
            <h2 className="gl-title">{payload.product.displayName}</h2>
            <p className="gl-brand">{payload.brand.name}</p>
            {payload.ambiguous && (
              <p className="gl-ambiguous">
                Closest match — a similar product scored almost as well, so this may
                not be the exact item.
              </p>
            )}
          </header>
          <p className="gl-sonion-line">
            {driver && o !== null ? (
              <>
                Your weighting is{' '}
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
                  {driver.direction === 'lifts' ? 'carried' : 'dragged'}
                </span>{' '}
                by <span className={markClass}>{AXIS_PHRASE[driver.axis]}</span>.
              </>
            ) : (
              'Tap to see who rates this and how.'
            )}
          </p>
          {range && range.max - range.min > 0.5 && (
            <p className="gl-range">
              Rater range{' '}
              <span className="gl-range-num">
                {Math.round(range.min)}–{Math.round(range.max)}
              </span>
            </p>
          )}
          <div className="gl-pillars">
            {Object.values(payload.pillars).map((p) => (
              <span key={p.axis} className="gl-pillar">
                <span className="gl-pillar-label">{AXIS_PHRASE[p.axis]}</span>
                <span className="gl-pillar-num">
                  {p.representative === null ? '—' : Math.round(p.representative)}
                </span>
                {p.disagreement && p.spread ? (
                  <span className="gl-split-chip">
                    Split
                    <span className="gl-split-chip__arrow">·</span>
                    {Math.round(p.spread.min)}
                    <span className="gl-split-chip__arrow">→</span>
                    {Math.round(p.spread.max)}
                  </span>
                ) : (
                  <span className="gl-pillar-spacer" />
                )}
              </span>
            ))}
          </div>
          <a
            className="gl-report-link"
            href={productUrl(payload.product.id)}
            target="_blank"
            rel="noreferrer noopener"
          >
            See the full breakdown <span aria-hidden>↗</span>
          </a>
          <p className="gl-foot">
            Opens the full Greenlens report — dial, weight controls, and rater-by-rater detail.
          </p>
        </div>
      )}
    </div>
    </Floater>
  );
}

const MARK_BY_BAND: Record<string, string> = {
  excellent: 'gl-mark-leaf',
  good: 'gl-mark-leaf',
  fair: 'gl-mark-amber',
  poor: 'gl-mark-clay',
  bad: 'gl-mark-rose',
  sand: 'gl-mark-sand',
};
