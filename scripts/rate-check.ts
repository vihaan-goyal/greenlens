// Rate-check: would Sonion actually rate freshly-ingested products?
//
// Samples ingested (prod-obf-*) products that carry ratings, simulates an
// Amazon-style sighting for each (brand-prefixed, marketing-suffixed title), and
// runs the real /lib/matcher resolveItem against the full catalog — exactly what
// the extension does. Reports how many resolve to a rated product. Run after a
// batch of ingest + derive to confirm coverage is real, not just row counts.

import { prismaRepository } from '../lib/data/prisma-repository';
import { resolveItem, type CatalogEntry } from '../lib/matcher/matcher';
import type { MatchableItem } from '../lib/matcher/features';

const SAMPLE = 200;

async function main() {
  const { catalog, brands } = await prismaRepository.loadMatchContext();

  // Products with >=1 rating, attached via a ListingMatch.
  const matches = await prisma_findRated();
  const rated = matches.filter((m) => m.ratings >= 1);
  // Prefer ingested (prod-obf-*) and English-ish names; sample evenly.
  const ingested = rated.filter((r) => r.productId.startsWith('prod-obf-'));
  const pool = ingested.length >= SAMPLE ? ingested : rated;
  const sample = shuffle(pool).slice(0, SAMPLE);

  let resolved = 0;
  let resolvedRated = 0;
  let ambiguous = 0;
  const byId = new Map<string, { ratings: number }>(rated.map((r) => [r.productId, { ratings: r.ratings }]));

  for (const s of sample) {
    const entry = catalog.find((c) => c.productId === s.productId);
    if (!entry) continue;
    // Simulate an Amazon title: brand prefix + catalog name + marketing tail.
    const sighting: MatchableItem = {
      id: 'sighting',
      brand: entry.brand,
      name: `${entry.brand ?? ''} ${entry.name} For All Skin Types, Dermatologist Tested`.trim(),
      ingredients: entry.ingredients,
    };
    const r = resolveItem(sighting, catalog as CatalogEntry[], brands);
    if (!r) continue;
    resolved++;
    if (r.ambiguous) ambiguous++;
    if ((byId.get(r.productId)?.ratings ?? 0) >= 1) resolvedRated++;
  }

  console.log(
    `RATE-CHECK: sampled ${sample.length} rated ingested products | ` +
      `resolved ${resolved}/${sample.length} | resolved-to-rated ${resolvedRated}/${sample.length} | ` +
      `ambiguous ${ambiguous} | total-rated-in-catalog ${rated.length}`,
  );

  await prismaRepositoryDisconnect();
}

// ── small local helpers (kept here so the script is self-contained) ──────────

async function prisma_findRated(): Promise<Array<{ productId: string; ratings: number }>> {
  const { prisma } = await import('../lib/data/prisma');
  const rows = await prisma.listingMatch.findMany({
    include: { listing: { select: { ratings: { select: { id: true } } } } },
  });
  const byProduct = new Map<string, number>();
  for (const m of rows) {
    byProduct.set(m.productId, (byProduct.get(m.productId) ?? 0) + m.listing.ratings.length);
  }
  return [...byProduct].map(([productId, ratings]) => ({ productId, ratings }));
}

async function prismaRepositoryDisconnect() {
  const { prisma } = await import('../lib/data/prisma');
  await prisma.$disconnect();
}

function shuffle<T>(a: T[]): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j]!, x[i]!];
  }
  return x;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
