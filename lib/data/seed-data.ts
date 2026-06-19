// Single source of truth for Greenlens seed data.
//
// This file deliberately has *only* type-only imports so it can be loaded both
// by the bundled app (via the mock repository) and by the standalone Prisma
// seed script run under `node --experimental-strip-types`, where type stripping
// erases the imports and leaves a module with no runtime dependencies.
//
// Same-axis disagreements (the thing this product exists to surface) are baked
// into the data so demos are meaningful even with no real ingestion.

import type {
  Brand,
  IngredientFlag,
  Listing,
  Product,
  Rating,
  Source,
} from '../domain/types';

// ─── Sources ────────────────────────────────────────────────────────────────
// Each rating source with its native scale and funding model. Funding model is
// shown next to every rating in the UI — that's the point.

export const SOURCES: Source[] = [
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
  // show. These will be replaced by real Open Beauty Facts signals + ad-hoc
  // rater data later.
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
  // Greenlens's own derived ingredient-safety signal, computed from open EU
  // regulatory data over each product's INCI list (see lib/ingestion/hazard).
  // Kept in sync with HAZARD_SOURCE there; duplicated inline so this file keeps
  // its type-only imports (it's loaded under node's type-stripping seed run).
  {
    id: 'ingredient-hazard',
    name: 'Greenlens Ingredient Scan',
    axis: 'ingredient_safety',
    scaleMin: 0,
    scaleMax: 100,
    scaleDirection: 'higher_is_better',
    fundingModel: 'independent',
  },
  // Brand-level cruelty-free / vegan certification (Leaping Bunny, PETA), on the
  // labor/ethics axis. Kept in sync with BRAND_ETHICS_SOURCE in
  // lib/ingestion/brand-ethics; duplicated inline so this file keeps its
  // type-only imports for the node type-stripping seed run.
  {
    id: 'cruelty-free',
    name: 'Cruelty-Free Certification',
    axis: 'labor',
    scaleMin: 0,
    scaleMax: 100,
    scaleDirection: 'higher_is_better',
    fundingModel: 'nonprofit',
  },
  // Greenlens's own derived packaging-recyclability signal, computed from open
  // packaging standards over each product's OBF packaging-material tags (see
  // lib/ingestion/packaging). On the packaging axis, so it can disagree with the
  // How2Recycle label rater. Kept in sync with PACKAGING_SOURCE there; duplicated
  // inline so this file keeps its type-only imports for the node seed run.
  {
    id: 'packaging-scan',
    name: 'Greenlens Packaging Scan',
    axis: 'packaging',
    scaleMin: 0,
    scaleMax: 100,
    scaleDirection: 'higher_is_better',
    fundingModel: 'independent',
  },
];

// ─── Brands ─────────────────────────────────────────────────────────────────

export const BRANDS: Brand[] = [
  { id: 'brand-lumen', name: 'Lumen Botanicals', aliases: ['Lumen', 'lumen botanicals'] },
  { id: 'brand-vela', name: 'Vela Skin', aliases: ['Vela', 'vela skin co.'] },
  { id: 'brand-fern', name: 'Fern & Field', aliases: ['Fern', 'fern field', 'fern and field'] },
  // ── Real brands kept as seed data so the extension demo can match against
  //    pages someone actually has open. Ratings below are placeholders —
  //    real ingestion (EWG/Yuka/INCI/etc.) lands later.
  { id: 'brand-cerave', name: 'CeraVe', aliases: ['Cera Ve', 'cerave'] },
  { id: 'brand-ordinary', name: 'The Ordinary', aliases: ['theordinary', 'deciem', 'ordinary'] },
  { id: 'brand-olaplex', name: 'Olaplex', aliases: ['olaplex inc'] },
  { id: 'brand-neutrogena', name: 'Neutrogena', aliases: [] },
  { id: 'brand-aveeno', name: 'Aveeno', aliases: [] },
  { id: 'brand-maybelline', name: 'Maybelline', aliases: ['maybelline new york', 'maybelline ny'] },
  {
    id: 'brand-laroche',
    name: 'La Roche-Posay',
    aliases: ['la roche posay', 'larocheposay', 'la-roche-posay'],
  },
  { id: 'brand-eltamd', name: 'EltaMD', aliases: ['elta md', 'elta-md'] },
  { id: 'brand-burts', name: "Burt's Bees", aliases: ['burts bees', 'burt bees', 'burt s bees'] },
  { id: 'brand-drunk', name: 'Drunk Elephant', aliases: ['drunkelephant'] },
  { id: 'brand-elf', name: 'e.l.f.', aliases: ['elf', 'elf cosmetics', 'e l f', 'e.l.f. cosmetics'] },
  { id: 'brand-glossier', name: 'Glossier', aliases: ['glossier inc'] },
  { id: 'brand-pacifica', name: 'Pacifica', aliases: ['pacifica beauty'] },
];

// ─── Products ───────────────────────────────────────────────────────────────

export const PRODUCTS: Product[] = [
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
  // Real product, placeholder ratings — included as seed data so the extension
  // demo can resolve a live Amazon CeraVe page through the real matcher.
  {
    id: 'prod-cerave-mc',
    brandId: 'brand-cerave',
    displayName: 'Moisturizing Cream',
    category: 'moisturizer',
    gtin: '301871239019',
    sizeValue: 19,
    sizeUnit: 'oz',
    ingredients: [
      'Purified Water',
      'Glycerin',
      'Cetearyl Alcohol',
      'Caprylic/Capric Triglyceride',
      'Cetyl Alcohol',
      'Ceramide NP',
      'Ceramide AP',
      'Ceramide EOP',
      'Carbomer',
      'Dimethicone',
      'Behentrimonium Methosulfate',
      'Sodium Lauroyl Lactylate',
      'Cholesterol',
      'Phenoxyethanol',
      'Disodium EDTA',
      'Sodium Hyaluronate',
      'Tocopherol',
      'Phytosphingosine',
      'Xanthan Gum',
      'Ethylhexylglycerin',
    ],
  },
  {
    id: 'prod-ordinary-niacinamide',
    brandId: 'brand-ordinary',
    displayName: 'Niacinamide 10% + Zinc 1%',
    category: 'serum',
    gtin: '769915190168',
    sizeValue: 30,
    sizeUnit: 'ml',
    ingredients: [
      'Aqua',
      'Niacinamide',
      'Pentylene Glycol',
      'Zinc PCA',
      'Dimethyl Isosorbide',
      'Tamarindus Indica Seed Gum',
      'Xanthan Gum',
      'Carrageenan',
      'Acacia Senegal Gum',
      'Phenoxyethanol',
      'Chlorphenesin',
    ],
  },
  {
    id: 'prod-olaplex-3',
    brandId: 'brand-olaplex',
    displayName: 'No. 3 Hair Perfector',
    category: 'hair treatment',
    gtin: '850018802055',
    sizeValue: 100,
    sizeUnit: 'ml',
    ingredients: [
      'Water',
      'Bis-Aminopropyl Diglycol Dimaleate',
      'Cetearyl Alcohol',
      'Behentrimonium Methosulfate',
      'Cetyl Alcohol',
      'Phenoxyethanol',
      'Quaternium-91',
      'Fragrance',
      'Stearamidopropyl Dimethylamine',
      'Tocopheryl Acetate',
      'Polyquaternium-37',
    ],
  },
  {
    id: 'prod-neutrogena-hydroboost',
    brandId: 'brand-neutrogena',
    displayName: 'Hydro Boost Water Gel',
    category: 'moisturizer',
    gtin: '070501114124',
    sizeValue: 1.7,
    sizeUnit: 'oz',
    ingredients: [
      'Water',
      'Dimethicone',
      'Glycerin',
      'Dimethicone/Vinyl Dimethicone Crosspolymer',
      'Phenoxyethanol',
      'Cetearyl Olivate',
      'Sorbitan Olivate',
      'Carbomer',
      'Sodium Hyaluronate',
      'Ethylhexylglycerin',
      'Blue 1',
    ],
  },
  {
    id: 'prod-aveeno-daily',
    brandId: 'brand-aveeno',
    displayName: 'Daily Moisturizing Lotion',
    category: 'lotion',
    gtin: '381370036159',
    sizeValue: 18,
    sizeUnit: 'oz',
    ingredients: [
      'Water',
      'Glycerin',
      'Distearyldimonium Chloride',
      'Petrolatum',
      'Isopropyl Palmitate',
      'Cetyl Alcohol',
      'Dimethicone',
      'Sodium Chloride',
      'Avena Sativa Kernel Flour',
      'Benzyl Alcohol',
    ],
  },
  {
    id: 'prod-maybelline-skyhigh',
    brandId: 'brand-maybelline',
    displayName: 'Lash Sensational Sky High Mascara',
    category: 'mascara',
    gtin: '041554577778',
    sizeValue: 7.2,
    sizeUnit: 'ml',
    ingredients: [
      'Aqua',
      'Acacia Senegal Gum',
      'Cera Alba',
      'Caprylic/Capric Triglyceride',
      'Stearic Acid',
      'Palmitic Acid',
      'Glyceryl Stearate',
      'Iron Oxides',
      'Phenoxyethanol',
      'Tocopherol',
    ],
  },
  {
    id: 'prod-laroche-toleriane',
    brandId: 'brand-laroche',
    displayName: 'Toleriane Hydrating Gentle Cleanser',
    category: 'cleanser',
    gtin: '883140500179',
    sizeValue: 13.5,
    sizeUnit: 'oz',
    ingredients: [
      'Aqua',
      'Glycerin',
      'Sodium Cocoamphoacetate',
      'Niacinamide',
      'Polysorbate 20',
      'PEG-6 Caprylic/Capric Glycerides',
      'Sodium Chloride',
      'Sodium Benzoate',
      'Ceramide NP',
      'Disodium EDTA',
    ],
  },
  {
    id: 'prod-eltamd-uvclear',
    brandId: 'brand-eltamd',
    displayName: 'UV Clear Broad-Spectrum SPF 46',
    category: 'sunscreen',
    gtin: '827854005025',
    sizeValue: 1.7,
    sizeUnit: 'oz',
    ingredients: [
      'Zinc Oxide',
      'Octinoxate',
      'Cyclopentasiloxane',
      'Niacinamide',
      'Sodium Hyaluronate',
      'Tocopheryl Acetate',
      'Lactic Acid',
      'Phenoxyethanol',
      'Ethylhexylglycerin',
    ],
  },
  {
    id: 'prod-burts-lipbalm',
    brandId: 'brand-burts',
    displayName: 'Beeswax Lip Balm',
    category: 'lip balm',
    gtin: '792850300033',
    sizeValue: 4.25,
    sizeUnit: 'g',
    ingredients: [
      'Helianthus Annuus Seed Oil',
      'Cera Alba',
      'Coconut Oil',
      'Lanolin',
      'Tocopherol',
      'Rosmarinus Officinalis Leaf Extract',
      'Mentha Piperita Oil',
      'Limonene',
      'Linalool',
    ],
  },
  {
    id: 'prod-drunk-protini',
    brandId: 'brand-drunk',
    displayName: 'Protini Polypeptide Cream',
    category: 'moisturizer',
    gtin: '811236031104',
    sizeValue: 50,
    sizeUnit: 'ml',
    ingredients: [
      'Water',
      'Pyrus Malus (Apple) Fruit Extract',
      'Glycerin',
      'Caprylic/Capric Triglyceride',
      'Cetearyl Olivate',
      'Sorbitan Olivate',
      'Soluble Collagen',
      'Pisum Sativum (Pea) Extract',
      'Aspergillus/Soybean Ferment Extract',
      'Sh-Polypeptide-1',
      'Niacinamide',
      'Sodium Hyaluronate',
      'Phenoxyethanol',
    ],
  },
  {
    id: 'prod-elf-putty',
    brandId: 'brand-elf',
    displayName: 'Putty Primer',
    category: 'primer',
    gtin: '609309090326',
    sizeValue: 0.74,
    sizeUnit: 'oz',
    ingredients: [
      'Caprylic/Capric Triglyceride',
      'Squalane',
      'Dimethicone',
      'Disteardimonium Hectorite',
      'Polyethylene',
      'Mica',
      'Silica',
      'Iron Oxides',
      'Tocopherol',
      'Lavandula Angustifolia Oil',
    ],
  },
  {
    id: 'prod-glossier-balm',
    brandId: 'brand-glossier',
    displayName: 'Balm Dotcom',
    category: 'lip balm',
    gtin: '850006094233',
    sizeValue: 15,
    sizeUnit: 'ml',
    ingredients: [
      'Castor Seed Oil',
      'Beeswax',
      'Lanolin',
      'Cera Microcristallina',
      'Phenoxyethanol',
      'Tocopherol',
      'Sucrose Tetrastearate Triacetate',
      'Fragrance',
    ],
  },
  {
    id: 'prod-pacifica-collagen',
    brandId: 'brand-pacifica',
    displayName: 'Vegan Collagen Plumping Face Cream',
    category: 'moisturizer',
    gtin: '687735901002',
    sizeValue: 1.7,
    sizeUnit: 'oz',
    ingredients: [
      'Water',
      'Glycerin',
      'Pseudoalteromonas Ferment Extract',
      'Sodium Hyaluronate',
      'Cetearyl Alcohol',
      'Squalane',
      'Aloe Barbadensis Leaf Juice',
      'Tocopherol',
      'Phenoxyethanol',
      'Fragrance',
    ],
  },
];

// ─── Listings + Ratings ─────────────────────────────────────────────────────

export const FETCHED = new Date('2026-06-01T00:00:00Z');
export const INGESTED = new Date('2026-06-01T00:05:00Z');

export interface SeedRating {
  listingId: string;
  productId: string;
  sourceId: string;
  scoreRaw: number;
  scoreLabel?: string;
}

export const SEED: SeedRating[] = [
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

  // ── CeraVe Moisturizing Cream ────────────────────────────────────────────
  { listingId: 'l-cerave-ewg', productId: 'prod-cerave-mc', sourceId: 'ewg', scoreRaw: 3, scoreLabel: 'Low concern' },
  { listingId: 'l-cerave-yuka', productId: 'prod-cerave-mc', sourceId: 'yuka', scoreRaw: 78, scoreLabel: 'Good' },
  { listingId: 'l-cerave-inci', productId: 'prod-cerave-mc', sourceId: 'inci-beauty', scoreRaw: 14, scoreLabel: 'Satisfactory' },
  { listingId: 'l-cerave-eco', productId: 'prod-cerave-mc', sourceId: 'obf-eco', scoreRaw: 52 },
  { listingId: 'l-cerave-labor', productId: 'prod-cerave-mc', sourceId: 'good-on-you', scoreRaw: 2 },
  { listingId: 'l-cerave-pkg', productId: 'prod-cerave-mc', sourceId: 'how2recycle', scoreRaw: 48 },

  // ── The Ordinary Niacinamide — clean indie skincare ─────────────────────
  // safety: high agreement; environmental + labor strong (Deciem owned by Estée Lauder so labor is mixed)
  { listingId: 'l-ord-ewg', productId: 'prod-ordinary-niacinamide', sourceId: 'ewg', scoreRaw: 1, scoreLabel: 'Low concern' },
  { listingId: 'l-ord-yuka', productId: 'prod-ordinary-niacinamide', sourceId: 'yuka', scoreRaw: 93, scoreLabel: 'Excellent' },
  { listingId: 'l-ord-inci', productId: 'prod-ordinary-niacinamide', sourceId: 'inci-beauty', scoreRaw: 18 },
  { listingId: 'l-ord-eco', productId: 'prod-ordinary-niacinamide', sourceId: 'obf-eco', scoreRaw: 64 },
  { listingId: 'l-ord-labor', productId: 'prod-ordinary-niacinamide', sourceId: 'good-on-you', scoreRaw: 2 },
  { listingId: 'l-ord-pkg', productId: 'prod-ordinary-niacinamide', sourceId: 'how2recycle', scoreRaw: 62 },

  // ── Olaplex No. 3 — past EWG/Yuka split over the lilial reformulation ───
  { listingId: 'l-ola-ewg', productId: 'prod-olaplex-3', sourceId: 'ewg', scoreRaw: 5, scoreLabel: 'Moderate concern' },
  { listingId: 'l-ola-yuka', productId: 'prod-olaplex-3', sourceId: 'yuka', scoreRaw: 70, scoreLabel: 'Good' },
  { listingId: 'l-ola-inci', productId: 'prod-olaplex-3', sourceId: 'inci-beauty', scoreRaw: 12 },
  { listingId: 'l-ola-eco', productId: 'prod-olaplex-3', sourceId: 'obf-eco', scoreRaw: 58 },
  { listingId: 'l-ola-labor', productId: 'prod-olaplex-3', sourceId: 'good-on-you', scoreRaw: 3 },
  { listingId: 'l-ola-pkg', productId: 'prod-olaplex-3', sourceId: 'how2recycle', scoreRaw: 55 },

  // ── Neutrogena Hydro Boost — J&J brand; classic EWG vs Yuka split ──────
  { listingId: 'l-neu-ewg', productId: 'prod-neutrogena-hydroboost', sourceId: 'ewg', scoreRaw: 6, scoreLabel: 'Moderate concern' },
  { listingId: 'l-neu-yuka', productId: 'prod-neutrogena-hydroboost', sourceId: 'yuka', scoreRaw: 65, scoreLabel: 'Good' },
  { listingId: 'l-neu-inci', productId: 'prod-neutrogena-hydroboost', sourceId: 'inci-beauty', scoreRaw: 10 },
  { listingId: 'l-neu-eco', productId: 'prod-neutrogena-hydroboost', sourceId: 'obf-eco', scoreRaw: 46 },
  { listingId: 'l-neu-labor', productId: 'prod-neutrogena-hydroboost', sourceId: 'good-on-you', scoreRaw: 2 },
  { listingId: 'l-neu-pkg', productId: 'prod-neutrogena-hydroboost', sourceId: 'how2recycle', scoreRaw: 38 },

  // ── Aveeno Daily Moisturizing — also J&J; oat extract scores well ──────
  { listingId: 'l-ave-ewg', productId: 'prod-aveeno-daily', sourceId: 'ewg', scoreRaw: 4, scoreLabel: 'Moderate concern' },
  { listingId: 'l-ave-yuka', productId: 'prod-aveeno-daily', sourceId: 'yuka', scoreRaw: 72, scoreLabel: 'Good' },
  { listingId: 'l-ave-inci', productId: 'prod-aveeno-daily', sourceId: 'inci-beauty', scoreRaw: 13 },
  { listingId: 'l-ave-eco', productId: 'prod-aveeno-daily', sourceId: 'obf-eco', scoreRaw: 50 },
  { listingId: 'l-ave-labor', productId: 'prod-aveeno-daily', sourceId: 'good-on-you', scoreRaw: 2 },
  { listingId: 'l-ave-pkg', productId: 'prod-aveeno-daily', sourceId: 'how2recycle', scoreRaw: 45 },

  // ── Maybelline Sky High — L'Oréal brand; mascara conflicts on safety ───
  { listingId: 'l-may-ewg', productId: 'prod-maybelline-skyhigh', sourceId: 'ewg', scoreRaw: 5, scoreLabel: 'Moderate concern' },
  { listingId: 'l-may-yuka', productId: 'prod-maybelline-skyhigh', sourceId: 'yuka', scoreRaw: 60, scoreLabel: 'Fair' },
  { listingId: 'l-may-inci', productId: 'prod-maybelline-skyhigh', sourceId: 'inci-beauty', scoreRaw: 9 },
  { listingId: 'l-may-eco', productId: 'prod-maybelline-skyhigh', sourceId: 'obf-eco', scoreRaw: 42 },
  { listingId: 'l-may-labor', productId: 'prod-maybelline-skyhigh', sourceId: 'good-on-you', scoreRaw: 3 },
  { listingId: 'l-may-pkg', productId: 'prod-maybelline-skyhigh', sourceId: 'how2recycle', scoreRaw: 40 },

  // ── La Roche-Posay Toleriane — L'Oréal too; gentle formula scores well ─
  { listingId: 'l-lrp-ewg', productId: 'prod-laroche-toleriane', sourceId: 'ewg', scoreRaw: 2, scoreLabel: 'Low concern' },
  { listingId: 'l-lrp-yuka', productId: 'prod-laroche-toleriane', sourceId: 'yuka', scoreRaw: 85, scoreLabel: 'Excellent' },
  { listingId: 'l-lrp-inci', productId: 'prod-laroche-toleriane', sourceId: 'inci-beauty', scoreRaw: 17 },
  { listingId: 'l-lrp-eco', productId: 'prod-laroche-toleriane', sourceId: 'obf-eco', scoreRaw: 56 },
  { listingId: 'l-lrp-labor', productId: 'prod-laroche-toleriane', sourceId: 'good-on-you', scoreRaw: 3 },
  { listingId: 'l-lrp-pkg', productId: 'prod-laroche-toleriane', sourceId: 'how2recycle', scoreRaw: 50 },

  // ── EltaMD UV Clear — high-trust derm sunscreen; octinoxate keeps EWG flagging ──
  { listingId: 'l-elt-ewg', productId: 'prod-eltamd-uvclear', sourceId: 'ewg', scoreRaw: 4, scoreLabel: 'Moderate concern' },
  { listingId: 'l-elt-yuka', productId: 'prod-eltamd-uvclear', sourceId: 'yuka', scoreRaw: 75, scoreLabel: 'Good' },
  { listingId: 'l-elt-inci', productId: 'prod-eltamd-uvclear', sourceId: 'inci-beauty', scoreRaw: 14 },
  { listingId: 'l-elt-eco', productId: 'prod-eltamd-uvclear', sourceId: 'obf-eco', scoreRaw: 48 },
  { listingId: 'l-elt-labor', productId: 'prod-eltamd-uvclear', sourceId: 'good-on-you', scoreRaw: 2 },
  { listingId: 'l-elt-pkg', productId: 'prod-eltamd-uvclear', sourceId: 'how2recycle', scoreRaw: 52 },

  // ── Burt's Bees Beeswax Lip Balm — Clorox-owned; nat'l formula ─────────
  { listingId: 'l-bur-ewg', productId: 'prod-burts-lipbalm', sourceId: 'ewg', scoreRaw: 2, scoreLabel: 'Low concern' },
  { listingId: 'l-bur-yuka', productId: 'prod-burts-lipbalm', sourceId: 'yuka', scoreRaw: 88, scoreLabel: 'Excellent' },
  { listingId: 'l-bur-inci', productId: 'prod-burts-lipbalm', sourceId: 'inci-beauty', scoreRaw: 17 },
  { listingId: 'l-bur-eco', productId: 'prod-burts-lipbalm', sourceId: 'obf-eco', scoreRaw: 70 },
  { listingId: 'l-bur-labor', productId: 'prod-burts-lipbalm', sourceId: 'good-on-you', scoreRaw: 3 },
  { listingId: 'l-bur-pkg', productId: 'prod-burts-lipbalm', sourceId: 'how2recycle', scoreRaw: 78 },

  // ── Drunk Elephant Protini — premium "clean"; raters mostly agree on safety
  { listingId: 'l-de-ewg', productId: 'prod-drunk-protini', sourceId: 'ewg', scoreRaw: 1, scoreLabel: 'Low concern' },
  { listingId: 'l-de-yuka', productId: 'prod-drunk-protini', sourceId: 'yuka', scoreRaw: 91, scoreLabel: 'Excellent' },
  { listingId: 'l-de-inci', productId: 'prod-drunk-protini', sourceId: 'inci-beauty', scoreRaw: 17 },
  { listingId: 'l-de-eco', productId: 'prod-drunk-protini', sourceId: 'obf-eco', scoreRaw: 60 }, // Shiseido-owned
  { listingId: 'l-de-labor', productId: 'prod-drunk-protini', sourceId: 'good-on-you', scoreRaw: 3 },
  { listingId: 'l-de-pkg', productId: 'prod-drunk-protini', sourceId: 'how2recycle', scoreRaw: 62 },

  // ── e.l.f. Putty Primer — budget viral; silicones split EWG and Yuka ────
  { listingId: 'l-elf-ewg', productId: 'prod-elf-putty', sourceId: 'ewg', scoreRaw: 5, scoreLabel: 'Moderate concern' },
  { listingId: 'l-elf-yuka', productId: 'prod-elf-putty', sourceId: 'yuka', scoreRaw: 55, scoreLabel: 'Fair' },
  { listingId: 'l-elf-inci', productId: 'prod-elf-putty', sourceId: 'inci-beauty', scoreRaw: 10 },
  { listingId: 'l-elf-eco', productId: 'prod-elf-putty', sourceId: 'obf-eco', scoreRaw: 40 },
  // e.l.f. is genuinely strong on ESG (vegan/cruelty-free, Leaping Bunny)
  { listingId: 'l-elf-labor', productId: 'prod-elf-putty', sourceId: 'good-on-you', scoreRaw: 4 },
  { listingId: 'l-elf-pkg', productId: 'prod-elf-putty', sourceId: 'how2recycle', scoreRaw: 38 },

  // ── Glossier Balm Dotcom — lanolin + fragrance keep safety mid ──────────
  { listingId: 'l-glo-ewg', productId: 'prod-glossier-balm', sourceId: 'ewg', scoreRaw: 4, scoreLabel: 'Moderate concern' },
  { listingId: 'l-glo-yuka', productId: 'prod-glossier-balm', sourceId: 'yuka', scoreRaw: 62, scoreLabel: 'Fair' },
  { listingId: 'l-glo-inci', productId: 'prod-glossier-balm', sourceId: 'inci-beauty', scoreRaw: 11 },
  { listingId: 'l-glo-eco', productId: 'prod-glossier-balm', sourceId: 'obf-eco', scoreRaw: 52 },
  { listingId: 'l-glo-labor', productId: 'prod-glossier-balm', sourceId: 'good-on-you', scoreRaw: 3 },
  { listingId: 'l-glo-pkg', productId: 'prod-glossier-balm', sourceId: 'how2recycle', scoreRaw: 50 },

  // ── Pacifica Vegan Collagen — clean/vegan/independent; raters mostly agree
  { listingId: 'l-pac-ewg', productId: 'prod-pacifica-collagen', sourceId: 'ewg', scoreRaw: 2, scoreLabel: 'Low concern' },
  { listingId: 'l-pac-yuka', productId: 'prod-pacifica-collagen', sourceId: 'yuka', scoreRaw: 84, scoreLabel: 'Excellent' },
  { listingId: 'l-pac-inci', productId: 'prod-pacifica-collagen', sourceId: 'inci-beauty', scoreRaw: 16 },
  { listingId: 'l-pac-eco', productId: 'prod-pacifica-collagen', sourceId: 'obf-eco', scoreRaw: 72 },
  { listingId: 'l-pac-labor', productId: 'prod-pacifica-collagen', sourceId: 'good-on-you', scoreRaw: 4 },
  { listingId: 'l-pac-pkg', productId: 'prod-pacifica-collagen', sourceId: 'how2recycle', scoreRaw: 68 },
];

export const LISTINGS: Listing[] = SEED.map((s) => {
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

export const RATINGS: Rating[] = SEED.map((s) => ({
  id: `r-${s.listingId}`,
  listingId: s.listingId,
  scoreRaw: s.scoreRaw,
  scoreLabel: s.scoreLabel,
  ingestedAt: INGESTED,
}));

// ─── Ingredient flags ───────────────────────────────────────────────────────
// Per-rater stances on specific ingredients. The structure is the real
// deliverable: each rater's voice is preserved with its funding model, never
// blended.

export const INGREDIENT_FLAGS: IngredientFlag[] = [
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

  // ── Flags on real catalog entries — placeholder per-rater stances so the
  //    extension's flag screen has content for live demos.

  {
    productId: 'prod-cerave-mc',
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
          'Flags moderate irritation concerns and notes restricted use in some leave-on products in the EU.',
      },
      {
        sourceId: 'yuka',
        sourceName: 'Yuka',
        fundingModel: 'subscription',
        stance: 'safe',
        reasoning:
          'Below the 1% EU concentration cap; rated low risk at typical formulation levels.',
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
    productId: 'prod-drunk-protini',
    slug: 'phenoxyethanol',
    name: 'Phenoxyethanol',
    explanation:
      'The preservative that holds most water-based skincare together — used at well under 1% in Drunk Elephant\'s formula. Raters split mostly on principle, not concentration.',
    positions: [
      {
        sourceId: 'ewg',
        sourceName: 'EWG Skin Deep',
        fundingModel: 'nonprofit',
        stance: 'caution',
        reasoning:
          'Moderate irritation concern listed; restricted use noted in some EU leave-on products.',
      },
      {
        sourceId: 'yuka',
        sourceName: 'Yuka',
        fundingModel: 'subscription',
        stance: 'safe',
        reasoning:
          'Concentration here is well below the 1% EU cap; rated low risk.',
      },
      {
        sourceId: 'inci-beauty',
        sourceName: 'INCI Beauty',
        fundingModel: 'ad_supported',
        stance: 'caution',
        reasoning: 'Listed as "to monitor" — safe at this level but avoidable when alternatives exist.',
      },
    ],
    notes: [
      { label: 'Industry standard preservative', band: 'fair' },
      { label: 'Drunk Elephant brand prides itself on "clean"', band: 'good' },
    ],
  },

  {
    productId: 'prod-olaplex-3',
    slug: 'fragrance',
    name: 'Fragrance',
    explanation:
      '"Fragrance" or "Parfum" is a regulatory shorthand for a proprietary blend of scent compounds that brands aren\'t required to disclose individually. Raters disagree on whether to flag the entire category or just specific allergens.',
    positions: [
      {
        sourceId: 'ewg',
        sourceName: 'EWG Skin Deep',
        fundingModel: 'nonprofit',
        stance: 'concern',
        reasoning:
          'Lack of disclosure means hidden allergens, sensitizers, and endocrine disruptors may be present. EWG defaults to high concern for any opaque "Fragrance" listing.',
      },
      {
        sourceId: 'yuka',
        sourceName: 'Yuka',
        fundingModel: 'subscription',
        stance: 'caution',
        reasoning:
          'Flags hidden composition; recommends fragrance-free alternatives for sensitive skin, but does not categorically treat as concern.',
      },
      {
        sourceId: 'inci-beauty',
        sourceName: 'INCI Beauty',
        fundingModel: 'ad_supported',
        stance: 'caution',
        reasoning:
          'Notes allergen disclosure requirements under EU rules but does not flag the category outright.',
      },
    ],
    notes: [
      { label: 'Allergen disclosure not required globally', band: 'poor' },
      { label: 'Reformulated post-lilial controversy (2022)', band: 'fair' },
    ],
  },

  {
    productId: 'prod-eltamd-uvclear',
    slug: 'octinoxate',
    name: 'Octinoxate',
    explanation:
      'A chemical UV filter (UVB protection) banned in Hawaii and parts of the Caribbean over coral-reef impact. Still permitted in the US and Europe at capped concentrations, but the environmental story is the live debate.',
    positions: [
      {
        sourceId: 'ewg',
        sourceName: 'EWG Skin Deep',
        fundingModel: 'nonprofit',
        stance: 'concern',
        reasoning:
          'Endocrine disruption signal in some in-vitro studies plus the documented coral-reef harm motivate a high concern rating regardless of formulation.',
      },
      {
        sourceId: 'yuka',
        sourceName: 'Yuka',
        fundingModel: 'subscription',
        stance: 'caution',
        reasoning:
          'Approved within FDA/EU concentration limits; flags hormonal-disruption signal as "to monitor."',
      },
      {
        sourceId: 'inci-beauty',
        sourceName: 'INCI Beauty',
        fundingModel: 'ad_supported',
        stance: 'safe',
        reasoning:
          'Within EU concentration cap; recognized UVB filter with established efficacy.',
      },
    ],
    notes: [
      { label: 'Banned: Hawaii, US Virgin Islands, Palau', band: 'bad' },
      { label: 'FDA + EU approved', band: 'good' },
    ],
  },
];
