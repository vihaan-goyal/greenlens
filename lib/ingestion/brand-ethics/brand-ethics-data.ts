// Brand-level cruelty-free / vegan certification reference.
//
// This is the coverage multiplier: a certification attaches to a *brand*, so one
// row rates every product that brand makes. Sourced from the open, published
// certification lists:
//   - Leaping Bunny (Cruelty Free International) — cruelty-free certification
//   - PETA "Beauty Without Bunnies" — cruelty-free + vegan listings
//
// IMPORTANT — this table is illustrative seed data, current as of `AS_OF`, and
// is meant to be refreshed from the published lists (both are downloadable). A
// brand's status genuinely changes (ownership, market entry), and parent-company
// conduct is contested — which is exactly why this is surfaced as its own rater,
// free to disagree with a holistic rater like Good On You, never blended in.
//
// Absence from this table means "no certification on record" (unknown), never
// "tests on animals" — only brands with an actual status are listed.

export const AS_OF = '2024-06';

export type CrueltyStatus =
  | 'certified_vegan' // certified cruelty-free AND fully vegan
  | 'certified' // certified cruelty-free
  | 'parent_conflict' // brand certified, but parent company sells where testing is required
  | 'not_certified'; // brand/parent sells in markets that require animal testing

/** Status → 0..100 (higher = more aligned). Scored, not blended; see source note. */
export const STATUS_SCORE: Record<CrueltyStatus, number> = {
  certified_vegan: 92,
  certified: 85,
  parent_conflict: 55,
  not_certified: 30,
};

export interface BrandEthicsEntry {
  brand: string;
  /** Brand-name synonyms; normalized at load time for lookup. */
  names: string[];
  status: CrueltyStatus;
  /** Who certifies / the basis for the status. */
  certifier: string;
  /** Plain-spoken, brand-specific reasoning. */
  note: string;
}

const LEAPING_BUNNY = 'Leaping Bunny (Cruelty Free International)';
const PETA = 'PETA Beauty Without Bunnies';
const PARENT_MARKET = 'Parent company sells in markets requiring animal testing';

export const BRAND_ETHICS_ENTRIES: BrandEthicsEntry[] = [
  // ── Independent / certified ────────────────────────────────────────────────
  {
    brand: 'e.l.f.',
    names: ['e.l.f.', 'elf', 'elf cosmetics', 'e l f'],
    status: 'certified_vegan',
    certifier: `${PETA} + ${LEAPING_BUNNY}`,
    note: 'Certified cruelty-free and 100% vegan; independent (publicly traded, no testing-required markets).',
  },
  {
    brand: 'Pacifica',
    names: ['pacifica', 'pacifica beauty'],
    status: 'certified_vegan',
    certifier: LEAPING_BUNNY,
    note: 'Certified cruelty-free and fully vegan.',
  },
  {
    brand: 'Olaplex',
    names: ['olaplex', 'olaplex inc'],
    status: 'certified_vegan',
    certifier: PETA,
    note: 'Certified cruelty-free and vegan.',
  },
  {
    brand: 'Glossier',
    names: ['glossier', 'glossier inc'],
    status: 'certified',
    certifier: LEAPING_BUNNY,
    note: 'Certified cruelty-free; not all products are vegan.',
  },
  // Fictional house brands — positioned as clean indies, so certified.
  {
    brand: 'Lumen Botanicals',
    names: ['lumen botanicals', 'lumen'],
    status: 'certified_vegan',
    certifier: LEAPING_BUNNY,
    note: 'Indie brand certified cruelty-free and vegan.',
  },
  {
    brand: 'Vela Skin',
    names: ['vela skin', 'vela', 'vela skin co'],
    status: 'certified',
    certifier: LEAPING_BUNNY,
    note: 'Indie brand certified cruelty-free.',
  },
  {
    brand: 'Fern & Field',
    names: ['fern & field', 'fern and field', 'fern field', 'fern'],
    status: 'certified_vegan',
    certifier: LEAPING_BUNNY,
    note: 'Indie brand certified cruelty-free and vegan.',
  },

  // ── Certified brand, larger parent (contested) ─────────────────────────────
  {
    brand: 'Drunk Elephant',
    names: ['drunk elephant', 'drunkelephant'],
    status: 'certified',
    certifier: `${LEAPING_BUNNY}; parent Shiseido`,
    note: 'Brand is cruelty-free; owned by Shiseido. Some consider parent-company conduct disqualifying.',
  },
  {
    brand: "Burt's Bees",
    names: ["burt's bees", 'burts bees', 'burt bees'],
    status: 'certified',
    certifier: `${LEAPING_BUNNY}; parent Clorox`,
    note: 'Brand is cruelty-free; owned by Clorox.',
  },
  {
    brand: 'The Ordinary',
    names: ['the ordinary', 'ordinary', 'theordinary', 'deciem'],
    status: 'parent_conflict',
    certifier: `Brand states cruelty-free; parent Estée Lauder — ${PARENT_MARKET}`,
    note: 'Brand markets itself cruelty-free, but parent Estée Lauder sells in markets requiring animal testing — status is debated.',
  },

  // ── Not certified (parent sells where testing is required) ─────────────────
  {
    brand: 'CeraVe',
    names: ['cerave', 'cera ve'],
    status: 'not_certified',
    certifier: `Parent L'Oréal — ${PARENT_MARKET}`,
    note: "Owned by L'Oréal, which sells in markets requiring animal testing; not certified cruelty-free.",
  },
  {
    brand: 'La Roche-Posay',
    names: ['la roche-posay', 'la roche posay', 'larocheposay'],
    status: 'not_certified',
    certifier: `Parent L'Oréal — ${PARENT_MARKET}`,
    note: "Owned by L'Oréal; not certified cruelty-free.",
  },
  {
    brand: 'Maybelline',
    names: ['maybelline', 'maybelline new york', 'maybelline ny'],
    status: 'not_certified',
    certifier: `Parent L'Oréal — ${PARENT_MARKET}`,
    note: "Owned by L'Oréal; not certified cruelty-free.",
  },
  {
    brand: 'Neutrogena',
    names: ['neutrogena'],
    status: 'not_certified',
    certifier: `Parent Kenvue/J&J — ${PARENT_MARKET}`,
    note: 'Owned by Kenvue (formerly J&J); not certified cruelty-free.',
  },
  {
    brand: 'Aveeno',
    names: ['aveeno'],
    status: 'not_certified',
    certifier: `Parent Kenvue/J&J — ${PARENT_MARKET}`,
    note: 'Owned by Kenvue (formerly J&J); not certified cruelty-free.',
  },
];
