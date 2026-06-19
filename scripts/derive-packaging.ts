// Derive packaging-recyclability ratings for the catalog.
//
// For every product that has an Open Beauty Facts listing carrying packaging-
// material tags, compute a Greenlens Packaging Scan score from open packaging
// standards (lib/ingestion/packaging) and attach it as a Listing + Rating on the
// `packaging-scan` source. This is the coverage lever for the packaging axis:
// OBF records packaging materials for far more products than it has an Eco-Score,
// so this rates the long tail that today has nothing on the packaging pillar.
// Run it after db:seed / db:ingest.
//
// Run (needs DATABASE_URL from .env, and the .ts resolution hook):
//   npm run db:packaging
//
// Idempotent: deterministic ids + upserts, so re-running rescores in place.

import { prisma } from '../lib/data/prisma';
import { prismaRepository } from '../lib/data/prisma-repository';
import {
  extractPackagingMaterials,
  obfResponseSchema,
  OBF_SOURCE_ID,
} from '../lib/ingestion/open-beauty-facts';
import {
  buildPackagingListing,
  PACKAGING_SOURCE,
  scorePackaging,
} from '../lib/ingestion/packaging/packaging';

/** Pull packaging materials out of a stored OBF listing payload, defensively. */
function materialsFromPayload(payload: unknown): string[] {
  const parsed = obfResponseSchema.safeParse(payload);
  if (!parsed.success || !parsed.data.product) return [];
  return extractPackagingMaterials(parsed.data.product);
}

async function main() {
  // The packaging Source must exist before its Listings can reference it (FK).
  await prisma.source.upsert({
    where: { id: PACKAGING_SOURCE.id },
    create: { ...PACKAGING_SOURCE },
    update: { ...PACKAGING_SOURCE },
  });

  const products = await prisma.product.findMany({
    include: { brand: true, matches: { include: { listing: true } } },
  });

  const summary = { scored: 0, skipped: 0, scoreSum: 0 };

  for (const p of products) {
    // Find the first OBF listing for this product that actually carries packaging
    // material tags. (Most products have at most one OBF listing.)
    let materials: string[] = [];
    for (const m of p.matches) {
      if (m.listing.sourceId !== OBF_SOURCE_ID) continue;
      const found = materialsFromPayload(m.listing.payload);
      if (found.length > 0) {
        materials = found;
        break;
      }
    }

    const assessment = materials.length > 0 ? scorePackaging(materials) : null;
    if (!assessment) {
      summary.skipped++;
      console.log(`  ·  ${p.id}  no packaging data`);
      continue;
    }

    const { listing, rating } = buildPackagingListing(
      {
        productId: p.id,
        displayName: p.displayName,
        brandName: p.brand.name,
        gtin: p.gtin ?? undefined,
        materials,
      },
      assessment,
    );
    await prismaRepository.attachListingToProduct(listing, [rating], p.id, {
      confidence: 1,
      method: 'packaging-derived',
    });

    summary.scored++;
    summary.scoreSum += assessment.score;
    console.log(
      `  =  ${p.id}  ${assessment.score} ${assessment.label.padEnd(9)} ${assessment.summary}`,
    );
  }

  const avg = summary.scored > 0 ? Math.round(summary.scoreSum / summary.scored) : 0;
  console.log('\nPackaging derivation:', { ...summary, avgScore: avg });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
