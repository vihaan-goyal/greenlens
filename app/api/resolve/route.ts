// Live resolve endpoint for the browser extension.
//
// The extension service worker can't run Prisma in the browser, so it POSTs a
// product sighting here; this route runs the same /lib/matcher pipeline against
// the *full* Prisma catalog (thousands of ingested products, not the 17-item
// mock the extension bundles) and returns the verdict for the matched product.
//
// Reads through the shared `repository` accessor — the SAME catalog the UI
// renders — so a match here always resolves to a product the "see full
// breakdown" page can load. The accessor now defaults to the full ingested
// Prisma catalog (set GREENLENS_REPO=mock to match against the 17-product seed
// instead). Needs the Node runtime (Prisma) and must never be statically cached
// (the catalog grows as you ingest).

import { NextResponse } from 'next/server';
import { repository } from '@/lib/data';
import { resolveItem } from '@/lib/matcher/matcher';
import type { MatchableItem } from '@/lib/matcher/features';
import type { VerdictPayload } from '@/extension/shared/messages';
import { fetchPaapiItem } from '@/lib/amazon-paapi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The caller is a chrome-extension:// origin, so CORS is required. This is a
// local-dev convenience endpoint; `*` is fine — it returns only public rating
// data and reads nothing from the request but the product fields.
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

interface SightingBody {
  brand?: unknown;
  name?: unknown;
  gtin?: unknown;
  ingredients?: unknown;
  /** When the extension has a curated ASIN→product mapping, skip fuzzy matching. */
  directProductId?: unknown;
  /**
   * ASIN from the Amazon URL. When present and PA-API credentials are
   * configured, the server enriches the sighting with canonical PA-API data
   * (authoritative title, brand, GTIN) before running the fuzzy matcher.
   * This is more reliable than DOM-scraped names, which drift as Amazon
   * renames listings.
   */
  asin?: unknown;
}

const asString = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

// The match context (every product + brand in the matcher's shape) is the same
// for every sighting and is the expensive part — a full-catalog read that grows
// with ingestion. Cache it briefly so a burst of page views doesn't re-scan the
// whole table each time. The TTL keeps it fresh enough to pick up new ingests
// within a minute; the matched product itself is always read live (uncached).
type MatchContext = Awaited<ReturnType<typeof repository.loadMatchContext>>;
const CONTEXT_TTL_MS = 30_000;
let contextCache: { at: number; data: MatchContext } | null = null;

async function loadMatchContextCached(): Promise<MatchContext> {
  const now = Date.now();
  if (contextCache && now - contextCache.at < CONTEXT_TTL_MS) return contextCache.data;
  const data = await repository.loadMatchContext();
  contextCache = { at: now, data };
  return data;
}

export async function POST(req: Request) {
  let body: SightingBody;
  try {
    body = (await req.json()) as SightingBody;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400, headers: CORS });
  }

  // Fast path: extension sent a curated ASIN→product mapping — skip fuzzy matching.
  const directId = asString(body.directProductId);
  if (directId) {
    const view = await repository.getProduct(directId);
    if (view) {
      const flags = await repository.listIngredientFlags(directId);
      const alternatives = await repository.listAlternatives(directId);
      const payload: VerdictPayload = {
        product: view.product,
        brand: view.brand,
        pillars: view.pillars,
        sources: view.sources,
        flags,
        topAlternative: alternatives[0],
        matchConfidence: 1.0,
        ambiguous: false,
      };
      return NextResponse.json({ match: payload }, { headers: CORS });
    }
    // directProductId not found in catalog — fall through to PA-API / fuzzy match.
  }

  // PA-API enrichment: if the extension sent an ASIN and we have credentials,
  // fetch the canonical product data from Amazon. This gives us the authoritative
  // title, brand, and GTIN — much more reliable than DOM-scraped names for
  // fuzzy matching. Falls back to scraping-based fields on any failure.
  const asin = asString(body.asin);
  let scrapedName = asString(body.name);
  let scrapedBrand = asString(body.brand);
  let scrapedGtin = asString(body.gtin);

  if (asin) {
    const paapi = await fetchPaapiItem(asin);
    if (paapi) {
      // Prefer canonical PA-API data; fall back to scraped fields if absent.
      scrapedName = paapi.title || scrapedName;
      scrapedBrand = paapi.brand ?? scrapedBrand;
      scrapedGtin = paapi.gtin ?? scrapedGtin;
    }
  }

  const name = scrapedName;
  if (!name) {
    // No name → nothing to match on. Return a definitive "no match" (200) so the
    // extension shows "not yet rated" rather than treating it as a server error.
    return NextResponse.json({ match: null }, { headers: CORS });
  }

  const ingredients = Array.isArray(body.ingredients)
    ? body.ingredients.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : undefined;

  const item: MatchableItem = {
    id: 'sighting',
    brand: scrapedBrand,
    name,
    gtin: scrapedGtin,
    ingredients: ingredients && ingredients.length ? ingredients : undefined,
  };

  const { catalog, brands } = await loadMatchContextCached();
  const match = resolveItem(item, catalog, brands);
  if (!match) return NextResponse.json({ match: null }, { headers: CORS });

  const view = await repository.getProduct(match.productId);
  if (!view) return NextResponse.json({ match: null }, { headers: CORS });
  const flags = await repository.listIngredientFlags(match.productId);
  // Safest cleaner option in the same category, or none if this is already it.
  const alternatives = await repository.listAlternatives(match.productId);

  const payload: VerdictPayload = {
    product: view.product,
    brand: view.brand,
    pillars: view.pillars,
    sources: view.sources,
    flags,
    topAlternative: alternatives[0],
    matchConfidence: match.confidence,
    ambiguous: match.ambiguous,
  };
  return NextResponse.json({ match: payload }, { headers: CORS });
}
