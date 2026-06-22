import type { RawProductSighting } from '../../shared/sighting';
import type { SiteAdapter } from './types';
import { attr, clean, splitIngredients, text } from './dom';

/**
 * Sephora product-page adapter. Sephora is a single-page React app; its DOM is
 * keyed by stable `data-at` test hooks (e.g. `data-at="product_name"`), which
 * we read first, with structural fallbacks (a bare `<h1>`, the ld+json blob)
 * behind them. Same contract as the Amazon adapter:
 *
 *   1. Read each field through several candidates in priority order.
 *   2. Tolerate missing fields — brand or name absent → return null and let the
 *      SW decline cleanly.
 *   3. Never throw. A scrape failure must not break the page.
 *
 * Unlike Amazon, Sephora almost never publishes a UPC/EAN, so `rawGtin` is
 * usually undefined and the matcher leans on brand + name + the (rich) INCI
 * list. That's the long-tail, no-barcode case the project deliberately
 * surfaces rather than papers over.
 */

const PRODUCT_URL = /^\/product\//i;

export const sephoraAdapter: SiteAdapter = {
  id: 'sephora',

  matches(url) {
    try {
      const u = new URL(url);
      if (!/(^|\.)sephora\.com$/.test(u.hostname)) return false;
      // Product pages live under /product/...; search (/search) and category
      // (/shop/...) pages are not product pages.
      return PRODUCT_URL.test(u.pathname);
    } catch {
      return false;
    }
  },

  extract(doc, url) {
    const rawName = text(doc, ['[data-at="product_name"]', 'h1']);
    if (!rawName) return null;

    const rawBrand = readBrand(doc);
    const category = breadcrumbs(doc);
    const rawIngredients = ingredients(doc);
    const rawGtin = gtinFromLdJson(doc);
    const priceText = text(doc, ['[data-at="price"]', 'b[data-at="price"]', '.css-0 .css-price']);
    const imageUrl = attr(doc, 'meta[property="og:image"]', 'content');

    const sighting: RawProductSighting = {
      source: 'sephora',
      url,
      rawName: clean(rawName),
      rawBrand: rawBrand ? clean(rawBrand) : undefined,
      rawGtin,
      rawIngredients,
      category,
      priceText: priceText ?? undefined,
      imageUrl: imageUrl ?? undefined,
      capturedAt: Date.now(),
    };
    return sighting;
  },
};

// ─── helpers (Sephora-specific) ──────────────────────────────────────────────

/**
 * Brand on Sephora is a link to the brand store next to the title, tagged
 * `data-at="brand_name"`. Fall back to the ld+json `brand.name` when the
 * markup changes.
 */
function readBrand(doc: Document): string | undefined {
  const tagged = text(doc, ['a[data-at="brand_name"]', '[data-at="brand_name"]']);
  if (tagged) return tagged;
  return ldJsonField(doc, (p) =>
    typeof p.brand === 'string'
      ? p.brand
      : p.brand && typeof p.brand === 'object'
        ? (p.brand as { name?: string }).name
        : undefined,
  );
}

/**
 * Breadcrumb trail (root → leaf). Sephora renders it as an ordered list of
 * links tagged `data-at="breadcrumb"`; we fall back to any `nav` breadcrumb
 * landmark. The leading "Sephora"/"Home" crumb, if present, is dropped so the
 * cosmetic classifier sees real category nodes ("Skincare", "Moisturizers").
 */
function breadcrumbs(doc: Document): string[] | undefined {
  const containers = [
    '[data-at="breadcrumb"]',
    'nav[aria-label="Breadcrumb"]',
    'ol[itemtype*="BreadcrumbList"]',
  ];
  for (const sel of containers) {
    const root = doc.querySelector(sel);
    if (!root) continue;
    const crumbs = Array.from(root.querySelectorAll('a'))
      .map((a) => a.textContent?.trim() ?? '')
      .filter((s) => s.length > 0 && !/^(home|sephora)$/i.test(s));
    if (crumbs.length) return crumbs;
  }
  return undefined;
}

/**
 * Ingredients live behind the "Ingredients" accordion. Read the container
 * tagged `data-at="ingredients"` first; otherwise walk from an "Ingredients"
 * heading to the following block. Comma-split into INCI tokens.
 */
function ingredients(doc: Document): string[] {
  const tagged = doc.querySelector('[data-at="ingredients"]');
  if (tagged) {
    const list = splitIngredients(tagged.textContent ?? '');
    if (list.length) return list;
  }

  const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, b, strong, [data-at="ingredient_label"]');
  for (const h of Array.from(headings)) {
    if (!/^ingredients\b/i.test(h.textContent?.trim() ?? '')) continue;
    const sibling = h.nextElementSibling;
    if (sibling) {
      const list = splitIngredients(sibling.textContent ?? '');
      if (list.length) return list;
    }
    const parent = h.parentElement;
    if (parent) {
      const stripped = parent.textContent?.replace(h.textContent ?? '', '') ?? '';
      const list = splitIngredients(stripped);
      if (list.length) return list;
    }
  }
  return [];
}

/**
 * Sephora embeds a Product ld+json block that sometimes carries a `gtin12`/
 * `gtin13`/`gtin`/`sku`. Return the first digit string we find (8–14 digits);
 * the matcher's blocker normalizes it. Missing is the common case — fine.
 */
function gtinFromLdJson(doc: Document): string | undefined {
  return ldJsonField(doc, (p) => {
    const raw = p.gtin13 ?? p.gtin12 ?? p.gtin14 ?? p.gtin ?? p.sku;
    if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
    const match = String(raw).match(/\b\d{8,14}\b/);
    return match ? match[0] : undefined;
  });
}

/** A loosely-typed Product node from an ld+json blob. */
type LdProduct = Record<string, unknown> & {
  '@type'?: string | string[];
  brand?: unknown;
  gtin?: string | number;
  gtin12?: string | number;
  gtin13?: string | number;
  gtin14?: string | number;
  sku?: string | number;
};

/**
 * Run `pick` over every Product node in every ld+json script, returning the
 * first defined result. Tolerates malformed JSON and @graph wrappers.
 */
function ldJsonField(
  doc: Document,
  pick: (p: LdProduct) => string | undefined,
): string | undefined {
  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(script.textContent ?? '');
    } catch {
      continue;
    }
    const nodes = flattenLd(parsed);
    for (const node of nodes) {
      if (!isProduct(node)) continue;
      const v = pick(node);
      if (v) return v;
    }
  }
  return undefined;
}

function flattenLd(parsed: unknown): LdProduct[] {
  if (Array.isArray(parsed)) return parsed.flatMap(flattenLd);
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj['@graph'])) return (obj['@graph'] as unknown[]).flatMap(flattenLd);
    return [obj as LdProduct];
  }
  return [];
}

function isProduct(node: LdProduct): boolean {
  const t = node['@type'];
  return Array.isArray(t) ? t.includes('Product') : t === 'Product';
}
