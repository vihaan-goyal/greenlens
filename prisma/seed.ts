// Seeds the SQLite catalog from the shared seed data in lib/data/seed-data.ts —
// the same data the mock repository serves, so `GREENLENS_REPO=prisma` renders
// identically to the default mock.
//
// Run with:  npm run db:seed
// (node --env-file=.env --experimental-strip-types prisma/seed.ts)
//
// seed-data.ts has only type-only imports, so Node's type stripping leaves it
// with no runtime dependencies — no bundler needed.

import { PrismaClient } from '@prisma/client';
import {
  BRANDS,
  INGREDIENT_FLAGS,
  LISTINGS,
  PRODUCTS,
  RATINGS,
  SEED,
  SOURCES,
} from '../lib/data/seed-data.ts';

const prisma = new PrismaClient();

async function main() {
  // Clear in FK-safe order so re-seeding is idempotent.
  await prisma.rating.deleteMany();
  await prisma.listingMatch.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.ingredientFlag.deleteMany();
  await prisma.product.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.source.deleteMany();

  await prisma.source.createMany({
    data: SOURCES.map((s) => ({
      id: s.id,
      name: s.name,
      axis: s.axis,
      scaleMin: s.scaleMin,
      scaleMax: s.scaleMax,
      scaleDirection: s.scaleDirection,
      fundingModel: s.fundingModel,
    })),
  });

  await prisma.brand.createMany({
    data: BRANDS.map((b) => ({
      id: b.id,
      name: b.name,
      parentId: b.parentId ?? null,
      aliases: b.aliases,
    })),
  });

  await prisma.product.createMany({
    data: PRODUCTS.map((p, i) => ({
      id: p.id,
      brandId: p.brandId,
      displayName: p.displayName,
      category: p.category,
      gtin: p.gtin ?? null,
      sizeValue: p.sizeValue ?? null,
      sizeUnit: p.sizeUnit ?? null,
      ingredients: p.ingredients,
      sortIndex: i,
    })),
  });

  await prisma.listing.createMany({
    data: LISTINGS.map((l) => ({
      id: l.id,
      sourceId: l.sourceId,
      nativeId: l.nativeId,
      rawName: l.rawName,
      rawBrand: l.rawBrand,
      rawGtin: l.rawGtin ?? null,
      rawIngredients: l.rawIngredients,
      url: l.url,
      payload: l.payload as object,
      fetchedAt: l.fetchedAt,
    })),
  });

  await prisma.rating.createMany({
    data: RATINGS.map((r) => ({
      id: r.id,
      listingId: r.listingId,
      scoreRaw: r.scoreRaw,
      scoreLabel: r.scoreLabel ?? null,
      ingestedAt: r.ingestedAt,
    })),
  });

  // One high-confidence match per seed listing — these are hand-curated, so the
  // matcher's verdict is taken as given (confidence 1, reviewed).
  await prisma.listingMatch.createMany({
    data: SEED.map((s) => ({
      listingId: s.listingId,
      productId: s.productId,
      confidence: 1,
      method: 'seed',
      reviewed: true,
    })),
  });

  await prisma.ingredientFlag.createMany({
    data: INGREDIENT_FLAGS.map((f) => ({
      productId: f.productId,
      slug: f.slug,
      name: f.name,
      explanation: f.explanation,
      positions: f.positions,
      notes: f.notes,
    })),
  });

  const counts = {
    sources: await prisma.source.count(),
    brands: await prisma.brand.count(),
    products: await prisma.product.count(),
    listings: await prisma.listing.count(),
    ratings: await prisma.rating.count(),
    matches: await prisma.listingMatch.count(),
    flags: await prisma.ingredientFlag.count(),
  };
  console.log('Seeded:', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
