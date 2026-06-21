import { AXES, type Axis, type Brand, type IngredientFlag, type Product } from '../domain/types';
import type { CatalogEntry } from '../matcher/matcher';
import { summarizePillars } from '../domain/scoring';
import {
  BRANDS,
  INGREDIENT_FLAGS,
  PRODUCTS,
  SEED,
  SOURCES,
  seedMatch,
} from './seed-data';
import type { AlternativeView, ProductRepository, ProductView } from './repository';

// Re-export the seed data so existing importers (and the extension bundle) keep
// working. The data itself lives in ./seed-data so the Prisma seed script can
// load it without pulling in this module's runtime dependencies.
export { BRANDS, INGREDIENT_FLAGS, LISTINGS, PRODUCTS, RATINGS, SEED, SOURCES } from './seed-data';

// ─── Helpers ────────────────────────────────────────────────────────────────

export function ingredientSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildView(product: Product): ProductView {
  const brand = BRANDS.find((b) => b.id === product.brandId)!;
  // Map straight off the seed match rows so each rating carries the provenance
  // of the ListingMatch behind it (confidence/method/reviewed), defaulting to a
  // certain curated match for rows that don't specify one.
  const productRatings = SEED.filter((s) => s.productId === product.id).map((s) => {
    const m = seedMatch(s);
    return {
      sourceId: s.sourceId,
      scoreRaw: s.scoreRaw,
      matchConfidence: m.confidence,
      matchMethod: m.method,
      matchReviewed: m.reviewed,
    };
  });
  const pillars = summarizePillars(productRatings, SOURCES);
  return { product, brand, pillars, sources: SOURCES };
}

const DELTA_MIN = 5; // points on the normalized 0..100 scale to count as a meaningful difference

function pillarDelta(base: ProductView, alt: ProductView, axis: Axis): number | null {
  const a = alt.pillars[axis].representative;
  const b = base.pillars[axis].representative;
  if (a === null || b === null) return null;
  return a - b;
}

// ─── Repository ─────────────────────────────────────────────────────────────

export class MockProductRepository implements ProductRepository {
  async listProducts(): Promise<ProductView[]> {
    return PRODUCTS.map(buildView);
  }

  async getProduct(id: string): Promise<ProductView | null> {
    const product = PRODUCTS.find((p) => p.id === id);
    return product ? buildView(product) : null;
  }

  async searchProducts(query: string): Promise<ProductView[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return PRODUCTS.filter((p) => {
      const brand = BRANDS.find((b) => b.id === p.brandId)!;
      return (
        p.displayName.toLowerCase().includes(q) ||
        brand.name.toLowerCase().includes(q) ||
        (p.gtin?.includes(q) ?? false)
      );
    }).map(buildView);
  }

  async listAlternatives(productId: string): Promise<AlternativeView[]> {
    const base = await this.getProduct(productId);
    if (!base) return [];
    const baseSafety = base.pillars.ingredient_safety.representative ?? -Infinity;

    const candidates = PRODUCTS.filter(
      (p) => p.id !== productId && p.category === base.product.category,
    ).map(buildView);

    return candidates
      .filter((alt) => (alt.pillars.ingredient_safety.representative ?? -Infinity) > baseSafety)
      // Ranking is by ingredient_safety only. Do not introduce payout-based
      // sorting even after a revenue model exists — see CLAUDE.md.
      .sort(
        (a, b) =>
          (b.pillars.ingredient_safety.representative ?? -Infinity) -
          (a.pillars.ingredient_safety.representative ?? -Infinity),
      )
      .map((view) => {
        const cleaner: Array<{ axis: Axis; delta: number }> = [];
        const tradeoffs: Array<{ axis: Axis; delta: number }> = [];
        for (const axis of AXES) {
          const d = pillarDelta(base, view, axis);
          if (d === null) continue;
          if (d >= DELTA_MIN) cleaner.push({ axis, delta: d });
          else if (d <= -DELTA_MIN) tradeoffs.push({ axis, delta: d });
        }
        return { view, cleaner, tradeoffs };
      });
  }

  async getIngredientFlag(productId: string, slug: string): Promise<IngredientFlag | null> {
    return INGREDIENT_FLAGS.find((f) => f.productId === productId && f.slug === slug) ?? null;
  }

  async listIngredientFlags(productId: string): Promise<IngredientFlag[]> {
    return INGREDIENT_FLAGS.filter((f) => f.productId === productId);
  }

  async loadMatchContext(): Promise<{ catalog: CatalogEntry[]; brands: Brand[] }> {
    const nameById = new Map(BRANDS.map((b) => [b.id, b.name] as const));
    const catalog: CatalogEntry[] = PRODUCTS.map((p) => ({
      id: p.id,
      productId: p.id,
      brand: nameById.get(p.brandId),
      name: p.displayName,
      gtin: p.gtin,
      ingredients: p.ingredients,
      sizeValue: p.sizeValue,
      sizeUnit: p.sizeUnit,
    }));
    return { catalog, brands: BRANDS };
  }
}

export const mockRepository = new MockProductRepository();
