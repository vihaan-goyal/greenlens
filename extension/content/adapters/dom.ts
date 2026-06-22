/**
 * Generic DOM-scraping helpers shared by site adapters. These carry no
 * site-specific knowledge — just "read text through a list of selector
 * candidates", "read an attribute", "tidy whitespace", "split an ingredient
 * blob". Site-specific logic (brand fallbacks, GTIN scoping) stays in each
 * adapter.
 */

/** First non-empty trimmed textContent across a list of selector candidates. */
export function text(doc: Document, selectors: string[]): string | undefined {
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    const t = el?.textContent?.trim();
    if (t) return t;
  }
  return undefined;
}

/** A single element's attribute, trimmed, or undefined when absent/empty. */
export function attr(doc: Document, selector: string, name: string): string | undefined {
  const el = doc.querySelector(selector);
  const v = el?.getAttribute(name) ?? undefined;
  return v && v.trim() ? v.trim() : undefined;
}

/** Collapse runs of whitespace to single spaces and trim. */
export function clean(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Split an ingredient blob into normalized INCI tokens. Splits only on real
 * separators (comma / bullet) — never on parens, which would shred inline
 * parens like "Pyrus Malus (Apple) Fruit Extract" into non-matching tokens.
 * Lower-cased, with a 2..120 char length filter to drop noise.
 */
export function splitIngredients(raw: string): string[] {
  return raw
    .replace(/\s+/g, ' ')
    .split(/[,•·]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 2 && s.length <= 120);
}
