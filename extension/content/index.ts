import { pickAdapter } from './adapters';
import { sendToBackground } from '../shared/messages';
import type { BgToContent, PopupToContent } from '../shared/messages';
import { getContentState, mountCard, mountIdle, mountUnknown, updateCard } from './card/mount';

/**
 * Content-script entry. Runs in the page world at document_idle. Responsibilities:
 *   1. Pick an adapter for the current URL.
 *   2. Extract a sighting.
 *   3. Ask the SW for a verdict.
 *   4. Mount the shadow-DOM card with whatever came back.
 *
 * Amazon (and FB Marketplace) are SPA-ish: navigation often happens without a
 * full reload. We listen for history changes and re-run.
 */

async function run(url: string) {
  // Always have Sonion on screen between meaningful states. The card upgrades
  // to a verdict/unknown panel the moment we land on a product page; while
  // the user browses search results or a category page he sits quietly in
  // the corner so they know the extension is alive.
  mountIdle();

  const adapter = pickAdapter(url);
  if (!adapter) {
    console.debug('[greenlens] no adapter for', url);
    return;
  }
  const sighting = adapter.extract(document, url);
  if (!sighting) {
    console.debug('[greenlens] adapter found no product on', url);
    return;
  }
  console.debug('[greenlens] sighting', sighting);
  const reply = await sendToBackground({ kind: 'sighting', sighting });
  handleReply(reply, sighting.rawName);
}

function handleReply(reply: BgToContent, rawName = '') {
  switch (reply.kind) {
    case 'notCosmetic':
      // Real product page, but not cosmetics — fall back to idle. Sonion stays
      // visible so the user can adjust their weighting from the popup.
      mountIdle();
      return;
    case 'noMatch':
      mountUnknown(reply.rawName || rawName);
      return;
    case 'verdict':
      mountCard(reply.payload);
      return;
    case 'weights':
      // Weight broadcast from SW — re-compute composite in-place.
      updateCard({ weights: reply.weights });
      return;
  }
}

// SPA nav: hook the history API + popstate so we re-run when the URL changes
// without a full reload.
const dispatchUrlChange = () => window.dispatchEvent(new Event('greenlens:urlchange'));
const origPush = history.pushState;
const origReplace = history.replaceState;
history.pushState = function (...args) {
  const r = origPush.apply(this, args as Parameters<typeof history.pushState>);
  dispatchUrlChange();
  return r;
};
history.replaceState = function (...args) {
  const r = origReplace.apply(this, args as Parameters<typeof history.replaceState>);
  dispatchUrlChange();
  return r;
};
window.addEventListener('popstate', dispatchUrlChange);
window.addEventListener('greenlens:urlchange', () => {
  void run(location.href);
});

// Listen for both SW broadcasts (BgToContent) and popup queries (PopupToContent).
chrome.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
  const msg = raw as BgToContent | PopupToContent;
  if (msg.kind === 'getCurrentState') {
    sendResponse(getContentState());
    return false; // synchronous reply
  }
  handleReply(msg as BgToContent);
  return false;
});

void run(location.href);
