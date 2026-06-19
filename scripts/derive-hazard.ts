// Derive ingredient-safety ratings for the whole catalog.
//
// For every product that has an ingredient list, compute a Greenlens Ingredient
// Scan score from open EU regulatory data (lib/ingestion/hazard) and attach it
// as a Listing + Rating on the `ingredient-hazard` source. This is the coverage
// lever: it produces a safety rating for ~every product, not just the ones some
// third party happened to review — so it works on seed products *and* anything
// pulled in by the OBF ingest. Run it after db:seed / db:ingest.
//
// Run (needs DATABASE_URL from .env, and the .ts resolution hook):
//   npm run db:hazard
//
// Idempotent: deterministic ids + upserts, so re-running rescores in place.

import { prisma } from '../lib/data/prisma';
import { prismaRepository } from '../lib/data/prisma-repository';
import {
  buildHazardListing,
  HAZARD_SOURCE,
  scoreIngredientHazard,
} from '../lib/ingestion/hazard/hazard';

async function main() {
  // The hazard Source must exist before its Listings can reference it (FK).
  await prisma.source.upsert({
    where: { id: HAZARD_SOURCE.id },
    create: { ...HAZARD_SOURCE },
    update: { ...HAZARD_SOURCE },
  });

  const products = await prisma.product.findMany({ include: { brand: true } });

  const summary = { scored: 0, skipped: 0, flagged: 0, scoreSum: 0 };

  for (const p of products) {
    const ingredients = (p.ingredients as string[]) ?? [];
    const assessment = scoreIngredientHazard(ingredients);
    if (!assessment) {
      summary.skipped++;
      console.log(`  ·  ${p.id}  no ingredient data`);
      continue;
    }

    const { listing, rating } = buildHazardListing(
      {
        productId: p.id,
        displayName: p.displayName,
        brandName: p.brand.name,
        gtin: p.gtin ?? undefined,
        ingredients,
      },
      assessment,
    );
    await prismaRepository.attachListingToProduct(listing, [rating], p.id, {
      confidence: 1,
      method: 'hazard-derived',
    });

    summary.scored++;
    summary.scoreSum += assessment.score;
    if (assessment.matches.length > 0) summary.flagged++;
    console.log(
      `  =  ${p.id}  ${assessment.score} ${assessment.label.padEnd(9)} ${assessment.summary}`,
    );
  }

  const avg = summary.scored > 0 ? Math.round(summary.scoreSum / summary.scored) : 0;
  console.log('\nHazard derivation:', { ...summary, avgScore: avg });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
