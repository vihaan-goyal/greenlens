import type { RawProductSighting } from '../../shared/sighting';
import type { SiteAdapter } from './types';

/**
 * Amazon product page adapter. The DOM here is *not* stable — Amazon ships
 * variants per locale, per A/B test, and per category. The strategy:
 *
 *   1. Read each field through several selector candidates in priority order.
 *   2. Tolerate missing fields. Brand or name absent → return null and let
 *      the SW decline cleanly. The matcher is built to make a confident
 *      guess from whatever subset survived.
 *   3. Never throw. A scrape failure must not break the page.
 *
 * Every selector below has at least one fixture under `__fixtures__/` that
 * proves it works. When Amazon changes DOM, add a new fixture *first*, watch
 * the test fail, then add the new selector — that's how we keep the adapter
 * honest.
 */

const PRODUCT_URL = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i;

export const amazonAdapter: SiteAdapter = {
  id: 'amazon',

  matches(url) {
    try {
      const u = new URL(url);
      if (!/(^|\.)amazon\.com$/.test(u.hostname)) return false;
      return PRODUCT_URL.test(u.pathname);
    } catch {
      return false;
    }
  },

  extract(doc, url) {
    const rawName = text(doc, ['#productTitle', '#title']);
    if (!rawName) return null;

    const rawBrand =
      // The byline shows up either as a linked brand or "Visit the X Store"
      text(doc, ['#bylineInfo'])
        ?.replace(/^(?:visit the |brand:\s*)/i, '')
        ?.replace(/\s+store$/i, '')
        ?.trim() ||
      text(doc, ['a#bylineInfo']);

    const category = breadcrumbs(doc);
    const rawIngredients = ingredients(doc);
    const rawGtin = gtinFromDetails(doc);
    const priceText =
      text(doc, [
        'span.a-price .a-offscreen',
        '#corePriceDisplay_desktop_feature_div .a-offscreen',
        '#priceblock_ourprice',
      ]) ?? undefined;
    const imageUrl =
      attr(doc, '#landingImage', 'src') ??
      attr(doc, '#imgBlkFront', 'src') ??
      undefined;

    const sighting: RawProductSighting = {
      source: 'amazon',
      url,
      rawName: clean(rawName),
      rawBrand: rawBrand ? clean(rawBrand) : undefined,
      rawGtin,
      rawIngredients,
      category,
      priceText,
      imageUrl,
      capturedAt: Date.now(),
    };
    return sighting;
  },
};

// ─── helpers ────────────────────────────────────────────────────────────────

function text(doc: Document, selectors: string[]): string | undefined {
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    const t = el?.textContent?.trim();
    if (t) return t;
  }
  return undefined;
}

function attr(doc: Document, selector: string, name: string): string | undefined {
  const el = doc.querySelector(selector);
  const v = el?.getAttribute(name) ?? undefined;
  return v && v.trim() ? v.trim() : undefined;
}

function clean(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Amazon's breadcrumb element ID changes a lot but the structure is consistent:
 * a list of `<a>` elements under `#wayfinding-breadcrumbs_feature_div`.
 * We fall back to `nav` landmarks in case the wayfinding container is renamed.
 */
function breadcrumbs(doc: Document): string[] | undefined {
  const containers = [
    '#wayfinding-breadcrumbs_feature_div',
    '#nav-subnav',
    'nav[aria-label="Breadcrumb"]',
  ];
  for (const sel of containers) {
    const root = doc.querySelector(sel);
    if (!root) continue;
    const crumbs = Array.from(root.querySelectorAll('a'))
      .map((a) => a.textContent?.trim() ?? '')
      .filter((s) => s.length > 0);
    if (crumbs.length) return crumbs;
  }
  return undefined;
}

/**
 * Ingredients live in a few places on Amazon: the "Ingredients" section in
 * the product description, a dedicated Important Information block, or a
 * details table row. We tolerate any of them and split on commas.
 */
function ingredients(doc: Document): string[] {
  // Block-style "Ingredients" header followed by a paragraph.
  const allHeadings = doc.querySelectorAll('h2, h3, h4, h5, b, strong');
  for (const h of Array.from(allHeadings)) {
    if (!/^ingredients\b/i.test(h.textContent?.trim() ?? '')) continue;
    const sibling = h.nextElementSibling;
    if (sibling?.textContent) {
      const list = splitIngredients(sibling.textContent);
      if (list.length) return list;
    }
    // Sometimes the ingredients live in the parent block alongside the heading.
    const parent = h.parentElement;
    if (parent) {
      const stripped = parent.textContent?.replace(h.textContent ?? '', '') ?? '';
      const list = splitIngredients(stripped);
      if (list.length) return list;
    }
  }

  // Table row labelled "Ingredients" in details/specs tables.
  const rows = doc.querySelectorAll('tr');
  for (const row of Array.from(rows)) {
    const cells = row.querySelectorAll('th, td');
    if (cells.length < 2) continue;
    const label = cells[0]?.textContent?.trim().toLowerCase() ?? '';
    if (label === 'ingredients') {
      const list = splitIngredients(cells[1]?.textContent ?? '');
      if (list.length) return list;
    }
  }
  return [];
}

function splitIngredients(raw: string): string[] {
  return raw
    .replace(/\s+/g, ' ')
    .split(/[,•·]|(?<=\))\s+(?=[A-Z])/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 2 && s.length <= 120);
}

/**
 * Amazon shows UPC/EAN in the product details table under varying labels:
 * "UPC", "EAN", "GTIN", "Item Model Number" (sometimes carries the barcode).
 * The matcher's blocker normalizes by stripping non-digits and left-padding
 * to GTIN-14, so we just return whatever digit string we find.
 */
function gtinFromDetails(doc: Document): string | undefined {
  const labels = ['upc', 'ean', 'gtin', 'isbn'];
  const rows = doc.querySelectorAll('tr, li');
  for (const row of Array.from(rows)) {
    const txt = (row.textContent ?? '').toLowerCase();
    if (!labels.some((l) => txt.includes(l))) continue;
    const digits = (row.textContent ?? '').match(/\b\d{8,14}\b/);
    if (digits) return digits[0];
  }
  return undefined;
}
