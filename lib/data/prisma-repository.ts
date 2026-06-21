import {
  AXES,
  type Axis,
  type Brand,
  type FundingModel,
  type IngredientFlag,
  type IngredientNote,
  type IngredientRaterPosition,
  type Listing,
  type Product,
  type Rating,
  type ScaleDirection,
  type Source,
} from '../domain/types';
import { summarizePillars } from '../domain/scoring';
import { canonicalizeBrand } from '../matcher/blocking';
import { normalizeName, tokenDocFrequencies, isGenericName } from '../matcher/features';
import type { CatalogEntry } from '../matcher/matcher';
import type { IngestResult } from '../ingestion/open-beauty-facts';
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
    // Carry each match's provenance (confidence/method/reviewed) onto its ratings
    // so the domain layer and UI can surface weak/unreviewed matches instead of
    // silently presenting them as certain. See lib/domain/provenance.
    const ratings = row.matches.flatMap((m) =>
      m.listing.ratings.map((r) => ({
        sourceId: m.listing.sourceId,
        scoreRaw: r.scoreRaw,
        matchConfidence: m.confidence,
        matchMethod: m.method,
        matchReviewed: m.reviewed,
      })),
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

  // ─── Ingestion write-path ─────────────────────────────────────────────────
  // Reading is rolled up from Listings + Ratings; ingestion is the inverse.
  // These two methods are the only writers, and they live here (not on the
  // read-only ProductRepository interface) because only the Prisma backing
  // store is writable — the mock repo and the extension never ingest.

  /**
   * Snapshot the canonical catalog + brands in the matcher's shapes. An ingest
   * job loads this once, resolves each fetched product against it, and extends
   * the in-memory copies with anything `persistIngestResult` reports as new — so
   * later barcodes in the same batch can match products minted earlier without a
   * DB round-trip per item.
   */
  async loadMatchContext(): Promise<{ catalog: CatalogEntry[]; brands: Brand[] }> {
    const [brandRows, productRows] = await Promise.all([
      prisma.brand.findMany(),
      prisma.product.findMany(),
    ]);
    const brands = brandRows.map(toBrand);
    const nameById = new Map(brands.map((b) => [b.id, b.name] as const));
    const named: CatalogEntry[] = productRows
      .map((row) => {
        const p = toProduct(row as ProductRow);
        return {
          id: p.id,
          productId: p.id,
          brand: nameById.get(p.brandId),
          name: p.displayName,
          gtin: p.gtin,
          ingredients: p.ingredients,
          sizeValue: p.sizeValue,
          sizeUnit: p.sizeUnit,
        };
      })
      // Drop products whose name is empty under the matcher's own normalization
      // (OBF rows with a "." placeholder or a non-Latin-only name). Their
      // normalized name is "", so name-similarity scores 1.0 against every other
      // such row and they pile up as false near-ties — ~99% of all `ambiguous`
      // flags traced back to these. They also have no displayable name, so they
      // can never be a useful match. Tradeoff: a sighting that carries an exact
      // GTIN for one of these no-name rows won't resolve, which is acceptable —
      // we'd have nothing to show for it anyway.
      .filter((c) => normalizeName(c.name) !== '');

    // Same pathology, one level up: drop rows whose whole name is corpus-generic
    // category words ("Shampoo", "Hand Soap"). Such a row is a token-subset of
    // thousands of products, so the overlap coefficient scores it ~1.0 against
    // each one and it becomes a universal false near-tie — the dominant remaining
    // cause of head-brand resolution ambiguity. Genericness is measured from this
    // catalog (no language-specific list), so it adapts to whatever the corpus is.
    const df = tokenDocFrequencies(named.map((c) => c.name));
    const catalog = named.filter((c) => !isGenericName(c.name, df, named.length));
    return { catalog, brands };
  }

  /**
   * Persist one ingestion result. Idempotent on re-run (deterministic ids +
   * upserts). When the matcher found a canonical product the Listing + Ratings
   * attach to it; when it didn't, a new canonical Product (and Brand if the
   * raw brand is unseen) is minted from the Listing so the catalog grows from
   * real data. Ratings always hang off the Listing, never the Product, so the
   * matcher can be re-run later without losing source data (see CLAUDE.md).
   *
   * `brands` is the caller's current brand list (for canonicalization); any
   * brand/product this call creates is returned so the caller can extend its
   * in-memory match context for the rest of the batch.
   */
  async persistIngestResult(
    result: IngestResult,
    brands: ReadonlyArray<Brand>,
  ): Promise<PersistResult> {
    const { listing, ratings, match, item, category } = result;

    await this.writeListing(listing, ratings);

    let productId: string;
    let confidence: number;
    let method: string;
    let created = false;
    let newBrand: Brand | null = null;
    let newEntry: CatalogEntry | null = null;

    if (match) {
      productId = match.productId;
      confidence = match.confidence;
      method = 'obf-auto';
    } else {
      const brand = await this.ensureBrand(listing.rawBrand, brands);
      newBrand = brand.created;
      productId = `prod-${listing.id}`; // prod-obf-<code>; deterministic → idempotent
      const displayName = listing.rawName || item.name || listing.nativeId;
      await prisma.product.upsert({
        where: { id: productId },
        create: {
          id: productId,
          brandId: brand.id,
          displayName,
          category,
          gtin: listing.rawGtin ?? null,
          sizeValue: item.sizeValue ?? null,
          sizeUnit: item.sizeUnit ?? null,
          ingredients: listing.rawIngredients,
          // Ingested products sort after the curated catalog's "On the shelf".
          sortIndex: 1000,
        },
        update: {
          brandId: brand.id,
          displayName,
          category,
          gtin: listing.rawGtin ?? null,
          sizeValue: item.sizeValue ?? null,
          sizeUnit: item.sizeUnit ?? null,
          ingredients: listing.rawIngredients,
        },
      });
      created = true;
      // The Listing defines this product, so the self-match is certain.
      confidence = 1;
      method = 'obf-new';
      newEntry = { ...item, id: productId, productId };
    }

    await prisma.listingMatch.upsert({
      where: { listingId: listing.id },
      create: { listingId: listing.id, productId, confidence, method, reviewed: false },
      update: { productId, confidence, method },
    });

    return { productId, created, newBrand, newEntry };
  }

  /**
   * Attach a pre-computed Listing + Ratings to a known canonical product. Used
   * by derived sources (e.g. the ingredient-hazard scan) that don't need the
   * matcher — the product is already known, so this just upserts the Listing,
   * replaces its Ratings, and points a ListingMatch at the product. Idempotent.
   */
  async attachListingToProduct(
    listing: Listing,
    ratings: ReadonlyArray<Rating>,
    productId: string,
    opts: { confidence: number; method: string },
  ): Promise<void> {
    await this.writeListing(listing, ratings);
    await prisma.listingMatch.upsert({
      where: { listingId: listing.id },
      create: {
        listingId: listing.id,
        productId,
        confidence: opts.confidence,
        method: opts.method,
        reviewed: false,
      },
      update: { productId, confidence: opts.confidence, method: opts.method },
    });
  }

  /**
   * Upsert a Listing and replace its Ratings wholesale, so a re-run reflects the
   * latest scores rather than accumulating duplicates. The shared write step for
   * both ingestion and derived sources.
   */
  private async writeListing(listing: Listing, ratings: ReadonlyArray<Rating>): Promise<void> {
    const data = {
      sourceId: listing.sourceId,
      nativeId: listing.nativeId,
      rawName: listing.rawName,
      rawBrand: listing.rawBrand,
      rawGtin: listing.rawGtin ?? null,
      rawIngredients: listing.rawIngredients,
      url: listing.url,
      payload: listing.payload as object,
      fetchedAt: listing.fetchedAt,
    };
    await prisma.listing.upsert({
      where: { id: listing.id },
      create: { id: listing.id, ...data },
      update: data,
    });
    await prisma.rating.deleteMany({ where: { listingId: listing.id } });
    if (ratings.length > 0) {
      await prisma.rating.createMany({
        data: ratings.map((r) => ({
          id: r.id,
          listingId: r.listingId,
          scoreRaw: r.scoreRaw,
          scoreLabel: r.scoreLabel ?? null,
          ingestedAt: r.ingestedAt,
        })),
      });
    }
  }

  /**
   * Find the canonical brand for a raw OBF brand string, or mint one. Matching
   * reuses the matcher's `canonicalizeBrand` so brand identity is consistent
   * across the read and write paths. A new brand is seeded with the raw string
   * as both name and an alias so future listings canonicalize back to it.
   */
  private async ensureBrand(
    rawBrand: string,
    brands: ReadonlyArray<Brand>,
  ): Promise<{ id: string; created: Brand | null }> {
    const trimmed = rawBrand.trim();
    const canon = canonicalizeBrand(trimmed, brands);
    // `canonicalizeBrand` returns an existing brand id on a hit, or a normalized
    // fallback string (never an id) on a miss — so an id present in `brands`
    // means a real match.
    if (canon && brands.some((b) => b.id === canon)) return { id: canon, created: null };

    const id = trimmed ? `brand-obf-${stripNorm(trimmed)}` : 'brand-unknown';
    const name = trimmed || 'Unknown';
    const aliases = trimmed ? [trimmed] : [];
    await prisma.brand.upsert({
      where: { id },
      create: { id, name, parentId: null, aliases },
      update: {},
    });
    // Only report it as new if the caller didn't already know about it.
    const created = brands.some((b) => b.id === id) ? null : { id, name, aliases };
    return { id, created };
  }
}

export interface PersistResult {
  productId: string;
  /** True when a new canonical Product was minted (no existing match). */
  created: boolean;
  /** A brand minted by this call, for the caller to add to its match context. */
  newBrand: Brand | null;
  /** A catalog entry minted by this call, for the caller's match context. */
  newEntry: CatalogEntry | null;
}

/** Lowercase, strip non-alphanumerics — mirrors the matcher's brand normalizer. */
function stripNorm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
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
