import { describe, expect, it } from 'vitest';
import type { Brand } from '../domain/types';
import { generateCandidatePairs } from './blocking';
import type { MatchableItem } from './features';
import { clusterListings, resolveItem, type CatalogEntry } from './matcher';

// ─── toy corpus: 7 listings → 3 canonical products ──────────────────────────
//
// Product A (big brand): same UPC in three barcode formats (UPC-A 12-digit,
//   EAN-13 13-digit, GTIN-14 14-digit). After normalization they collide,
//   and even without it, brand + first-name-token agreement carries them.
//
// Product B (big brand): one full barcoded listing + one no-barcode listing
//   whose name has been aggressively stripped. The matcher should still
//   resolve via brand + ingredient Jaccard + a partial name match.
//
// Product C (indie): two no-barcode listings whose brand string is written
//   two ways ("Fern & Field" and "fern and field"). Whether they resolve
//   depends on the indie brand's alias being present — the coverage-bias
//   test below removes that alias and asserts the product fractures.

const BRANDS: Brand[] = [
  { id: 'big-a', name: 'BigA', aliases: [] },
  { id: 'big-b', name: 'BigB', aliases: [] },
  {
    id: 'indie',
    name: 'Fern & Field',
    aliases: ['fern field', 'fern and field', 'fern&field'],
  },
];

const LISTINGS: MatchableItem[] = [
  {
    id: 'A-upcA',
    brand: 'BigA',
    name: 'Daily Glow Serum 30ml',
    gtin: '012345678905',
    ingredients: ['aqua', 'ascorbic acid', 'glycerin', 'sodium hyaluronate', 'tocopherol'],
    sizeValue: 30,
    sizeUnit: 'ml',
  },
  {
    id: 'A-ean13',
    brand: 'BigA',
    name: 'Daily Glow Serum 30ml',
    gtin: '0012345678905',
    ingredients: ['aqua', 'ascorbic acid', 'glycerin', 'sodium hyaluronate', 'tocopherol'],
    sizeValue: 30,
    sizeUnit: 'ml',
  },
  {
    id: 'A-gtin14',
    brand: 'BigA',
    name: 'Daily Glow Serum 30ml',
    gtin: '00012345678905',
    ingredients: ['aqua', 'ascorbic acid', 'glycerin', 'sodium hyaluronate', 'tocopherol'],
    sizeValue: 30,
    sizeUnit: 'ml',
  },
  {
    id: 'B-full',
    brand: 'BigB',
    name: 'Ceramide Repair Cream 50ml',
    gtin: '098765432109',
    ingredients: ['water', 'glycerin', 'ceramide np', 'niacinamide', 'squalane'],
    sizeValue: 50,
    sizeUnit: 'ml',
  },
  {
    id: 'B-stripped',
    brand: 'BigB',
    name: 'Repair Cream',
    ingredients: ['water', 'glycerin', 'ceramide np', 'niacinamide', 'squalane'],
  },
  {
    id: 'C-name1',
    brand: 'Fern & Field',
    name: 'Bare Ceramide Cream',
    ingredients: ['aqua', 'glycerin', 'ceramide np', 'squalane', 'panthenol'],
  },
  {
    id: 'C-name2',
    brand: 'fern and field',
    name: 'Bare Ceramide Cream (fragrance-free)',
    ingredients: ['aqua', 'glycerin', 'ceramide np', 'squalane', 'panthenol'],
  },
];

const TRUTH = {
  A: new Set(['A-upcA', 'A-ean13', 'A-gtin14']),
  B: new Set(['B-full', 'B-stripped']),
  C: new Set(['C-name1', 'C-name2']),
} as const;

function clusterContaining(clusters: string[][], id: string): Set<string> {
  const c = clusters.find((c) => c.includes(id));
  if (!c) throw new Error(`no cluster contains ${id}`);
  return new Set(c);
}

describe('matcher / blocking — cuts the search space', () => {
  it('reduces 21 possible pairs to a handful', () => {
    const pairs = generateCandidatePairs(LISTINGS, BRANDS);
    // 7 choose 2 = 21 in the worst case.
    expect(pairs.length).toBeLessThanOrEqual(8);
    // We should still surface every intra-cluster pair we'll need to score.
    const sigs = new Set(pairs.map((p) => `${p.a}|${p.b}`));
    const has = (a: string, b: string) =>
      sigs.has(a < b ? `${a}|${b}` : `${b}|${a}`);
    // A's three listings — three intra-cluster pairs
    expect(has('A-upcA', 'A-ean13')).toBe(true);
    expect(has('A-upcA', 'A-gtin14')).toBe(true);
    expect(has('A-ean13', 'A-gtin14')).toBe(true);
    // B and C pairs surface via brand fallback / brand+token
    expect(has('B-full', 'B-stripped')).toBe(true);
    expect(has('C-name1', 'C-name2')).toBe(true);
  });

  it('does not surface cross-product pairs', () => {
    const pairs = generateCandidatePairs(LISTINGS, BRANDS);
    const sigs = new Set(pairs.map((p) => `${p.a}|${p.b}`));
    const has = (a: string, b: string) =>
      sigs.has(a < b ? `${a}|${b}` : `${b}|${a}`);
    // A and B share nothing — different brands, different barcodes
    expect(has('A-upcA', 'B-full')).toBe(false);
    expect(has('A-gtin14', 'C-name1')).toBe(false);
  });
});

describe('matcher / clustering — resolves the 7 listings into 3 products', () => {
  it('produces exactly three clusters with the right membership', () => {
    const result = clusterListings(LISTINGS, BRANDS);
    expect(result.clusters).toHaveLength(3);
    expect(clusterContaining(result.clusters, 'A-upcA')).toEqual(TRUTH.A);
    expect(clusterContaining(result.clusters, 'B-full')).toEqual(TRUTH.B);
    expect(clusterContaining(result.clusters, 'C-name1')).toEqual(TRUTH.C);
  });

  it('catches the no-barcode listing into its product via name + ingredients', () => {
    const result = clusterListings(LISTINGS, BRANDS);
    const bCluster = clusterContaining(result.clusters, 'B-stripped');
    expect(bCluster).toEqual(TRUTH.B);
  });
});

describe('matcher / coverage bias — the matcher is worse on the tail, and we surface it', () => {
  it('drops only the indie brand alias → product C fractures while A and B stay resolved', () => {
    const biased: Brand[] = BRANDS.map((b) =>
      b.id === 'indie'
        ? { ...b, aliases: ['fern field', 'fern&field'] } // 'fern and field' removed
        : b,
    );
    const result = clusterListings(LISTINGS, biased);

    // The indie product splits into two singletons.
    const c1 = clusterContaining(result.clusters, 'C-name1');
    const c2 = clusterContaining(result.clusters, 'C-name2');
    expect(c1).not.toEqual(c2);
    expect(c1.has('C-name2')).toBe(false);
    expect(c2.has('C-name1')).toBe(false);

    // Big brands are unaffected — recall on the tail is genuinely worse, and
    // this is the fairness finding CLAUDE.md says to surface, not hide.
    expect(clusterContaining(result.clusters, 'A-upcA')).toEqual(TRUTH.A);
    expect(clusterContaining(result.clusters, 'B-full')).toEqual(TRUTH.B);
  });
});

describe('matcher / resolveItem — live extension lookup', () => {
  // A small canonical catalog: project the three "true" products into entries.
  const catalog: CatalogEntry[] = [
    {
      productId: 'prod-A',
      id: 'cat-A',
      brand: 'BigA',
      name: 'Daily Glow Serum',
      gtin: '012345678905',
      ingredients: ['aqua', 'ascorbic acid', 'glycerin', 'sodium hyaluronate', 'tocopherol'],
      sizeValue: 30,
      sizeUnit: 'ml',
    },
    {
      productId: 'prod-B',
      id: 'cat-B',
      brand: 'BigB',
      name: 'Ceramide Repair Cream',
      gtin: '098765432109',
      ingredients: ['water', 'glycerin', 'ceramide np', 'niacinamide', 'squalane'],
      sizeValue: 50,
      sizeUnit: 'ml',
    },
    {
      productId: 'prod-C',
      id: 'cat-C',
      brand: 'Fern & Field',
      name: 'Bare Ceramide Cream',
      ingredients: ['aqua', 'glycerin', 'ceramide np', 'squalane', 'panthenol'],
    },
  ];

  it('finds product A from any of the three barcode formats', () => {
    for (const l of LISTINGS.filter((x) => x.id.startsWith('A-'))) {
      const r = resolveItem(l, catalog, BRANDS);
      expect(r?.productId).toBe('prod-A');
    }
  });

  it('finds product B from the stripped-name listing without a barcode', () => {
    const stripped = LISTINGS.find((l) => l.id === 'B-stripped')!;
    const r = resolveItem(stripped, catalog, BRANDS);
    expect(r?.productId).toBe('prod-B');
  });

  it('returns null when nothing clears the threshold (data gap, not a false match)', () => {
    const stranger: MatchableItem = {
      id: 'unknown',
      brand: 'Nobody',
      name: 'Mystery Lotion',
      ingredients: ['water', 'unobtainium', 'magic'],
    };
    expect(resolveItem(stranger, catalog, BRANDS)).toBeNull();
  });

  // Regression: a variant SKU page (refill, mini, etc.) reports a different
  // UPC than the canonical 50ml. An earlier version treated GTIN mismatch
  // as 6.0-weight negative evidence and dragged the score below threshold.
  // We now treat mismatch as "no information" and let brand+name decide.
  it('matches a variant SKU (different GTIN) when brand + name align', () => {
    const variantSighting: MatchableItem = {
      id: 'sighting',
      brand: 'BigB',
      name: 'BigB Ceramide Repair Cream Refill 100ml',
      // Different UPC than the canonical entry — this is a refill SKU.
      gtin: '086556004739',
      ingredients: [
        'water', 'glycerin', 'ceramide np', 'niacinamide', 'squalane',
      ],
    };
    // The catalog Product-B entry has gtin '098765432109' (the 50ml version).
    const r = resolveItem(variantSighting, catalog, BRANDS);
    expect(r?.productId).toBe('prod-B');
  });

  // Regression: a real Amazon page has a much longer title and ingredient list
  // than our canonical catalog entry. An earlier version using Jaccard on
  // ingredients dragged the score below threshold even though every catalog
  // ingredient was present in the page. Overlap coefficient handles the
  // asymmetric case correctly.
  it('matches when the sighting has many more ingredients than the catalog (real-world asymmetry)', () => {
    const longSighting: MatchableItem = {
      id: 'amzn-longish',
      brand: 'BigB',
      name:
        'BigB Ceramide Repair Cream 50ml — Firming, Hydrating, Dermatologist-Tested, ' +
        'Fragrance Free, Non-Comedogenic, For Normal to Dry Skin',
      ingredients: [
        // catalog's 5 ingredients
        'water', 'glycerin', 'ceramide np', 'niacinamide', 'squalane',
        // plus a long INCI tail the page would naturally include
        'cetearyl alcohol', 'caprylic capric triglyceride', 'phenoxyethanol',
        'dimethicone', 'tocopherol', 'sodium hyaluronate', 'carbomer',
        'disodium edta', 'xanthan gum', 'panthenol', 'arginine',
        'butylene glycol', 'citric acid', 'sodium hydroxide',
      ],
    };
    const r = resolveItem(longSighting, catalog, BRANDS);
    expect(r?.productId).toBe('prod-B');
  });
});
