import type { BgToContent, ContentToBg, VerdictPayload } from '../shared/messages';
import type { RawProductSighting } from '../shared/sighting';
import { classifyCosmetic } from './classifier';
import { mockRepository } from '@/lib/data/mock-repository';
import { defaultWeights } from '@/lib/domain/scoring';
import type { Brand, Weights } from '@/lib/domain/types';
import type { ProductView } from '@/lib/data/repository';
import { resolveItem, type CatalogEntry } from '@/lib/matcher/matcher';
import type { MatchableItem } from '@/lib/matcher/features';

console.log('[greenlens/sw] build', __GL_BUILD__);

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

// ─── catalog resolution ──────────────────────────────────────────────────────
// Two paths, in priority order:
//   1. The live resolve API (the running Next app) — matches against the FULL
//      Prisma catalog of thousands of ingested products, returning a definitive
//      match-or-null. This is the source of truth when the server is up.
//   2. The bundled seed (mock-repository) — a 17-product offline fallback used
//      only when the API is unreachable, so Sonion still works on the curated
//      demo brands with no server running.

const DEFAULT_API_BASE = 'http://localhost:3000';
const API_BASE_KEY = 'greenlens.apiBase';

async function resolveApiUrl(): Promise<string> {
  const stored = await chrome.storage.local.get([API_BASE_KEY]);
  const base = (stored[API_BASE_KEY] as string | undefined)?.trim() || DEFAULT_API_BASE;
  return `${base.replace(/\/+$/, '')}/api/resolve`;
}

/**
 * Ask the live API to resolve a sighting against the full catalog. Returns the
 * VerdictPayload on a match, `null` on a definitive no-match, or `undefined`
 * when the server is unreachable / errored — the caller treats `undefined` as
 * "fall back to the bundled seed", but a real `null` as "genuinely not rated".
 */
async function resolveViaApi(
  s: RawProductSighting,
): Promise<VerdictPayload | null | undefined> {
  try {
    const res = await fetch(await resolveApiUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        brand: s.rawBrand,
        name: s.rawName,
        gtin: s.rawGtin,
        ingredients: s.rawIngredients,
      }),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { match: VerdictPayload | null };
    return data.match;
  } catch {
    // Server down / not running — let the caller fall back to the bundled seed.
    return undefined;
  }
}

/**
 * Resolve a sighting: try the live full-catalog API first, fall back to the
 * bundled seed only when the server is unreachable.
 */
async function resolveSighting(s: RawProductSighting): Promise<VerdictPayload | null> {
  const viaApi = await resolveViaApi(s);
  if (viaApi !== undefined) return viaApi;
  return resolveViaMock(s);
}

/**
 * Offline fallback: resolve against the bundled 17-product seed using the real
 * /lib/matcher pipeline (blocking → features → score), threshold-gated so a
 * low-confidence guess returns null and the UI shows "Not yet rated" instead of
 * inventing a match.
 */
async function resolveViaMock(s: RawProductSighting): Promise<VerdictPayload | null> {
  const views = await mockRepository.listProducts();
  const brands = collectBrands(views);
  const catalog = views.map(viewToCatalog);
  const item = sightingToMatchable(s);

  const match = resolveItem(item, catalog, brands);
  if (!match) return null;
  const view = views.find((v) => v.product.id === match.productId);
  if (!view) return null;
  // Flags are fetched eagerly so the popup never has to do a follow-up round
  // trip — they're small per-product, and we want the flag chips to render
  // the moment the verdict screen appears.
  const flags = await mockRepository.listIngredientFlags(view.product.id);
  return {
    product: view.product,
    brand: view.brand,
    pillars: view.pillars,
    sources: view.sources,
    flags,
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
