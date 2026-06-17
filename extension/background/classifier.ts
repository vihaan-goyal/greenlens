import type { RawProductSighting } from '../shared/sighting';

/**
 * "Is this a cosmetic?" — the gate that decides whether Sonion appears at
 * all. If this is wrong, Sonion pops up on Lego listings and the product
 * is dead. CLAUDE.md scope: cosmetics only.
 *
 * Three signals, ANDed:
 *   1. URL pattern check happens in the adapter — by the time we get here we
 *      already know we're on a product page.
 *   2. Category breadcrumb contains one of our cosmetic root nodes.
 *   3. Product name has at least one cosmetic-shaped noun.
 *
 * The phrasing is deliberately recall-leaning on the breadcrumb side
 * (Amazon's "Beauty & Personal Care" covers makeup, skincare, fragrance,
 * hair, deodorant) and precision-leaning on the noun side so we don't
 * mistake e.g. "lip ring" jewelry for lip balm.
 */

const COSMETIC_CATEGORY_TOKENS = [
  'beauty',
  'personal care',
  'skin care',
  'skincare',
  'cosmetics',
  'makeup',
  'fragrance',
  'hair care',
  'haircare',
  'bath & body',
];

const COSMETIC_NOUN_TOKENS = [
  'moisturizer',
  'cream',
  'lotion',
  'serum',
  'cleanser',
  'shampoo',
  'conditioner',
  'sunscreen',
  'spf',
  'lipstick',
  'lip balm',
  'mascara',
  'foundation',
  'concealer',
  'eyeliner',
  'blush',
  'toner',
  'exfoliant',
  'deodorant',
  'antiperspirant',
  'perfume',
  'cologne',
  'eau de toilette',
  'eau de parfum',
  'body wash',
  'face wash',
];

export interface ClassifyResult {
  cosmetic: boolean;
  /** Reason for telemetry / debug overlay — not shown to the user. */
  reason: string;
}

export function classifyCosmetic(s: RawProductSighting): ClassifyResult {
  const catHits = (s.category ?? [])
    .map((c) => c.toLowerCase())
    .filter((c) => COSMETIC_CATEGORY_TOKENS.some((t) => c.includes(t)));
  const name = s.rawName.toLowerCase();
  const nounHit = COSMETIC_NOUN_TOKENS.find((t) => name.includes(t));

  if (catHits.length > 0 && nounHit) {
    return { cosmetic: true, reason: `category[${catHits[0]}] + noun[${nounHit}]` };
  }
  // Category alone is enough — covers products with idiosyncratic names
  // (e.g. branded line names that don't include a noun like "moisturizer").
  if (catHits.length >= 2) {
    return { cosmetic: true, reason: `category[${catHits.slice(0, 2).join(' > ')}]` };
  }
  // Noun alone is too risky — "cream cheese", "lotion bar (soap)", etc.
  return {
    cosmetic: false,
    reason: nounHit ? `noun-only[${nounHit}]` : 'no signals',
  };
}
