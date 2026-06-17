import { describe, expect, it } from 'vitest';
import { classifyCosmetic } from './classifier';
import type { RawProductSighting } from '../shared/sighting';

const base: RawProductSighting = {
  source: 'amazon',
  url: 'https://www.amazon.com/dp/X',
  rawName: '',
  rawIngredients: [],
  capturedAt: 0,
};

describe('classifyCosmetic', () => {
  it('accepts a sighting with a cosmetic category AND a cosmetic noun', () => {
    expect(
      classifyCosmetic({
        ...base,
        rawName: 'CeraVe Moisturizing Cream 19 oz',
        category: ['Beauty & Personal Care', 'Skin Care', 'Moisturizers'],
      }).cosmetic,
    ).toBe(true);
  });

  it('accepts on category depth alone (handles odd brand-only names)', () => {
    expect(
      classifyCosmetic({
        ...base,
        rawName: 'Drunk Elephant Bora Barrier Repair',
        category: ['Beauty & Personal Care', 'Skin Care'],
      }).cosmetic,
    ).toBe(true);
  });

  it('rejects when only a noun matches (avoid food/jewelry false positives)', () => {
    // "cream" without a cosmetic category is too ambiguous.
    expect(
      classifyCosmetic({
        ...base,
        rawName: 'Philadelphia Cream Cheese 8 oz',
        category: ['Grocery & Gourmet Food', 'Dairy'],
      }).cosmetic,
    ).toBe(false);
  });

  it('rejects when there are no signals', () => {
    expect(
      classifyCosmetic({ ...base, rawName: 'LEGO Star Wars Set', category: ['Toys & Games'] })
        .cosmetic,
    ).toBe(false);
  });

  it('rejects with no category provided and a cosmetic-shaped name', () => {
    // Conservative — we'd rather skip Sonion than embarrass him.
    expect(
      classifyCosmetic({ ...base, rawName: 'Vanilla Body Lotion' }).cosmetic,
    ).toBe(false);
  });
});
