import { useMemo } from 'react';
import type { VerdictPayload } from '../../shared/messages';
import { overall, overallRange, topMarginalDriver } from '@/lib/domain/scoring';
import { VERDICT_LABEL, VERDICT_VAR, verdictBand } from '@/lib/domain/verdict';
import { AXIS_PHRASE, type Weights } from '@/lib/domain/types';
import type { AlternativeView } from '@/lib/data/repository';
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
          {payload.topAlternative && (
            <CleanerOption alt={payload.topAlternative} weights={weights} />
          )}
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

/**
 * The Phia-shaped move: surface the single safest cleaner alternative right in
 * the shopping flow, not behind a click-through. Ranked by ingredient_safety
 * upstream (never payout), so its presence already means it's genuinely safer.
 * We still name the tradeoff — honesty over a one-sided pitch.
 */
function CleanerOption({ alt, weights }: { alt: AlternativeView; weights: Weights }) {
  const o = overall(alt.view.pillars, weights);
  const band = verdictBand(o);
  const color = band ? VERDICT_VAR[band] : 'var(--ink-3)';
  const safer = alt.cleaner.find((c) => c.axis === 'ingredient_safety') ?? alt.cleaner[0];
  // The biggest thing it gives up, if any — stated plainly, not buried.
  const tradeoff = [...alt.tradeoffs].sort((a, b) => a.delta - b.delta)[0];

  return (
    <a
      className="gl-alt"
      href={productUrl(alt.view.product.id)}
      target="_blank"
      rel="noreferrer noopener"
    >
      <span className="gl-alt-eyebrow">Cleaner option</span>
      <span className="gl-alt-row">
        <span className="gl-alt-name">
          {alt.view.brand.name} {alt.view.product.displayName}
        </span>
        <span className="gl-alt-score" style={{ color }}>
          {o === null ? '—' : Math.round(o)}
        </span>
      </span>
      {safer && (
        <span className="gl-alt-note">
          Safer on {AXIS_PHRASE[safer.axis]} (+{Math.round(safer.delta)})
          {tradeoff && (
            <> · trades off {AXIS_PHRASE[tradeoff.axis]} ({Math.round(tradeoff.delta)})</>
          )}
        </span>
      )}
    </a>
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
