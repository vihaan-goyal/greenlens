import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { amazonAdapter } from './amazon';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  readFileSync(join(__dirname, '__fixtures__', name), 'utf8');

function docFrom(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('amazonAdapter.matches', () => {
  it('matches /dp/<asin> on amazon.com', () => {
    expect(amazonAdapter.matches('https://www.amazon.com/dp/B00TTD9BRC')).toBe(true);
    expect(amazonAdapter.matches('https://www.amazon.com/CeraVe/dp/B00TTD9BRC?ref=sr_1_1')).toBe(true);
  });

  it('matches /gp/product/<asin>', () => {
    expect(amazonAdapter.matches('https://www.amazon.com/gp/product/B00TTD9BRC')).toBe(true);
  });

  it('ignores search and category pages', () => {
    expect(amazonAdapter.matches('https://www.amazon.com/s?k=cerave')).toBe(false);
    expect(amazonAdapter.matches('https://www.amazon.com/b?node=3760911')).toBe(false);
  });

  it('ignores other hosts', () => {
    expect(amazonAdapter.matches('https://www.target.com/dp/B00TTD9BRC')).toBe(false);
  });
});

describe('amazonAdapter.extract (CeraVe fixture)', () => {
  const doc = docFrom(fixture('amazon-cerave-moisturizer.html'));
  const url = 'https://www.amazon.com/dp/B00TTD9BRC';
  const sighting = amazonAdapter.extract(doc, url)!;

  it('returns a sighting', () => {
    expect(sighting).not.toBeNull();
    expect(sighting.source).toBe('amazon');
    expect(sighting.url).toBe(url);
  });

  it('reads the product title', () => {
    expect(sighting.rawName).toMatch(/cerave moisturizing cream/i);
  });

  it('strips "Visit the X Store" from the brand byline', () => {
    expect(sighting.rawBrand).toBe('CeraVe');
  });

  it('reads the breadcrumb path', () => {
    expect(sighting.category).toEqual([
      'Beauty & Personal Care',
      'Skin Care',
      'Body',
      'Moisturizers',
    ]);
  });

  it('extracts ingredients as a lower-cased, comma-split list', () => {
    expect(sighting.rawIngredients.length).toBeGreaterThan(10);
    expect(sighting.rawIngredients[0]).toBe('purified water');
    expect(sighting.rawIngredients).toContain('phenoxyethanol');
    expect(sighting.rawIngredients).toContain('glycerin');
  });

  it('grabs the UPC from the details bullets', () => {
    expect(sighting.rawGtin).toBe('301871239019');
  });

  it('reads price and image when present', () => {
    expect(sighting.priceText).toBe('$18.97');
    expect(sighting.imageUrl).toMatch(/^https?:\/\//);
  });
});

describe('amazonAdapter.extract — defensive cases', () => {
  it('returns null when there is no product title', () => {
    const doc = docFrom('<html><body><div>no title here</div></body></html>');
    expect(amazonAdapter.extract(doc, 'https://www.amazon.com/dp/B00')).toBeNull();
  });

  it('survives a page with title but no breadcrumbs or ingredients', () => {
    const doc = docFrom(
      '<html><body><span id="productTitle">Some Thing</span></body></html>',
    );
    const s = amazonAdapter.extract(doc, 'https://www.amazon.com/dp/B00')!;
    expect(s.rawName).toBe('Some Thing');
    expect(s.category).toBeUndefined();
    expect(s.rawIngredients).toEqual([]);
    expect(s.rawGtin).toBeUndefined();
  });
});

describe('amazonAdapter.extract (Maybelline makeup fixture)', () => {
  const doc = docFrom(fixture('amazon-maybelline-mascara.html'));
  const url = 'https://www.amazon.com/dp/B07PXGQC1Q';
  const sighting = amazonAdapter.extract(doc, url)!;

  it('reads the breadcrumb path into a Makeup category', () => {
    expect(sighting.category).toEqual([
      'Beauty & Personal Care',
      'Makeup',
      'Eyes',
      'Mascara',
    ]);
  });

  it('strips "Visit the X Store" byline format', () => {
    expect(sighting.rawBrand).toBe('Maybelline');
  });

  it('parses <ul>-style ingredient list as separate entries (regression: previously collapsed into one 250-char string)', () => {
    expect(sighting.rawIngredients.length).toBeGreaterThanOrEqual(8);
    expect(sighting.rawIngredients).toContain('acacia senegal gum');
    expect(sighting.rawIngredients).toContain('phenoxyethanol');
    expect(sighting.rawIngredients).toContain('iron oxides (ci 77499)');
    // No item should be longer than ~120 chars — a sentinel that we split per <li>
    for (const ing of sighting.rawIngredients) {
      expect(ing.length).toBeLessThanOrEqual(120);
    }
  });

  it('finds UPC in productDetails_techSpec_section_1 (not just the bullet list)', () => {
    expect(sighting.rawGtin).toBe('041554577778');
  });
});

describe('amazonAdapter.extract (Chanel fragrance fixture)', () => {
  const doc = docFrom(fixture('amazon-chanel-no5.html'));
  const url = 'https://www.amazon.com/dp/B000PEEPSC';
  const sighting = amazonAdapter.extract(doc, url)!;

  it('still returns a sighting when there are no ingredients (degrade gracefully)', () => {
    expect(sighting).not.toBeNull();
    expect(sighting.rawIngredients).toEqual([]);
  });

  it('strips "Brand: X" byline format', () => {
    expect(sighting.rawBrand).toBe('Chanel');
  });

  it('reads a Fragrance category breadcrumb (classifier signal)', () => {
    expect(sighting.category?.[0]).toBe('Beauty & Personal Care');
    expect(sighting.category).toContain('Fragrance');
  });

  it('finds EAN-13 in the tech-spec table (not UPC)', () => {
    expect(sighting.rawGtin).toBe('3145891255300');
  });

  it('returns no image when the page has none (does not throw)', () => {
    expect(sighting.imageUrl).toBeUndefined();
  });
});

describe('amazonAdapter — byline strip variants', () => {
  const url = 'https://www.amazon.com/dp/B0';
  const wrap = (byline: string) =>
    docFrom(
      `<html><body>
         <span id="productTitle">X Cream</span>
         <span id="bylineInfo">${byline}</span>
       </body></html>`,
    );

  it('"Visit the X Store" → X', () => {
    expect(amazonAdapter.extract(wrap('Visit the Drunk Elephant Store'), url)?.rawBrand)
      .toBe('Drunk Elephant');
  });

  it('"Brand: X" → X', () => {
    expect(amazonAdapter.extract(wrap('Brand: Glossier'), url)?.rawBrand).toBe('Glossier');
  });

  it('"by X" → X', () => {
    expect(amazonAdapter.extract(wrap('by Aesop'), url)?.rawBrand).toBe('Aesop');
  });

  it('bare brand name → unchanged', () => {
    expect(amazonAdapter.extract(wrap('Olaplex'), url)?.rawBrand).toBe('Olaplex');
  });
});
