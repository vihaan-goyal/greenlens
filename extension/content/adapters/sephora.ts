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
    const priceText = text(doc, ['[data-at="product_list_price"]', '[data-at="price"]']);
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
 * Breadcrumb trail (root → leaf). Sephora tags each crumb anchor individually
 * with `data-at="pdp_bread_crumb"` (e.g. Skincare → Treatments → Face Serums);
 * we fall back to a `nav`/BreadcrumbList list of links. The leading
 * "Sephora"/"Home" crumb, if present, is dropped so the cosmetic classifier
 * sees real category nodes — without one, a Sephora product never classifies
 * as a cosmetic and the card never shows.
 */
function breadcrumbs(doc: Document): string[] | undefined {
  const tagged = dedupe(
    Array.from(doc.querySelectorAll('[data-at="pdp_bread_crumb"]'))
      .map((el) => el.textContent?.trim() ?? '')
      .filter((s) => s.length > 0 && !/^(home|sephora)$/i.test(s)),
  );
  if (tagged.length) return tagged;

  for (const sel of [
    'nav[aria-label*="readcrumb" i] a',
    'ol[itemtype*="BreadcrumbList"] a',
    'nav ol a',
  ]) {
    const crumbs = dedupe(
      Array.from(doc.querySelectorAll(sel))
        .map((a) => a.textContent?.trim() ?? '')
        .filter((s) => s.length > 0 && !/^(home|sephora)$/i.test(s)),
    );
    if (crumbs.length) return crumbs;
  }
  return undefined;
}

function dedupe(xs: string[]): string[] {
  return [...new Set(xs)];
}

/**
 * Ingredients live in the "Ingredients" accordion. Sephora tags only the
 * *label* ("Ingredients"), not the list element — the INCI list is a plain
 * comma-separated paragraph in the accordion panel with no stable hook. So we
 * find the heading, then climb outward and read the comma-densest leaf: the
 * INCI list is always the densest comma run in its panel, which survives
 * Sephora's class/attr churn far better than a positional selector.
 */
function ingredients(doc: Document): string[] {
  const heading = Array.from(
    doc.querySelectorAll('h1, h2, h3, h4, h5, b, strong, [data-at="ingredients"]'),
  ).find((el) => /^ingredients\b/i.test(el.textContent?.trim() ?? ''));
  if (!heading) return [];

  let scope: Element | null = heading;
  for (let i = 0; i < 5 && scope; i++) {
    const leaf = commaRichestLeaf(scope, heading);
    if (leaf) {
      const list = splitIngredients(leaf.textContent ?? '');
      // >2 tokens guards against prose ("light, fast-absorbing serum") being
      // mistaken for an ingredient list.
      if (list.length > 2) return list;
    }
    scope = scope.parentElement;
  }
  return [];
}

/**
 * The leaf element (no element children) with the most commas inside `root`,
 * excluding `skip`. Returns null unless something beats a 3-comma floor.
 */
function commaRichestLeaf(root: Element, skip: Element): Element | null {
  let best: Element | null = null;
  let bestCommas = 3;
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (el.children.length > 0 || el === skip) continue;
    const commas = (el.textContent?.match(/,/g) ?? []).length;
    if (commas > bestCommas) {
      bestCommas = commas;
      best = el;
    }
  }
  return best;
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
