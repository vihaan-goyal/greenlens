// Curated packaging-recyclability reference, derived from open standards.
//
// This is the knowledge base the packaging scorer reads. Like hazard-data.ts it
// is shipped as data (not fetched live) so the scorer stays pure, deterministic
// and testable — refresh it from upstream periodically rather than at scoring
// time.
//
// Sources (all open / public):
//   - SPI/ASTM D7611 resin identification codes (#1 PET … #7 OTHER)
//   - How2Recycle label guidance + APR Design Guide on curbside acceptance
//   - EU Packaging & Packaging Waste Directive (recyclability of materials)
//
// This is one transparent, reproducible signal on the `packaging` axis. It rates
// the *recyclability of the materials*, not the carbon footprint or refill story,
// and it is meant to be shown alongside — and free to disagree with — a label
// rater like How2Recycle. "Not recognized" means the tag wasn't a material we
// score (e.g. a shape like "bottle"), never "unrecyclable".

export type RecyclabilityTier =
  | 'widely_recyclable'
  | 'limited'
  | 'rarely_recyclable'
  | 'not_recyclable';

/** Fallback score for a tier when an entry doesn't set its own. Higher = more
 *  recyclable, on the same 0..100 scale the rest of the app normalizes to. */
export const TIER_SCORE: Record<RecyclabilityTier, number> = {
  widely_recyclable: 88,
  limited: 52,
  rarely_recyclable: 28,
  not_recyclable: 14,
};

/** Plain-English tier label, shown next to each matched component. */
export const TIER_LABEL: Record<RecyclabilityTier, string> = {
  widely_recyclable: 'widely recyclable',
  limited: 'limited recyclability',
  rarely_recyclable: 'rarely recycled',
  not_recyclable: 'hard to recycle',
};

export interface MaterialEntry {
  /** Canonical display name. */
  name: string;
  /** Normalized single-token synonyms; matched against a material tag's tokens. */
  synonyms: string[];
  tier: RecyclabilityTier;
  /** Optional per-material override of TIER_SCORE[tier] for finer nuance. */
  score?: number;
  /** True for a specific plastic resin, so a generic "plastic" tag is dropped
   *  when a specific resin is also present (avoids double-counting one part). */
  resinSpecific?: boolean;
  /** True for a whole-component problem (pump, laminate) that overrides resin. */
  component?: boolean;
  /** Plain-spoken reason a non-expert can read. */
  reason: string;
  /** Where the classification comes from. */
  citation: string;
}

const RESIN_CODE = 'SPI/ASTM resin identification code; typical curbside acceptance';
const CURBSIDE = 'Common curbside acceptance (How2Recycle / APR Design Guide)';
const COMPONENT = 'Multi-material or small component — typically not curbside-recyclable';

// Order matters: the scorer takes the *first* entry whose synonym appears in a
// material tag's tokens. Whole-component problems (pump/laminate) come first so a
// "pp pump" scores as a pump, not as plain polypropylene; specific resins next;
// the generic "plastic" catch-all after them; bulk materials last.
export const MATERIAL_ENTRIES: MaterialEntry[] = [
  // ── Whole-component problems (override resin) ──────────────────────────────
  {
    name: 'Pump / dispenser',
    synonyms: ['pump', 'dispenser', 'sprayer', 'spray', 'trigger', 'dropper', 'applicator'],
    tier: 'not_recyclable',
    score: 18,
    component: true,
    reason: 'Pumps and sprayers mix plastic with a metal spring, so curbside programs reject them.',
    citation: COMPONENT,
  },
  {
    name: 'Laminate / composite',
    synonyms: ['laminate', 'laminated', 'composite', 'multilayer', 'multimaterial', 'tube', 'sachet', 'blister'],
    tier: 'not_recyclable',
    score: 16,
    component: true,
    reason: 'Bonded layers of different materials cannot be separated, so they are not recyclable.',
    citation: COMPONENT,
  },
  // ── Specific plastic resins (by resin code) ────────────────────────────────
  {
    name: 'PET (#1)',
    synonyms: ['pet', 'pete', 'polyethyleneterephthalate', 'terephthalate', '1'],
    tier: 'widely_recyclable',
    score: 80,
    resinSpecific: true,
    reason: 'PET bottles (#1) are accepted by nearly every curbside program.',
    citation: RESIN_CODE,
  },
  {
    name: 'HDPE (#2)',
    synonyms: ['hdpe', '2'],
    tier: 'widely_recyclable',
    score: 78,
    resinSpecific: true,
    reason: 'HDPE (#2) — milk-jug plastic — is widely accepted curbside.',
    citation: RESIN_CODE,
  },
  {
    name: 'PVC (#3)',
    synonyms: ['pvc', 'vinyl', 'polyvinylchloride', '3'],
    tier: 'not_recyclable',
    score: 12,
    resinSpecific: true,
    reason: 'PVC (#3) is almost never accepted and can contaminate other recycling.',
    citation: RESIN_CODE,
  },
  {
    name: 'LDPE (#4)',
    synonyms: ['ldpe', '4'],
    tier: 'rarely_recyclable',
    score: 30,
    resinSpecific: true,
    reason: 'LDPE (#4) films and squeeze tubes are rarely taken curbside.',
    citation: RESIN_CODE,
  },
  {
    name: 'PP (#5)',
    synonyms: ['pp', 'polypropylene', '5'],
    tier: 'limited',
    score: 55,
    resinSpecific: true,
    reason: 'PP (#5) — common for caps and jars — is increasingly but not universally accepted.',
    citation: RESIN_CODE,
  },
  {
    name: 'PS (#6)',
    synonyms: ['ps', 'polystyrene', 'styrofoam', '6'],
    tier: 'rarely_recyclable',
    score: 22,
    resinSpecific: true,
    reason: 'Polystyrene (#6) is rejected by most curbside programs.',
    citation: RESIN_CODE,
  },
  {
    name: 'Other plastic (#7)',
    synonyms: ['o', 'other', '7', 'pla', 'bioplastic', 'acrylic', 'pmma', 'san', 'abs'],
    tier: 'rarely_recyclable',
    score: 26,
    resinSpecific: true,
    reason: 'Mixed or "#7 other" plastics — including most bioplastics — lack a recycling stream.',
    citation: RESIN_CODE,
  },
  // ── Generic plastic (unknown resin) ────────────────────────────────────────
  {
    name: 'Plastic (unspecified)',
    synonyms: ['plastic'],
    tier: 'limited',
    score: 46,
    reason: 'Resin not identified — recyclability depends on which plastic it is.',
    citation: CURBSIDE,
  },
  // ── Bulk materials ─────────────────────────────────────────────────────────
  {
    name: 'Glass',
    synonyms: ['glass'],
    tier: 'widely_recyclable',
    score: 92,
    reason: 'Glass is endlessly recyclable and accepted almost everywhere.',
    citation: CURBSIDE,
  },
  {
    name: 'Aluminium',
    synonyms: ['aluminium', 'aluminum', 'alu'],
    tier: 'widely_recyclable',
    score: 88,
    reason: 'Aluminium is highly recyclable and valuable to recyclers.',
    citation: CURBSIDE,
  },
  {
    name: 'Steel / tin',
    synonyms: ['steel', 'tin', 'iron', 'tinplate'],
    tier: 'widely_recyclable',
    score: 85,
    reason: 'Steel and tinplate are magnetically sorted and widely recycled.',
    citation: CURBSIDE,
  },
  {
    name: 'Metal (unspecified)',
    synonyms: ['metal'],
    tier: 'widely_recyclable',
    score: 82,
    reason: 'Metal packaging is generally recyclable where curbside metal is accepted.',
    citation: CURBSIDE,
  },
  {
    name: 'Paper / cardboard',
    synonyms: ['paper', 'cardboard', 'card', 'carton', 'paperboard', 'corrugated', 'kraft', 'fibre', 'fiber'],
    tier: 'widely_recyclable',
    score: 82,
    reason: 'Clean paper and cardboard are accepted by the vast majority of programs.',
    citation: CURBSIDE,
  },
];
