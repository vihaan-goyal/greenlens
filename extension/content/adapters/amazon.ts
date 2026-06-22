import type { RawProductSighting } from '../../shared/sighting';
import type { SiteAdapter } from './types';
import { attr, clean, splitIngredients, text } from './dom';

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

    const rawBrand = readBrand(doc);

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
// Generic DOM helpers (text/attr/clean/splitIngredients) live in ./dom and are
// shared with the Sephora adapter. Everything below is Amazon-specific.

/**
 * Brand extraction with a fallback cascade. Amazon ships several layouts;
 * `#bylineInfo` is the most common, but the modern brand-store layout
 * (seen on Drunk Elephant and other premium DTC brands) omits it entirely
 * and renders the byline as `#visitStoreLink`. As a last resort we read the
 * "Brand" row in the product details table.
 *
 * Strip patterns we've seen on these byline shapes:
 *   "Visit the Maybelline Store"  → strip "Visit the " prefix + " Store" suffix
 *   "Brand: Chanel"               → strip "Brand: " prefix
 *   "by SomeBrand"                → strip "by " prefix
 *   "CeraVe"                      → unchanged
 */
function readBrand(doc: Document): string | undefined {
  const strip = (s: string) =>
    s
      .replace(/^(?:visit the |brand:\s*|by\s+)/i, '')
      .replace(/\s+store$/i, '')
      .trim();

  // 1. Common byline IDs, in priority order.
  for (const sel of ['#bylineInfo', '#visitStoreLink']) {
    const t = doc.querySelector(sel)?.textContent?.trim();
    if (t) {
      const cleaned = strip(t);
      if (cleaned) return cleaned;
    }
  }

  // 2. Any link into a brand store — the visible text is usually the byline.
  for (const a of Array.from(doc.querySelectorAll('a[href*="/stores/"]'))) {
    const t = a.textContent?.trim();
    if (!t) continue;
    // Filter out images/icons whose text is empty — already handled above —
    // and short navigation links unrelated to byline.
    if (t.length < 3 || t.length > 80) continue;
    const cleaned = strip(t);
    if (cleaned) return cleaned;
  }

  // 3. Product details table — "Brand" row.
  for (const row of Array.from(doc.querySelectorAll('tr'))) {
    const cells = row.querySelectorAll('th, td');
    if (cells.length < 2) continue;
    const label = (cells[0]?.textContent ?? '').trim().toLowerCase();
    if (label === 'brand') {
      const v = cells[1]?.textContent?.trim();
      if (v) return v;
    }
  }

  return undefined;
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
  // "Ingredients" heading followed by either a paragraph or a list.
  const allHeadings = doc.querySelectorAll('h2, h3, h4, h5, b, strong');
  for (const h of Array.from(allHeadings)) {
    if (!/^ingredients\b/i.test(h.textContent?.trim() ?? '')) continue;
    const sibling = h.nextElementSibling;
    if (sibling) {
      const list = readIngredientContainer(sibling);
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

/**
 * Read ingredients out of whatever element follows the "Ingredients" heading.
 * For <ul>/<ol> we walk each <li> individually — joining their textContent
 * loses the implicit comma separator and produces one 250-char "ingredient".
 */
function readIngredientContainer(el: Element): string[] {
  const tag = el.tagName.toLowerCase();
  if (tag === 'ul' || tag === 'ol') {
    return Array.from(el.querySelectorAll('li'))
      .flatMap((li) => splitIngredients(li.textContent ?? ''));
  }
  return splitIngredients(el.textContent ?? '');
}

/**
 * Amazon shows UPC/EAN in the product details table under varying labels:
 * "UPC", "EAN", "GTIN", "Item Model Number" (sometimes carries the barcode).
 * The matcher's blocker normalizes by stripping non-digits and left-padding
 * to GTIN-14, so we just return whatever digit string we find.
 */
function gtinFromDetails(doc: Document): string | undefined {
  const labels = ['upc', 'ean', 'gtin', 'isbn'];

  // CRITICAL: only scan inside known product-detail containers, never the
  // whole document. Scanning everywhere makes the adapter pick up UPCs from
  // the cart sidebar, "Related items" carousel, "Compare to similar items"
  // table, sponsored ads, etc. — and tagging a wrong UPC onto the sighting
  // is worse than no UPC at all, because the matcher then sees
  // `gtinExact: false` and the 6.0 weight drags the composite score below
  // threshold even when brand + name agree.
  const PRODUCT_INFO_CONTAINERS = [
    '#productDetails_feature_div',
    '#productDetails_techSpec_section_1',
    '#productDetails_techSpec_section_2',
    '#productDetails_detailBullets_sections1',
    '#detailBullets_feature_div',
    '#prodDetails',
    '#productDetailsTable',
    '#technicalSpecifications_feature_div',
    '#important-information',
  ];

  for (const containerSel of PRODUCT_INFO_CONTAINERS) {
    const container = doc.querySelector(containerSel);
    if (!container) continue;

    // Structured table row: read the value cell directly so we don't depend
    // on textContent including separators between label and value (Amazon's
    // tech-spec table joins them as "UPC<digits>" with no whitespace).
    for (const row of Array.from(container.querySelectorAll('tr'))) {
      const cells = row.querySelectorAll('th, td');
      if (cells.length < 2) continue;
      const label = (cells[0]?.textContent ?? '').trim().toLowerCase();
      if (!labels.some((l) => label === l || label.startsWith(l + ' '))) continue;
      const value = (cells[1]?.textContent ?? '').replace(/\s+/g, '');
      const match = value.match(/\d{8,14}/);
      if (match) return match[0];
    }

    // Bullet list: textContent here typically separates label and digits
    // with " : " so a textContent scan is fine.
    for (const row of Array.from(container.querySelectorAll('li'))) {
      const txt = (row.textContent ?? '').toLowerCase();
      if (!labels.some((l) => txt.includes(l))) continue;
      const match = (row.textContent ?? '').match(/\b\d{8,14}\b/);
      if (match) return match[0];
    }
  }

  return undefined;
}
