/**
 * Content script injected on the Greenlens web app. Bridges the web app's
 * localStorage weights into chrome.storage.local so the extension card and
 * popup show the same composite the user tuned before clicking an Amazon link.
 *
 * Two sync paths:
 *   1. On load  — copies whatever weights are already in localStorage.
 *   2. Live     — listens for window.postMessage('gl:weightsChanged') fired
 *                 by lib/store.ts on every setWeight/reset call.
 */

const WEIGHTS_KEY = 'greenlens.weights';

function sync(weights: unknown) {
  if (weights && typeof weights === 'object') {
    chrome.storage.local.set({ [WEIGHTS_KEY]: weights });
  }
}

// Path 1: sync whatever is already stored.
try {
  const raw = localStorage.getItem(WEIGHTS_KEY);
  if (raw) sync(JSON.parse(raw));
} catch {}

// Path 2: sync on live weight changes from the web app.
window.addEventListener('message', (e) => {
  if (e.origin !== window.location.origin) return;
  const msg = e.data as { kind?: string; weights?: unknown } | null;
  if (msg?.kind === 'gl:weightsChanged') sync(msg.weights);
});
