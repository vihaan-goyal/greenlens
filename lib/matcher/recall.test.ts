import { describe, expect, it } from 'vitest';
import type { Brand } from '../domain/types';
import type { CatalogEntry } from './matcher';
import {
  aggregateByBucket,
  brandSizeByProduct,
  bucketForCount,
  classifyResolution,
  measureRecall,
  profileByBucket,
  type BucketCutoffs,
  type ProductOutcome,
} from './recall';

// ─── bucketing ────────────────────────────────────────────────────────────────

describe('recall / bucketForCount — maps brand size to a bucket', () => {
  it('uses the default cutoffs (tail 1 · small 2-4 · mid 5-19 · head 20+)', () => {
    expect(bucketForCount(1)).toBe('tail');
    expect(bucketForCount(2)).toBe('small');
    expect(bucketForCount(4)).toBe('small');
    expect(bucketForCount(5)).toBe('mid');
    expect(bucketForCount(19)).toBe('mid');
    expect(bucketForCount(20)).toBe('head');
    expect(bucketForCount(500)).toBe('head');
  });
});

// ─── brand size ───────────────────────────────────────────────────────────────

describe('recall / brandSizeByProduct — counts canonical-brand size', () => {
  const brands: Brand[] = [
    { id: 'big', name: 'BigCo', aliases: [] },
    { id: 'indie', name: 'Fern & Field', aliases: ['fern and field'] },
  ];
  const entry = (productId: string, brand: string): CatalogEntry => ({
    productId,
    id: productId,
    brand,
    name: `${brand} thing ${productId}`,
  });

  it('assigns every product the size of its canonical brand', () => {
    const catalog: CatalogEntry[] = [
      entry('p1', 'BigCo'),
      entry('p2', 'BigCo'),
      entry('p3', 'BigCo'),
      // Two spellings of the same indie brand canonicalize together → size 2.
      entry('p4', 'Fern & Field'),
      entry('p5', 'fern and field'),
      // Unknown brand, single product → its own brand of one.
      entry('p6', 'Nobody'),
    ];
    const size = brandSizeByProduct(catalog, brands);
    expect(size.get('p1')).toBe(3);
    expect(size.get('p3')).toBe(3);
    expect(size.get('p4')).toBe(2);
    expect(size.get('p5')).toBe(2);
    expect(size.get('p6')).toBe(1);
  });
});

// ─── classification ───────────────────────────────────────────────────────────

describe('recall / classifyResolution', () => {
  it('maps a resolver result to an outcome', () => {
    expect(classifyResolution('x', null)).toBe('unresolved');
    expect(classifyResolution('x', { productId: 'x', ambiguous: false })).toBe('correct');
    expect(classifyResolution('x', { productId: 'x', ambiguous: true })).toBe('ambiguous');
    expect(classifyResolution('x', { productId: 'y', ambiguous: false })).toBe('wrong');
  });
});

// ─── aggregation ──────────────────────────────────────────────────────────────

describe('recall / aggregateByBucket — recall math per bucket', () => {
  it('counts outcomes and computes recall = correct / total', () => {
    const o = (bucket: ProductOutcome['bucket'], outcome: ProductOutcome['outcome']): ProductOutcome => ({
      productId: 'p',
      brandSize: 1,
      bucket,
      outcome,
      confidence: outcome === 'unresolved' ? null : 0.8,
    });
    const outcomes: ProductOutcome[] = [
      o('head', 'correct'),
      o('head', 'correct'),
      o('head', 'correct'),
      o('head', 'ambiguous'),
      o('tail', 'correct'),
      o('tail', 'wrong'),
      o('tail', 'unresolved'),
      o('tail', 'unresolved'),
    ];
    const byBucket = aggregateByBucket(outcomes);
    const head = byBucket.find((b) => b.bucket === 'head')!;
    const tail = byBucket.find((b) => b.bucket === 'tail')!;
    const small = byBucket.find((b) => b.bucket === 'small')!;

    expect(head.total).toBe(4);
    expect(head.correct).toBe(3);
    expect(head.ambiguous).toBe(1);
    expect(head.recall).toBeCloseTo(0.75);

    expect(tail.total).toBe(4);
    expect(tail.correct).toBe(1);
    expect(tail.wrong).toBe(1);
    expect(tail.unresolved).toBe(2);
    expect(tail.recall).toBeCloseTo(0.25);

    // Empty bucket is reported with a 0 recall rather than NaN/dropped.
    expect(small.total).toBe(0);
    expect(small.recall).toBe(0);
  });
});

// ─── end-to-end: the fairness finding on a toy catalog ────────────────────────
//
// The real-data analog of the coverage-bias test. A head brand ships distinctly
// named, GTIN-bearing, ingredient-rich SKUs; an indie brand reuses one generic
// name across a tiny line with no barcodes and sparse ingredients. Round-tripping
// an Amazon-style sighting (GTIN dropped, as a real product page would) resolves
// the head brand cleanly but leaves the indie products in a same-name near-tie —
// a genuine recall gap that tracks data quality, which correlates with brand size.

describe('recall / measureRecall — surfaces a real recall gap on the tail', () => {
  const brands: Brand[] = [
    { id: 'big', name: 'BigCo', aliases: [] },
    { id: 'tiny', name: 'TinyCo', aliases: [] },
  ];

  // Custom cutoffs so the 3-SKU head brand and the 2-SKU indie land in different
  // buckets in this small corpus.
  const cutoffs: BucketCutoffs = { small: 2, mid: 3, head: 4 };

  const catalog: CatalogEntry[] = [
    {
      productId: 'big-serum', id: 'big-serum', brand: 'BigCo', name: 'Daily Glow Serum',
      gtin: '012345678905',
      ingredients: ['aqua', 'ascorbic acid', 'glycerin', 'sodium hyaluronate', 'tocopherol'],
    },
    {
      productId: 'big-cream', id: 'big-cream', brand: 'BigCo', name: 'Ceramide Repair Cream',
      gtin: '098765432109',
      ingredients: ['water', 'glycerin', 'ceramide np', 'niacinamide', 'squalane'],
    },
    {
      productId: 'big-cleanser', id: 'big-cleanser', brand: 'BigCo', name: 'Gentle Foaming Cleanser',
      gtin: '076543210981',
      ingredients: ['water', 'cocamidopropyl betaine', 'glycerin', 'sodium chloride', 'citric acid'],
    },
    // Indie line: same generic name twice, no barcode, two ingredients (below the
    // matcher's ≥5 ingredient gate, so that signal drops out entirely).
    {
      productId: 'tiny-a', id: 'tiny-a', brand: 'TinyCo', name: 'Shea Butter',
      ingredients: ['shea butter', 'fragrance'],
    },
    {
      productId: 'tiny-b', id: 'tiny-b', brand: 'TinyCo', name: 'Shea Butter',
      ingredients: ['shea butter', 'fragrance'],
    },
  ];

  const sizeByProduct = brandSizeByProduct(catalog, brands);

  it('resolves the head brand cleanly and fails the indie near-ties', () => {
    const outcomes = measureRecall(catalog, catalog, brands, sizeByProduct, { cutoffs });
    const byId = new Map(outcomes.map((o) => [o.productId, o] as const));

    // Head brand: every SKU resolves back to itself, unambiguously.
    for (const id of ['big-serum', 'big-cream', 'big-cleanser']) {
      expect(byId.get(id)!.outcome).toBe('correct');
    }
    // Indie brand: neither product resolves confidently to itself — the two
    // same-name siblings tie within the ambiguity margin.
    expect(byId.get('tiny-a')!.outcome).not.toBe('correct');
    expect(byId.get('tiny-b')!.outcome).not.toBe('correct');
  });

  it('reports the gap as lower recall for the smaller-brand bucket', () => {
    const outcomes = measureRecall(catalog, catalog, brands, sizeByProduct, { cutoffs });
    const byBucket = aggregateByBucket(outcomes);
    const mid = byBucket.find((b) => b.bucket === 'mid')!; // BigCo, size 3
    const small = byBucket.find((b) => b.bucket === 'small')!; // TinyCo, size 2

    expect(mid.recall).toBe(1);
    expect(small.recall).toBe(0);
    expect(small.recall).toBeLessThan(mid.recall);
  });

  it('explains the gap: the smaller-brand bucket carries thinner data', () => {
    const profile = profileByBucket(catalog, brands, sizeByProduct, cutoffs);
    const mid = profile.find((b) => b.bucket === 'mid')!;
    const small = profile.find((b) => b.bucket === 'small')!;

    expect(mid.gtinCoverage).toBe(1);
    expect(small.gtinCoverage).toBe(0);
    expect(small.meanIngredients).toBeLessThan(mid.meanIngredients);
    expect(mid.brands).toBe(1);
    expect(small.brands).toBe(1);
  });
});
