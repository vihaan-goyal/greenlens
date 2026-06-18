// Live resolve endpoint for the browser extension.
//
// The extension service worker can't run Prisma in the browser, so it POSTs a
// product sighting here; this route runs the same /lib/matcher pipeline against
// the *full* Prisma catalog (thousands of ingested products, not the 17-item
// mock the extension bundles) and returns the verdict for the matched product.
//
// Always hits prismaRepository directly — the whole point is the full DB — so it
// works regardless of GREENLENS_REPO. Needs the Node runtime (Prisma) and must
// never be statically cached (the catalog grows as you ingest).

import { NextResponse } from 'next/server';
import { prismaRepository } from '@/lib/data/prisma-repository';
import { resolveItem } from '@/lib/matcher/matcher';
import type { MatchableItem } from '@/lib/matcher/features';
import type { VerdictPayload } from '@/extension/shared/messages';

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
}

const asString = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

export async function POST(req: Request) {
  let body: SightingBody;
  try {
    body = (await req.json()) as SightingBody;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400, headers: CORS });
  }

  const name = asString(body.name);
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
    brand: asString(body.brand),
    name,
    gtin: asString(body.gtin),
    ingredients: ingredients && ingredients.length ? ingredients : undefined,
  };

  const { catalog, brands } = await prismaRepository.loadMatchContext();
  const match = resolveItem(item, catalog, brands);
  if (!match) return NextResponse.json({ match: null }, { headers: CORS });

  const view = await prismaRepository.getProduct(match.productId);
  if (!view) return NextResponse.json({ match: null }, { headers: CORS });
  const flags = await prismaRepository.listIngredientFlags(match.productId);

  const payload: VerdictPayload = {
    product: view.product,
    brand: view.brand,
    pillars: view.pillars,
    sources: view.sources,
    flags,
    matchConfidence: match.confidence,
  };
  return NextResponse.json({ match: payload }, { headers: CORS });
}
