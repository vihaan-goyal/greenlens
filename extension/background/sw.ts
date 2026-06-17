import type { BgToContent, ContentToBg, VerdictPayload } from '../shared/messages';
import type { RawProductSighting } from '../shared/sighting';
import { classifyCosmetic } from './classifier';
import { mockRepository } from '@/lib/data/mock-repository';
import { defaultWeights } from '@/lib/domain/scoring';
import type { Brand, Weights } from '@/lib/domain/types';
import type { ProductView } from '@/lib/data/repository';
import { resolveItem, type CatalogEntry } from '@/lib/matcher/matcher';
import type { MatchableItem } from '@/lib/matcher/features';

const WEIGHTS_KEY = 'greenlens.weights';

async function readWeights(): Promise<Weights> {
  const stored = await chrome.storage.local.get([WEIGHTS_KEY]);
  const v = stored[WEIGHTS_KEY] as Partial<Weights> | undefined;
  const d = defaultWeights();
  if (!v) return d;
  return { ...d, ...v };
}

/**
 * Project a sighting into the matcher's MatchableItem shape. Adapter output
 * is intentionally close to this already, so the projection is almost free.
 */
function sightingToMatchable(s: RawProductSighting): MatchableItem {
  return {
    id: 'sighting',
    brand: s.rawBrand,
    name: s.rawName,
    gtin: s.rawGtin,
    ingredients: s.rawIngredients.length ? s.rawIngredients : undefined,
  };
}

/**
 * Project a ProductView into the matcher's CatalogEntry shape. Brand name +
 * aliases come along so the matcher's brand canonicalization keeps working.
 */
function viewToCatalog(v: ProductView): CatalogEntry {
  return {
    productId: v.product.id,
    id: `cat-${v.product.id}`,
    brand: v.brand.name,
    name: v.product.displayName,
    gtin: v.product.gtin,
    ingredients: v.product.ingredients,
    sizeValue: v.product.sizeValue,
    sizeUnit: v.product.sizeUnit,
  };
}

/**
 * Live resolution against the canonical catalog. Replaces the token-overlap
 * stub with the real /lib/matcher pipeline (blocking → features → score),
 * threshold-gated so a low-confidence guess returns null and the UI shows
 * the "Not yet rated" state instead of inventing a match.
 */
async function resolveSighting(s: RawProductSighting): Promise<VerdictPayload | null> {
  const views = await mockRepository.listProducts();
  const brands = collectBrands(views);
  const catalog = views.map(viewToCatalog);
  const match = resolveItem(sightingToMatchable(s), catalog, brands);
  if (!match) return null;
  const view = views.find((v) => v.product.id === match.productId);
  if (!view) return null;
  return {
    product: view.product,
    brand: view.brand,
    pillars: view.pillars,
    sources: view.sources,
    matchConfidence: match.confidence,
  };
}

function collectBrands(views: ReadonlyArray<ProductView>): Brand[] {
  const map = new Map<string, Brand>();
  for (const v of views) map.set(v.brand.id, v.brand);
  return [...map.values()];
}

chrome.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
  const msg = raw as ContentToBg;
  (async () => {
    if (msg.kind === 'getWeights') {
      const reply: BgToContent = { kind: 'weights', weights: await readWeights() };
      sendResponse(reply);
      return;
    }
    if (msg.kind === 'sighting') {
      const classification = classifyCosmetic(msg.sighting);
      console.log('[greenlens/sw] sighting', {
        name: msg.sighting.rawName,
        brand: msg.sighting.rawBrand,
        category: msg.sighting.category,
        classification,
      });
      if (!classification.cosmetic) {
        sendResponse({ kind: 'notCosmetic' } satisfies BgToContent);
        return;
      }
      const payload = await resolveSighting(msg.sighting);
      if (!payload) {
        console.log('[greenlens/sw] cosmetic but no match', msg.sighting.rawName);
        sendResponse({ kind: 'noMatch', rawName: msg.sighting.rawName } satisfies BgToContent);
        return;
      }
      console.log('[greenlens/sw] matched', payload.product.displayName, 'conf', payload.matchConfidence.toFixed(2));
      sendResponse({ kind: 'verdict', payload } satisfies BgToContent);
      return;
    }
  })().catch((err) => {
    console.error('[greenlens/sw] handler failed', err);
    sendResponse({ kind: 'noMatch', rawName: '' } satisfies BgToContent);
  });
  // Returning true keeps the message channel open for the async sendResponse.
  return true;
});

// ─── weight broadcast ───────────────────────────────────────────────────────
// When the popup writes new weights, every open content script needs to
// re-render so the composite changes live. Computation stays on the content
// side (the SW never assembles a single blended number).

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local' || !changes[WEIGHTS_KEY]) return;
  const weights = await readWeights();
  const matched = await chrome.tabs.query({
    url: ['https://www.amazon.com/*', 'https://smile.amazon.com/*'],
  });
  for (const tab of matched) {
    if (tab.id === undefined) continue;
    chrome.tabs
      .sendMessage(tab.id, { kind: 'weights', weights } satisfies BgToContent)
      .catch(() => {
        // tabs without our content script will reject — ignore.
      });
  }
});
