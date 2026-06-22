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

describe('sephoraAdapter.extract (The Ordinary fixture)', () => {
  const doc = docFrom(fixture('sephora-the-ordinary-nmf.html'));
  const url = 'https://www.sephora.com/product/the-ordinary-nmf-P453667';
  const sighting = sephoraAdapter.extract(doc, url)!;

  it('returns a sighting', () => {
    expect(sighting).not.toBeNull();
    expect(sighting.source).toBe('sephora');
    expect(sighting.url).toBe(url);
  });

  it('reads the product name from the data-at hook', () => {
    expect(sighting.rawName).toBe('Natural Moisturizing Factors + HA');
  });

  it('reads the brand from data-at="brand_name"', () => {
    expect(sighting.rawBrand).toBe('The Ordinary');
  });

  it('reads the breadcrumb, dropping the Home crumb', () => {
    expect(sighting.category).toEqual(['Skincare', 'Moisturizers']);
  });

  it('extracts ingredients as a lower-cased, comma-split list', () => {
    expect(sighting.rawIngredients.length).toBeGreaterThan(10);
    expect(sighting.rawIngredients[0]).toBe('aqua (water)');
    expect(sighting.rawIngredients).toContain('glycerin');
    expect(sighting.rawIngredients).toContain('phenoxyethanol');
    // Inline parens must survive intact (regression guard from the Amazon adapter).
    for (const ing of sighting.rawIngredients) {
      expect(ing.length).toBeLessThanOrEqual(120);
    }
  });

  it('reads the gtin13 from the ld+json block', () => {
    expect(sighting.rawGtin).toBe('0769915194302');
  });

  it('reads price and og:image when present', () => {
    expect(sighting.priceText).toBe('$8.90');
    expect(sighting.imageUrl).toMatch(/^https?:\/\//);
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
