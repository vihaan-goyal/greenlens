import { describe, expect, it } from 'vitest';
import {
  extractIngredients,
  extractPackagingMaterials,
  extractRatings,
  fetchOpenBeautyFacts,
  ingestBarcode,
  normalizeListing,
  obfResponseSchema,
  parseQuantity,
  primaryBrand,
  toMatchableItem,
} from './open-beauty-facts';
import { BRANDS, PRODUCTS } from '../data/seed-data';
import type { CatalogEntry } from '../matcher/matcher';

// A trimmed-but-realistic OBF v2 response for CeraVe Moisturizing Cream, whose
// barcode (301871239019) is in the seed catalog.
const CERAVE_RESPONSE = {
  code: '301871239019',
  status: 1,
  status_verbose: 'product found',
  product: {
    code: '301871239019',
    product_name: 'CeraVe Moisturizing Cream',
    brands: 'CeraVe, L\'Oréal',
    quantity: '19 oz',
    ingredients_text: 'Aqua, Glycerin, Cetearyl Alcohol',
    ingredients: [
      { text: 'Purified Water' },
      { text: 'Glycerin' },
      { text: 'Cetearyl Alcohol' },
      { text: 'Caprylic/Capric Triglyceride' },
      { text: 'Cetyl Alcohol' },
      { text: 'Ceramide NP' },
      { text: 'Phenoxyethanol' },
      { text: '' }, // empty entries must be dropped
    ],
    ecoscore_score: 47,
    ecoscore_grade: 'd',
    irrelevant_field: 'ignored',
  },
};

const NOT_FOUND_RESPONSE = { code: '0000000000000', status: 0, status_verbose: 'product not found' };

function mockFetch(payload: unknown, ok = true): typeof fetch {
  return (async () => ({ ok, status: ok ? 200 : 500, json: async () => payload })) as unknown as typeof fetch;
}

describe('open-beauty-facts validation', () => {
  it('parses a well-formed response and strips unknown fields', () => {
    const parsed = obfResponseSchema.parse(CERAVE_RESPONSE);
    expect(parsed.status).toBe(1);
    expect(parsed.product?.product_name).toBe('CeraVe Moisturizing Cream');
    // Unknown keys are stripped from the validated view.
    expect((parsed.product as Record<string, unknown>).irrelevant_field).toBeUndefined();
  });

  it('rejects a malformed response (missing status)', () => {
    expect(() => obfResponseSchema.parse({ product: {} })).toThrow();
  });
});

describe('normalization helpers', () => {
  it('parses quantities', () => {
    expect(parseQuantity('30 ml')).toEqual({ sizeValue: 30, sizeUnit: 'ml' });
    expect(parseQuantity('1.7 fl oz')).toEqual({ sizeValue: 1.7, sizeUnit: 'fl' });
    expect(parseQuantity(undefined)).toEqual({});
    expect(parseQuantity('a lot')).toEqual({});
  });

  it('takes the first brand as primary', () => {
    expect(primaryBrand("CeraVe, L'Oréal")).toBe('CeraVe');
    expect(primaryBrand(undefined)).toBe('');
  });

  it('prefers the structured ingredient list and drops empties', () => {
    const product = obfResponseSchema.parse(CERAVE_RESPONSE).product!;
    const ingredients = extractIngredients(product);
    expect(ingredients[0]).toBe('Purified Water');
    expect(ingredients).not.toContain('');
    expect(ingredients).toHaveLength(7);
  });

  it('prefers structured packaging materials over the tag fallbacks', () => {
    const product = obfResponseSchema.parse({
      status: 1,
      product: {
        packagings: [{ material: 'en:glass', shape: 'en:bottle' }, { material: 'en:pp' }],
        packaging_materials_tags: ['en:plastic'],
        packaging_tags: ['en:bottle'],
      },
    }).product!;
    expect(extractPackagingMaterials(product)).toEqual(['en:glass', 'en:pp']);
  });

  it('falls back to material tags, then mixed packaging tags', () => {
    const materialOnly = obfResponseSchema.parse({
      status: 1,
      product: { packaging_materials_tags: ['en:glass'], packaging_tags: ['en:bottle'] },
    }).product!;
    expect(extractPackagingMaterials(materialOnly)).toEqual(['en:glass']);

    const tagsOnly = obfResponseSchema.parse({
      status: 1,
      product: { packaging_tags: ['en:glass', 'en:bottle'] },
    }).product!;
    expect(extractPackagingMaterials(tagsOnly)).toEqual(['en:glass', 'en:bottle']);

    const none = obfResponseSchema.parse({ status: 1, product: {} }).product!;
    expect(extractPackagingMaterials(none)).toEqual([]);
  });
});

describe('normalizeListing + extractRatings', () => {
  const now = new Date('2026-06-17T00:00:00Z');
  const product = obfResponseSchema.parse(CERAVE_RESPONSE).product!;

  it('maps an OBF product to a Listing', () => {
    const listing = normalizeListing(product, CERAVE_RESPONSE, { now });
    expect(listing.id).toBe('obf-301871239019');
    expect(listing.sourceId).toBe('obf-eco');
    expect(listing.rawName).toBe('CeraVe Moisturizing Cream');
    expect(listing.rawBrand).toBe('CeraVe');
    expect(listing.rawGtin).toBe('301871239019');
    expect(listing.fetchedAt).toBe(now);
    expect(listing.payload).toBe(CERAVE_RESPONSE); // full response preserved
  });

  it('extracts only the Eco-Score rating that OBF actually provides', () => {
    const ratings = extractRatings(product, 'obf-301871239019', { now });
    expect(ratings).toHaveLength(1);
    expect(ratings[0]).toMatchObject({ scoreRaw: 47, scoreLabel: 'D', listingId: 'obf-301871239019' });
  });

  it('invents no rating when Eco-Score is absent', () => {
    const ratings = extractRatings({ code: '1', product_name: 'X' }, 'obf-1');
    expect(ratings).toHaveLength(0);
  });
});

describe('fetchOpenBeautyFacts', () => {
  it('returns the product on status 1', async () => {
    const result = await fetchOpenBeautyFacts('3-0187-1239019', { fetchImpl: mockFetch(CERAVE_RESPONSE) });
    expect(result?.product.product_name).toBe('CeraVe Moisturizing Cream');
  });

  it('returns null when OBF does not know the product', async () => {
    const result = await fetchOpenBeautyFacts('0000000000000', { fetchImpl: mockFetch(NOT_FOUND_RESPONSE) });
    expect(result).toBeNull();
  });

  it('throws on a non-OK HTTP response', async () => {
    await expect(
      fetchOpenBeautyFacts('301871239019', { fetchImpl: mockFetch({}, false) }),
    ).rejects.toThrow();
  });

  it('treats a 404 (OBF\'s "unknown barcode" status) as not-found, not an error', async () => {
    const fetch404 = (async () => ({
      ok: false,
      status: 404,
      json: async () => NOT_FOUND_RESPONSE,
    })) as unknown as typeof fetch;
    await expect(fetchOpenBeautyFacts('0000000000000', { fetchImpl: fetch404 })).resolves.toBeNull();
  });
});

describe('ingestBarcode (ingestion → matcher seam)', () => {
  // Build a canonical catalog out of the seed products, like the repository does.
  const catalog: CatalogEntry[] = PRODUCTS.map((p) => {
    const brand = BRANDS.find((b) => b.id === p.brandId)!;
    return {
      id: p.id,
      productId: p.id,
      brand: brand.name,
      name: p.displayName,
      gtin: p.gtin,
      ingredients: p.ingredients,
      sizeValue: p.sizeValue,
      sizeUnit: p.sizeUnit,
    };
  });

  it('resolves a fetched OBF product to the matching catalog product', async () => {
    const result = await ingestBarcode('301871239019', catalog, BRANDS, {
      fetchImpl: mockFetch(CERAVE_RESPONSE),
      now: new Date('2026-06-17T00:00:00Z'),
    });
    expect(result).not.toBeNull();
    expect(result!.match?.productId).toBe('prod-cerave-mc');
    expect(result!.listing.sourceId).toBe('obf-eco');
    expect(result!.ratings).toHaveLength(1);
  });

  it('returns null for an unknown barcode', async () => {
    const result = await ingestBarcode('0000000000000', catalog, BRANDS, {
      fetchImpl: mockFetch(NOT_FOUND_RESPONSE),
    });
    expect(result).toBeNull();
  });

  it('toMatchableItem carries gtin and ingredients for matching', () => {
    const product = obfResponseSchema.parse(CERAVE_RESPONSE).product!;
    const item = toMatchableItem(product);
    expect(item.gtin).toBe('301871239019');
    expect(item.ingredients!.length).toBeGreaterThanOrEqual(5);
  });
});
