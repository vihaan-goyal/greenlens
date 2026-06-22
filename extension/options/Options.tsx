import { useEffect, useRef, useState } from 'react';
import { AXES, AXIS_LABEL, FUNDING_LABEL, type FundingModel, type Weights } from '@/lib/domain/types';
import { defaultWeights } from '@/lib/domain/scoring';
import { API_BASE_KEY, DEFAULT_API_BASE, normalizeApiBase } from '../shared/api';

const WEIGHTS_KEY = 'greenlens.weights';

/**
 * Full options page (opens in a tab). Three sections:
 *   1. Your weighting — the per-axis weights, shared via chrome.storage with
 *      the popup and content card. Computed into a composite at read time,
 *      never persisted as a single blended number (CLAUDE.md's one rule).
 *   2. API endpoint — which Greenlens server resolves sightings. The service
 *      worker already reads this key; this is the only UI that writes it.
 *   3. About the raters — what each funding model means, so the reader can
 *      weigh who pays for an opinion.
 */
export function Options() {
  const [weights, setWeights] = useState<Weights>(defaultWeights);
  const [apiBase, setApiBase] = useState('');
  const [savedApiBase, setSavedApiBase] = useState<string | null>(null);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted settings.
  useEffect(() => {
    chrome.storage.local.get([WEIGHTS_KEY, API_BASE_KEY], (s) => {
      const w = s[WEIGHTS_KEY] as Partial<Weights> | undefined;
      if (w) setWeights({ ...defaultWeights(), ...w });
      const base = s[API_BASE_KEY] as string | undefined;
      if (base) setApiBase(base);
    });
    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
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

  // Save the API base on blur (not per keystroke) so trailing-slash trimming
  // doesn't fight the user mid-type. The SW normalizes again at read time, so
  // a stale slash never breaks resolution either way.
  const saveApiBase = () => {
    const normalized = normalizeApiBase(apiBase);
    setApiBase(normalized);
    chrome.storage.local.set({ [API_BASE_KEY]: normalized }, () => {
      setSavedApiBase(normalized);
      window.setTimeout(() => setSavedApiBase(null), 1800);
    });
  };

  return (
    <main className="gl-opt">
      <header className="gl-opt-head">
        <h1 className="gl-opt-wordmark">Greenlens</h1>
        <p className="gl-opt-tag">Settings</p>
      </header>

      <section className="gl-opt-section">
        <h2 className="gl-opt-h2">Your weighting</h2>
        <p className="gl-opt-lead">
          How much each axis counts toward your composite. Shared everywhere —
          the popup, the in-page card, and here. Set to zero to ignore an axis.
        </p>
        {AXES.map((axis) => (
          <label key={axis} className="gl-opt-weight">
            <span className="gl-opt-weight-head">
              <span>{AXIS_LABEL[axis]}</span>
              <span className="gl-opt-weight-value">{weights[axis].toFixed(1)}</span>
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
        <p className="gl-opt-foot">
          The composite is computed from these weights at read time — never
          stored, never blended behind your back.
        </p>
      </section>

      <section className="gl-opt-section">
        <h2 className="gl-opt-h2">API endpoint</h2>
        <p className="gl-opt-lead">
          Where the extension resolves products against the full catalog. Point
          this at your running Greenlens server. Leave blank for the local dev
          default.
        </p>
        <div className="gl-opt-field">
          <input
            type="url"
            className="gl-opt-input"
            placeholder={DEFAULT_API_BASE}
            value={apiBase}
            onChange={(e) => setApiBase(e.target.value)}
            onBlur={saveApiBase}
            aria-label="Greenlens API base URL"
          />
          {savedApiBase && <span className="gl-opt-saved" role="status">Saved</span>}
        </div>
      </section>

      <section className="gl-opt-section">
        <h2 className="gl-opt-h2">About the raters</h2>
        <p className="gl-opt-lead">
          Every rating shows who funds the source, because that shapes the
          opinion. Greenlens never averages conflicting opinions on the same
          axis — it shows the spread and names who disagrees.
        </p>
        <ul className="gl-opt-funding">
          {(Object.keys(FUNDING_LABEL) as FundingModel[]).map((model) => (
            <li key={model} className="gl-opt-funding-row">
              <span className="gl-opt-funding-tag" data-model={model}>
                {FUNDING_LABEL[model]}
              </span>
              <span className="gl-opt-funding-desc">{FUNDING_DESC[model]}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

const FUNDING_DESC: Record<FundingModel, string> = {
  nonprofit: 'Funded by donations or grants — no product sales to answer to.',
  independent: 'Self-funded or reader-funded; not selling the products it rates.',
  ad_supported: 'Paid by advertising — weigh ratings against who buys the ads.',
  subscription: 'Paid by member subscriptions rather than the brands rated.',
};
