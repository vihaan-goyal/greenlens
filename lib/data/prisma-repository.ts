import {
  AXES,
  type Axis,
  type Brand,
  type FundingModel,
  type IngredientFlag,
  type IngredientNote,
  type IngredientRaterPosition,
  type Product,
  type ScaleDirection,
  type Source,
} from '../domain/types';
import { summarizePillars } from '../domain/scoring';
import { prisma } from './prisma';
import type { AlternativeView, ProductRepository, ProductView } from './repository';

// ─── Row → domain mappers ─────────────────────────────────────────────────────
// SQLite has no enums or scalar lists, so Source enum-ish fields are stored as
// String and array/payload fields as Json. Re-type them at this seam; the rest
// of the app only ever sees the domain types.

type BrandRow = { id: string; name: string; parentId: string | null; aliases: unknown };
type ProductRow = {
  id: string;
  brandId: string;
  displayName: string;
  category: string;
  gtin: string | null;
  sizeValue: number | null;
  sizeUnit: string | null;
  ingredients: unknown;
};
type SourceRow = {
  id: string;
  name: string;
  axis: string;
  scaleMin: number;
  scaleMax: number;
  scaleDirection: string;
  fundingModel: string;
};

function toBrand(row: BrandRow): Brand {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parentId ?? undefined,
    aliases: (row.aliases as string[]) ?? [],
  };
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    brandId: row.brandId,
    displayName: row.displayName,
    category: row.category,
    gtin: row.gtin ?? undefined,
    sizeValue: row.sizeValue ?? undefined,
    sizeUnit: row.sizeUnit ?? undefined,
    ingredients: (row.ingredients as string[]) ?? [],
  };
}

function toSource(row: SourceRow): Source {
  return {
    id: row.id,
    name: row.name,
    axis: row.axis as Axis,
    scaleMin: row.scaleMin,
    scaleMax: row.scaleMax,
    scaleDirection: row.scaleDirection as ScaleDirection,
    fundingModel: row.fundingModel as FundingModel,
  };
}

const DELTA_MIN = 5; // points on the normalized 0..100 scale to count as a meaningful difference

function pillarDelta(base: ProductView, alt: ProductView, axis: Axis): number | null {
  const a = alt.pillars[axis].representative;
  const b = base.pillars[axis].representative;
  if (a === null || b === null) return null;
  return a - b;
}

// ─── Repository ───────────────────────────────────────────────────────────────
// Reads the canonical catalog out of SQLite and rolls Listings + Ratings up into
// the same ProductView shape the mock repository produces, so swapping mock→real
// never changes the UI.

export class PrismaProductRepository implements ProductRepository {
  /** Cached source list — small, static, hit on every view build. */
  private sourcesCache: Source[] | null = null;

  private async sources(): Promise<Source[]> {
    if (!this.sourcesCache) {
      const rows = await prisma.source.findMany();
      this.sourcesCache = rows.map(toSource);
    }
    return this.sourcesCache;
  }

  private async buildView(productId: string): Promise<ProductView | null> {
    const row = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        brand: true,
        matches: { include: { listing: { include: { ratings: true } } } },
      },
    });
    if (!row) return null;

    const sources = await this.sources();
    const ratings = row.matches.flatMap((m) =>
      m.listing.ratings.map((r) => ({ sourceId: m.listing.sourceId, scoreRaw: r.scoreRaw })),
    );
    const pillars = summarizePillars(ratings, sources);
    return { product: toProduct(row), brand: toBrand(row.brand), pillars, sources };
  }

  private async buildViews(productIds: string[]): Promise<ProductView[]> {
    const views = await Promise.all(productIds.map((id) => this.buildView(id)));
    return views.filter((v): v is ProductView => v !== null);
  }

  async listProducts(): Promise<ProductView[]> {
    // Curated order so this matches the mock repository's "On the shelf" list.
    const ids = await prisma.product.findMany({
      orderBy: { sortIndex: 'asc' },
      select: { id: true },
    });
    return this.buildViews(ids.map((p) => p.id));
  }

  async getProduct(id: string): Promise<ProductView | null> {
    return this.buildView(id);
  }

  async searchProducts(query: string): Promise<ProductView[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    // SQLite `contains` is case-insensitive for ASCII; gtin is digits only.
    const rows = await prisma.product.findMany({
      where: {
        OR: [
          { displayName: { contains: q } },
          { gtin: { contains: q } },
          { brand: { name: { contains: q } } },
        ],
      },
      orderBy: { sortIndex: 'asc' },
      select: { id: true },
    });
    return this.buildViews(rows.map((p) => p.id));
  }

  async listAlternatives(productId: string): Promise<AlternativeView[]> {
    const base = await this.getProduct(productId);
    if (!base) return [];
    const baseSafety = base.pillars.ingredient_safety.representative ?? -Infinity;

    const candidateRows = await prisma.product.findMany({
      where: { category: base.product.category, id: { not: productId } },
      select: { id: true },
    });
    const candidates = await this.buildViews(candidateRows.map((p) => p.id));

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
    const row = await prisma.ingredientFlag.findUnique({
      where: { productId_slug: { productId, slug } },
    });
    return row ? toFlag(row) : null;
  }

  async listIngredientFlags(productId: string): Promise<IngredientFlag[]> {
    const rows = await prisma.ingredientFlag.findMany({ where: { productId } });
    return rows.map(toFlag);
  }
}

type FlagRow = {
  productId: string;
  slug: string;
  name: string;
  explanation: string;
  positions: unknown;
  notes: unknown;
};

function toFlag(row: FlagRow): IngredientFlag {
  return {
    productId: row.productId,
    slug: row.slug,
    name: row.name,
    explanation: row.explanation,
    positions: row.positions as IngredientRaterPosition[],
    notes: row.notes as IngredientNote[],
  };
}

export const prismaRepository = new PrismaProductRepository();
