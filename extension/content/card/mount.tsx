import { createRoot, type Root } from 'react-dom/client';
import { Card } from './Card';
import { UnknownCard } from './UnknownCard';
import { IdleCard } from './IdleCard';
import type { ContentState, VerdictPayload } from '../../shared/messages';
import type { Weights } from '@/lib/domain/types';
import { defaultWeights } from '@/lib/domain/scoring';
import tokensCss from '@/styles/tokens.css?inline';
import cardCss from './card.css?inline';

/**
 * Shadow-DOM mount for the in-page card. We use shadow DOM so Amazon's
 * stylesheet can't reach our tokens — that's non-negotiable, otherwise the
 * design dies the first time a site ships a `* { color: black }` rule.
 *
 * State held module-scope: the card is a singleton per page.
 */

const HOST_ID = 'greenlens-host';

type CardState =
  | { kind: 'verdict'; payload: VerdictPayload; weights: Weights }
  | { kind: 'unknown'; rawName: string }
  | { kind: 'idle' };

let host: HTMLDivElement | null = null;
let root: Root | null = null;
let state: CardState | null = null;

function ensureHost(): { shadow: ShadowRoot; mountPoint: HTMLElement } {
  if (host && root) {
    const shadow = host.shadowRoot!;
    const mp = shadow.getElementById('greenlens-root') as HTMLElement;
    return { shadow, mountPoint: mp };
  }
  host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText =
    'all: initial; display: block; position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;';
  const shadow = host.attachShadow({ mode: 'open' });

  const tokensStyle = document.createElement('style');
  // `:root` inside a shadow tree refers to the *document* root, not the
  // shadow host — so CSS custom properties defined under `:root` never
  // reach our shadow-root contents. Rewriting to `:host` puts them on the
  // shadow host where they can cascade to everything in the card.
  tokensStyle.textContent = tokensCss.replace(/:root\b/g, ':host');
  const cardStyle = document.createElement('style');
  cardStyle.textContent = cardCss;
  shadow.append(tokensStyle, cardStyle);

  const mountPoint = document.createElement('div');
  mountPoint.id = 'greenlens-root';
  shadow.append(mountPoint);

  document.documentElement.append(host);
  root = createRoot(mountPoint);
  return { shadow, mountPoint };
}

function render() {
  if (!state || !root) return;
  switch (state.kind) {
    case 'verdict':
      root.render(<Card payload={state.payload} weights={state.weights} />);
      return;
    case 'unknown':
      root.render(<UnknownCard rawName={state.rawName} />);
      return;
    case 'idle':
      root.render(<IdleCard />);
      return;
  }
}

export function mountCard(payload: VerdictPayload) {
  ensureHost();
  const weights =
    state && state.kind === 'verdict' ? state.weights : defaultWeights();
  state = { kind: 'verdict', payload, weights };
  render();
}

export function mountUnknown(rawName: string) {
  ensureHost();
  state = { kind: 'unknown', rawName };
  render();
}

export function mountIdle() {
  ensureHost();
  // No-op if we're already idle so we don't thrash the React root on every
  // SPA-style URL change while the user browses non-product pages.
  if (state?.kind === 'idle') return;
  state = { kind: 'idle' };
  render();
}

/**
 * Idempotent: mount idle if and only if nothing is shown yet. Used while
 * resolving a sighting so the previous card stays visible until the new one
 * is ready — prevents a verdict→idle→verdict flicker on SPA nav between
 * product pages.
 */
export function ensureIdle() {
  ensureHost();
  if (state !== null) return;
  state = { kind: 'idle' };
  render();
}

/** Re-render with new weights. Ignored when the current state isn't a verdict. */
export function updateCard(patch: { weights?: Weights }) {
  if (!state || state.kind !== 'verdict' || !patch.weights) return;
  state = { ...state, weights: patch.weights };
  render();
}

/**
 * Snapshot the current visible state for the popup. Strips the locally-held
 * weights out of the verdict state — those live in chrome.storage.local and
 * the popup reads them from there directly.
 */
export function getContentState(): ContentState {
  if (!state) return { kind: 'idle' };
  if (state.kind === 'verdict') return { kind: 'verdict', payload: state.payload };
  if (state.kind === 'unknown') return { kind: 'unknown', rawName: state.rawName };
  return { kind: 'idle' };
}

export function unmountCard() {
  if (!host) return;
  root?.unmount();
  host.remove();
  host = null;
  root = null;
  state = null;
}
