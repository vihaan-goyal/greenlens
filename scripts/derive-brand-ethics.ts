// Derive brand-level cruelty-free / vegan ratings for the catalog.
//
// For every product whose brand (or parent brand) is in the open certification
// lists (lib/ingestion/brand-ethics), attach a rating on the `cruelty-free`
// source (labor/ethics axis). One dataset row covers every product of a brand —
// the coverage multiplier. Works on seed products and OBF-ingested ones alike.
//
// Run (needs DATABASE_URL from .env, and the .ts resolution hook):
//   npm run db:ethics
//
// Idempotent: deterministic ids + upserts, so re-running rescores in place.

import { prisma } from '../lib/data/prisma';
import { prismaRepository } from '../lib/data/prisma-repository';
import {
  assessBrandEthics,
  BRAND_ETHICS_SOURCE,
  buildBrandEthicsListing,
  resolveBrandEthics,
} from '../lib/ingestion/brand-ethics/brand-ethics';

async function main() {
  // The source must exist before its Listings can reference it (FK).
  await prisma.source.upsert({
    where: { id: BRAND_ETHICS_SOURCE.id },
    create: { ...BRAND_ETHICS_SOURCE },
    update: { ...BRAND_ETHICS_SOURCE },
  });

  const products = await prisma.product.findMany({
    include: { brand: { include: { parent: true } } },
  });

  const summary = { rated: 0, unlisted: 0, viaParent: 0 };

  for (const p of products) {
    const brand = p.brand;
    const ownNames = [brand.name, ...((brand.aliases as string[]) ?? [])];
    const parent = brand.parent;
    const parentNames = parent ? [parent.name, ...((parent.aliases as string[]) ?? [])] : [];

    // Brand's own certification wins; fall back to the parent company's status.
    let entry = resolveBrandEthics(ownNames);
    let viaParent = false;
    if (!entry && parentNames.length > 0) {
      entry = resolveBrandEthics(parentNames);
      viaParent = !!entry;
    }

    if (!entry) {
      summary.unlisted++;
      console.log(`  ·  ${p.id}  ${brand.name}  no certification on record`);
      continue;
    }

    const assessment = assessBrandEthics(entry);
    const { listing, rating } = buildBrandEthicsListing(
      { productId: p.id, displayName: p.displayName, brandName: brand.name, gtin: p.gtin ?? undefined },
      assessment,
    );
    await prismaRepository.attachListingToProduct(listing, [rating], p.id, {
      confidence: 1,
      method: viaParent ? 'brand-ethics-parent' : 'brand-ethics',
    });

    summary.rated++;
    if (viaParent) summary.viaParent++;
    console.log(
      `  =  ${p.id}  ${brand.name}  ${assessment.score} ${assessment.label.padEnd(9)}` +
        ` ${assessment.status}${viaParent ? ' (via parent)' : ''}`,
    );
  }

  console.log('\nBrand-ethics derivation:', summary);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
