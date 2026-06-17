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
