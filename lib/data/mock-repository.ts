import {
  AXES,
  type Axis,
  type Brand,
  type IngredientFlag,
  type Listing,
  type Product,
  type Rating,
  type Source,
} from '../domain/types';
import { summarizePillars } from '../domain/scoring';
import type { AlternativeView, ProductRepository, ProductView } from './repository';

// ─── Sources ────────────────────────────────────────────────────────────────
// Three real ratings sources, each with its native scale and funding model.
// Funding model is shown next to every rating in the UI — that's the point.

const SOURCES: Source[] = [
  {
    id: 'ewg',
    name: 'EWG Skin Deep',
    axis: 'ingredient_safety',
    scaleMin: 1,
    scaleMax: 10,
    scaleDirection: 'lower_is_better', // 1 = low concern
    fundingModel: 'nonprofit',
  },
  {
    id: 'yuka',
    name: 'Yuka',
    axis: 'ingredient_safety',
    scaleMin: 0,
    scaleMax: 100,
    scaleDirection: 'higher_is_better',
    fundingModel: 'subscription',
  },
  {
    id: 'inci-beauty',
    name: 'INCI Beauty',
    axis: 'ingredient_safety',
    scaleMin: 0,
    scaleMax: 20,
    scaleDirection: 'higher_is_better',
    fundingModel: 'ad_supported',
  },
  // Stand-in raters for the other axes so the four-pillar UI has something to
  // show in Phase 2. These will be replaced by real Open Beauty Facts
  // signals + ad-hoc rater data in Phase 5.
  {
    id: 'obf-eco',
    name: 'Open Beauty Facts',
    axis: 'environmental',
    scaleMin: 0,
    scaleMax: 100,
    scaleDirection: 'higher_is_better',
    fundingModel: 'nonprofit',
  },
  {
    id: 'good-on-you',
    name: 'Good On You',
    axis: 'labor',
    scaleMin: 1,
    scaleMax: 5,
    scaleDirection: 'higher_is_better',
    fundingModel: 'independent',
  },
  {
    id: 'how2recycle',
    name: 'How2Recycle',
    axis: 'packaging',
    scaleMin: 0,
    scaleMax: 100,
    scaleDirection: 'higher_is_better',
    fundingModel: 'nonprofit',
  },
];

// ─── Brands ─────────────────────────────────────────────────────────────────

const BRANDS: Brand[] = [
  { id: 'brand-lumen', name: 'Lumen Botanicals', aliases: ['Lumen', 'lumen botanicals'] },
  { id: 'brand-vela', name: 'Vela Skin', aliases: ['Vela', 'vela skin co.'] },
  { id: 'brand-fern', name: 'Fern & Field', aliases: ['Fern', 'fern field', 'fern and field'] },
];

// ─── Products ───────────────────────────────────────────────────────────────
// The first two are the demo products called for in PLAN.md Phase 1; the next
// two exist so the Alternatives screen has something honest to rank against.

const PRODUCTS: Product[] = [
  {
    id: 'prod-vitc',
    brandId: 'brand-lumen',
    displayName: '10% Vitamin C Brightening Serum',
    category: 'serum',
    gtin: '0860001234567',
    sizeValue: 30,
    sizeUnit: 'ml',
    ingredients: [
      'Aqua',
      'Ascorbic Acid',
      'Propanediol',
      'Glycerin',
      'Sodium Hyaluronate',
      'Ferulic Acid',
      'Tocopherol',
      'Phenoxyethanol',
      'Ethylhexylglycerin',
      'Citric Acid',
    ],
  },
  {
    id: 'prod-cream',
    brandId: 'brand-vela',
    displayName: 'Daily Ceramide Moisturizing Cream',
    category: 'moisturizer',
    gtin: '0860009876543',
    sizeValue: 50,
    sizeUnit: 'ml',
    ingredients: [
      'Aqua',
      'Glycerin',
      'Caprylic/Capric Triglyceride',
      'Cetearyl Alcohol',
      'Ceramide NP',
      'Niacinamide',
      'Squalane',
      'Panthenol',
      'Tocopherol',
      'Phenoxyethanol',
    ],
  },
  {
    id: 'prod-vitc-clean',
    brandId: 'brand-fern',
    displayName: 'Stabilized Vitamin C Serum (preservative-free)',
    category: 'serum',
    gtin: '0860011112223',
    sizeValue: 30,
    sizeUnit: 'ml',
    ingredients: [
      'Aqua',
      '3-O-Ethyl Ascorbic Acid',
      'Propanediol',
      'Glycerin',
      'Sodium Hyaluronate',
      'Ferulic Acid',
      'Tocopherol',
      'Citric Acid',
    ],
  },
  {
    id: 'prod-cream-clean',
    brandId: 'brand-fern',
    displayName: 'Bare Ceramide Cream (fragrance-free)',
    category: 'moisturizer',
    gtin: '0860033334445',
    sizeValue: 50,
    sizeUnit: 'ml',
    ingredients: [
      'Aqua',
      'Glycerin',
      'Caprylic/Capric Triglyceride',
      'Cetearyl Alcohol',
      'Ceramide NP',
      'Niacinamide',
      'Squalane',
      'Panthenol',
      'Tocopherol',
    ],
  },
];

// ─── Listings + Ratings ─────────────────────────────────────────────────────
// Same-axis disagreements (the thing this product exists to surface) are baked
// into the data so Phase 2 demos meaningfully even with no real ingestion.

const FETCHED = new Date('2026-06-01T00:00:00Z');
const INGESTED = new Date('2026-06-01T00:05:00Z');

interface SeedRating {
  listingId: string;
  productId: string;
  sourceId: string;
  scoreRaw: number;
  scoreLabel?: string;
}

const SEED: SeedRating[] = [
  // ── Lumen vitamin C serum ────────────────────────────────────────────────
  // ingredient_safety: EWG concern vs Yuka clean → disagreement
  { listingId: 'l-vitc-ewg', productId: 'prod-vitc', sourceId: 'ewg', scoreRaw: 4, scoreLabel: 'Moderate concern' },
  { listingId: 'l-vitc-yuka', productId: 'prod-vitc', sourceId: 'yuka', scoreRaw: 90, scoreLabel: 'Excellent' },
  { listingId: 'l-vitc-inci', productId: 'prod-vitc', sourceId: 'inci-beauty', scoreRaw: 13, scoreLabel: 'Satisfactory' },
  // other axes
  { listingId: 'l-vitc-eco', productId: 'prod-vitc', sourceId: 'obf-eco', scoreRaw: 58 },
  { listingId: 'l-vitc-labor', productId: 'prod-vitc', sourceId: 'good-on-you', scoreRaw: 3 },
  { listingId: 'l-vitc-pkg', productId: 'prod-vitc', sourceId: 'how2recycle', scoreRaw: 55 },

  // ── Vela ceramide cream ──────────────────────────────────────────────────
  // raters agree on safety — the contrast case
  { listingId: 'l-cream-ewg', productId: 'prod-cream', sourceId: 'ewg', scoreRaw: 2, scoreLabel: 'Low concern' },
  { listingId: 'l-cream-yuka', productId: 'prod-cream', sourceId: 'yuka', scoreRaw: 82, scoreLabel: 'Good' },
  { listingId: 'l-cream-inci', productId: 'prod-cream', sourceId: 'inci-beauty', scoreRaw: 16, scoreLabel: 'Good' },
  { listingId: 'l-cream-eco', productId: 'prod-cream', sourceId: 'obf-eco', scoreRaw: 64 },
  { listingId: 'l-cream-labor', productId: 'prod-cream', sourceId: 'good-on-you', scoreRaw: 3 },
  { listingId: 'l-cream-pkg', productId: 'prod-cream', sourceId: 'how2recycle', scoreRaw: 72 },

  // ── Fern stabilized vitamin C (cleaner alternative serum) ────────────────
  { listingId: 'l-vitcx-ewg', productId: 'prod-vitc-clean', sourceId: 'ewg', scoreRaw: 1, scoreLabel: 'Low concern' },
  { listingId: 'l-vitcx-yuka', productId: 'prod-vitc-clean', sourceId: 'yuka', scoreRaw: 95, scoreLabel: 'Excellent' },
  { listingId: 'l-vitcx-inci', productId: 'prod-vitc-clean', sourceId: 'inci-beauty', scoreRaw: 18, scoreLabel: 'Excellent' },
  { listingId: 'l-vitcx-eco', productId: 'prod-vitc-clean', sourceId: 'obf-eco', scoreRaw: 72 },
  { listingId: 'l-vitcx-labor', productId: 'prod-vitc-clean', sourceId: 'good-on-you', scoreRaw: 4 },
  // tradeoff: packaging scores lower than the Lumen serum
  { listingId: 'l-vitcx-pkg', productId: 'prod-vitc-clean', sourceId: 'how2recycle', scoreRaw: 42 },

  // ── Fern bare ceramide cream (cleaner alternative moisturizer) ───────────
  { listingId: 'l-creamx-ewg', productId: 'prod-cream-clean', sourceId: 'ewg', scoreRaw: 1 },
  { listingId: 'l-creamx-yuka', productId: 'prod-cream-clean', sourceId: 'yuka', scoreRaw: 92 },
  { listingId: 'l-creamx-inci', productId: 'prod-cream-clean', sourceId: 'inci-beauty', scoreRaw: 18 },
  { listingId: 'l-creamx-eco', productId: 'prod-cream-clean', sourceId: 'obf-eco', scoreRaw: 68 },
  { listingId: 'l-creamx-labor', productId: 'prod-cream-clean', sourceId: 'good-on-you', scoreRaw: 4 },
  // tradeoff: thinner feel proxy — Fern's labor is great but packaging is worse than Vela's
  { listingId: 'l-creamx-pkg', productId: 'prod-cream-clean', sourceId: 'how2recycle', scoreRaw: 58 },
];

const LISTINGS: Listing[] = SEED.map((s) => {
  const product = PRODUCTS.find((p) => p.id === s.productId)!;
  const brand = BRANDS.find((b) => b.id === product.brandId)!;
  return {
    id: s.listingId,
    sourceId: s.sourceId,
    nativeId: `${s.sourceId}-${s.productId}`,
    rawName: product.displayName,
    rawBrand: brand.name,
    rawGtin: product.gtin,
    rawIngredients: product.ingredients,
    url: `https://example.invalid/${s.sourceId}/${s.productId}`,
    payload: { scoreRaw: s.scoreRaw, scoreLabel: s.scoreLabel },
    fetchedAt: FETCHED,
  };
});

const RATINGS: Rating[] = SEED.map((s) => ({
  id: `r-${s.listingId}`,
  listingId: s.listingId,
  scoreRaw: s.scoreRaw,
  scoreLabel: s.scoreLabel,
  ingestedAt: INGESTED,
}));

// ─── Ingredient flags ───────────────────────────────────────────────────────
// Per-rater stances on specific ingredients. Real ingredient databases land in
// Phase 5; the structure is the real deliverable for Phase 2 — each rater's
// voice is preserved with its funding model, never blended.

const INGREDIENT_FLAGS: IngredientFlag[] = [
  {
    productId: 'prod-vitc',
    slug: 'phenoxyethanol',
    name: 'Phenoxyethanol',
    explanation:
      'A widely used preservative. Effective against bacteria and yeast at low concentrations, but rater opinions split on long-term skin tolerability and EU concentration caps.',
    positions: [
      {
        sourceId: 'ewg',
        sourceName: 'EWG Skin Deep',
        fundingModel: 'nonprofit',
        stance: 'caution',
        reasoning:
          'Flags moderate irritation concerns and notes restricted use in leave-on products in some jurisdictions.',
      },
      {
        sourceId: 'yuka',
        sourceName: 'Yuka',
        fundingModel: 'subscription',
        stance: 'safe',
        reasoning:
          'Below the 1% EU concentration cap with no carcinogenicity evidence at typical use levels; rated low risk.',
      },
      {
        sourceId: 'inci-beauty',
        sourceName: 'INCI Beauty',
        fundingModel: 'ad_supported',
        stance: 'caution',
        reasoning:
          'Listed as a "to monitor" preservative; safe at low concentrations but considered avoidable when alternatives exist.',
      },
    ],
    notes: [
      { label: 'Common preservative', band: 'fair' },
      { label: 'EU concentration capped', band: 'good' },
    ],
  },
  {
    productId: 'prod-vitc',
    slug: 'ascorbic-acid',
    name: 'Ascorbic Acid',
    explanation:
      'Pure vitamin C. A potent antioxidant for brightening, but unstable in water once opened — can degrade into less effective (and slightly irritating) byproducts.',
    positions: [
      {
        sourceId: 'ewg',
        sourceName: 'EWG Skin Deep',
        fundingModel: 'nonprofit',
        stance: 'caution',
        reasoning:
          'Generally low concern, but flags potential irritation at the 10% concentration used here, especially for sensitive skin.',
      },
      {
        sourceId: 'yuka',
        sourceName: 'Yuka',
        fundingModel: 'subscription',
        stance: 'safe',
        reasoning: 'Recognized as a beneficial antioxidant ingredient; rated very low risk.',
      },
      {
        sourceId: 'inci-beauty',
        sourceName: 'INCI Beauty',
        fundingModel: 'ad_supported',
        stance: 'safe',
        reasoning: 'Listed as a "satisfactory" antioxidant; no usage restriction.',
      },
    ],
    notes: [
      { label: 'Stability concern after opening', band: 'fair' },
      { label: 'Antioxidant benefit', band: 'good' },
    ],
  },
];

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
  const productListingIds = new Set(
    SEED.filter((s) => s.productId === product.id).map((s) => s.listingId),
  );
  const productRatings = RATINGS.filter((r) => productListingIds.has(r.listingId)).map((r) => {
    const listing = LISTINGS.find((l) => l.id === r.listingId)!;
    return { sourceId: listing.sourceId, scoreRaw: r.scoreRaw };
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
}

export const mockRepository = new MockProductRepository();
