import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sephoraAdapter } from './sephora';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(join(__dirname, '__fixtures__', name), 'utf8');

function docFrom(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('sephoraAdapter.matches', () => {
  it('matches /product/ pages on sephora.com', () => {
    expect(
      sephoraAdapter.matches('https://www.sephora.com/product/the-ordinary-nmf-P453667'),
    ).toBe(true);
  });

  it('ignores search and category pages', () => {
    expect(sephoraAdapter.matches('https://www.sephora.com/search?keyword=cerave')).toBe(false);
    expect(sephoraAdapter.matches('https://www.sephora.com/shop/moisturizer')).toBe(false);
  });

  it('ignores other hosts', () => {
    expect(sephoraAdapter.matches('https://www.amazon.com/product/dp/B0')).toBe(false);
  });
});

describe('sephoraAdapter.extract (real captured fixture — The Ordinary HA P427419)', () => {
  const doc = docFrom(fixture('sephora-the-ordinary-hyaluronic-P427419.html'));
  const url = 'https://www.sephora.com/product/the-ordinary-hyaluronic-acid-2-b5-hydrating-serum-P427419';
  const sighting = sephoraAdapter.extract(doc, url)!;

  it('returns a sighting', () => {
    expect(sighting).not.toBeNull();
    expect(sighting.source).toBe('sephora');
    expect(sighting.url).toBe(url);
  });

  it('reads the product name from data-at="product_name" (brand not doubled in)', () => {
    expect(sighting.rawName).toBe('Hyaluronic Acid 2% + B5 Hydrating Serum with Ceramides');
  });

  it('reads the brand from data-at="brand_name"', () => {
    expect(sighting.rawBrand).toBe('The Ordinary');
  });

  it('reads the per-crumb data-at="pdp_bread_crumb" trail (so the classifier sees a category)', () => {
    expect(sighting.category).toEqual(['Skincare', 'Treatments', 'Face Serums']);
  });

  it('extracts the real INCI list as a lower-cased, comma-split list', () => {
    expect(sighting.rawIngredients.length).toBe(23);
    expect(sighting.rawIngredients[0]).toBe('aqua (water)');
    expect(sighting.rawIngredients).toContain('sodium hyaluronate');
    expect(sighting.rawIngredients).toContain('phenoxyethanol');
    // Inline parens must survive intact (regression guard from the Amazon adapter).
    for (const ing of sighting.rawIngredients) {
      expect(ing.length).toBeLessThanOrEqual(120);
    }
  });

  it('has no GTIN — Sephora publishes none here (the no-barcode tail)', () => {
    expect(sighting.rawGtin).toBeUndefined();
  });

  it('reads the price range as display text', () => {
    expect(sighting.priceText).toBe('$6.00 - $10.80');
  });
});

describe('sephoraAdapter.extract — defensive cases', () => {
  it('returns null when there is no product name', () => {
    const doc = docFrom('<html><body><div>not a product</div></body></html>');
    expect(
      sephoraAdapter.extract(doc, 'https://www.sephora.com/product/x-P0'),
    ).toBeNull();
  });

  it('degrades to name-only when ingredients/gtin are absent (the no-barcode tail)', () => {
    const doc = docFrom(
      '<html><body><h1 data-at="product_name">Some Serum</h1></body></html>',
    );
    const s = sephoraAdapter.extract(doc, 'https://www.sephora.com/product/x-P0')!;
    expect(s.rawName).toBe('Some Serum');
    expect(s.rawBrand).toBeUndefined();
    expect(s.rawIngredients).toEqual([]);
    expect(s.rawGtin).toBeUndefined();
    expect(s.category).toBeUndefined();
  });

  it('falls back to ld+json brand when data-at="brand_name" is missing', () => {
    const doc = docFrom(
      `<html><head>
         <script type="application/ld+json">
           {"@type":"Product","brand":{"name":"Glow Recipe"}}
         </script>
       </head><body><h1 data-at="product_name">Dew Drops</h1></body></html>`,
    );
    expect(
      sephoraAdapter.extract(doc, 'https://www.sephora.com/product/x-P0')?.rawBrand,
    ).toBe('Glow Recipe');
  });
});
