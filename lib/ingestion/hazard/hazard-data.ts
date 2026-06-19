// Curated ingredient-hazard reference, derived from open regulatory sources.
//
// This is the knowledge base the ingredient-safety scorer reads. It is shipped
// as data (not fetched live) so the scorer stays pure, deterministic, and
// testable — refresh it from upstream periodically rather than at scoring time.
//
// Sources (all open / public):
//   - EU Cosmetics Regulation (EC) No 1223/2009
//       Annex II  — prohibited substances
//       Annex III — restricted substances + the regulated fragrance allergens
//       Annex V   — allowed preservatives (with limits)
//   - Widely-cited transparency concerns (e.g. undisclosed "fragrance") are
//     marked 'concern', not as regulatory fact — see `category` below.
//
// This is one transparent, reproducible signal on the ingredient_safety axis.
// It is NOT a verdict on whether a product is "safe for you", and it is meant to
// be shown alongside — and free to disagree with — EWG / Yuka / INCI Beauty.
// Absence of a flag means "no *regulated* hazard recognized", never "proven
// safe": most benign ingredients simply aren't in this table.

export type HazardCategory = 'prohibited' | 'restricted' | 'allergen' | 'concern';

export interface HazardEntry {
  /** Canonical display name. */
  name: string;
  /** INCI / common-name synonyms; normalized at load time for lookup. */
  synonyms: string[];
  category: HazardCategory;
  /** Plain-spoken reason a non-chemist can read. */
  reason: string;
  /** Where the classification comes from. */
  citation: string;
}

// Penalty applied per matched ingredient, by category. Higher = bigger hit to
// the 0..100 (higher = safer) score. Allergen hits are individually small but
// accumulate (see ALLERGEN_PENALTY_CAP) so a fragrance-heavy product isn't
// zeroed by allergen labeling alone.
export const CATEGORY_PENALTY: Record<HazardCategory, number> = {
  prohibited: 55,
  restricted: 12,
  concern: 10,
  allergen: 6,
};

/** Total penalty from `allergen` matches is capped here (allergen *load*). */
export const ALLERGEN_PENALTY_CAP = 30;

const ANNEX_II = 'EU Cosmetics Regulation Annex II (prohibited)';
const ANNEX_III = 'EU Cosmetics Regulation Annex III (restricted)';
const ANNEX_III_ALLERGEN = 'EU Cosmetics Regulation Annex III (labelled fragrance allergen)';
const ANNEX_V = 'EU Cosmetics Regulation Annex V (preservative, with limits)';
const TRANSPARENCY = 'Common transparency/sensitization concern (not a regulatory ban)';

export const HAZARD_ENTRIES: HazardEntry[] = [
  // ── Prohibited (should not appear in compliant cosmetics) ──────────────────
  {
    name: 'Formaldehyde',
    synonyms: ['formaldehyde', 'formalin', 'methanal'],
    category: 'prohibited',
    reason: 'Banned as an intentionally-added ingredient in the EU; a known sensitizer and carcinogen.',
    citation: ANNEX_II,
  },
  {
    name: 'Butylphenyl Methylpropional (Lilial)',
    synonyms: ['butylphenylmethylpropional', 'lilial', '2(4tertbutylbenzyl)propionaldehyde'],
    category: 'prohibited',
    reason: 'Banned in the EU since 2022 over reproductive-toxicity concerns; still found in older/imported stock.',
    citation: ANNEX_II,
  },
  {
    name: 'Mercury / Thimerosal',
    synonyms: ['mercury', 'thimerosal', 'thiomersal', 'phenylmercuricacetate'],
    category: 'prohibited',
    reason: 'Mercury compounds are prohibited in cosmetics (narrow eye-preservative exception); cumulative toxin.',
    citation: ANNEX_II,
  },
  {
    name: 'Lead Acetate',
    synonyms: ['leadacetate'],
    category: 'prohibited',
    reason: 'Prohibited heavy-metal colorant; neurotoxic, no safe level for cumulative exposure.',
    citation: ANNEX_II,
  },
  {
    name: 'Hydroquinone',
    synonyms: ['hydroquinone'],
    category: 'prohibited',
    reason: 'Banned in leave-on cosmetics in the EU (skin-lightening); permitted only in some nail products.',
    citation: ANNEX_II,
  },

  // ── Restricted (legal with limits / documented concern) ────────────────────
  {
    name: 'Phenoxyethanol',
    synonyms: ['phenoxyethanol'],
    category: 'restricted',
    reason: 'Allowed preservative up to 1%; a contact sensitizer for some, with infant-exposure cautions.',
    citation: ANNEX_V,
  },
  {
    name: 'Salicylic Acid',
    synonyms: ['salicylicacid'],
    category: 'restricted',
    reason: 'Restricted concentrations; not advised for young children except in rinse-off.',
    citation: ANNEX_III,
  },
  {
    name: 'Triclosan',
    synonyms: ['triclosan'],
    category: 'restricted',
    reason: 'Restricted antibacterial; endocrine-disruption and resistance concerns.',
    citation: ANNEX_V,
  },
  {
    name: 'Benzophenone-3 (Oxybenzone)',
    synonyms: ['benzophenone3', 'oxybenzone'],
    category: 'restricted',
    reason: 'Restricted UV filter; endocrine-activity and reef-toxicity concerns; concentration-limited.',
    citation: ANNEX_III,
  },
  {
    name: 'Propylparaben',
    synonyms: ['propylparaben'],
    category: 'restricted',
    reason: 'Allowed but concentration-restricted paraben preservative; endocrine-activity debate.',
    citation: ANNEX_III,
  },
  {
    name: 'Butylparaben',
    synonyms: ['butylparaben'],
    category: 'restricted',
    reason: 'Allowed but concentration-restricted paraben preservative; endocrine-activity debate.',
    citation: ANNEX_III,
  },
  {
    name: 'Retinol',
    synonyms: ['retinol', 'retinylpalmitate', 'retinylacetate'],
    category: 'restricted',
    reason: 'EU now caps retinol in leave-on products (0.3%); irritation and photosensitivity.',
    citation: ANNEX_III,
  },

  // ── Concern (commonly flagged; not a regulatory ban) ───────────────────────
  {
    name: 'Fragrance / Parfum (undisclosed)',
    synonyms: ['fragrance', 'parfum', 'aroma', 'fragranceparfum'],
    category: 'concern',
    reason: 'An undisclosed blend; can hide allergens and sensitizers that are not individually labelled.',
    citation: TRANSPARENCY,
  },
  {
    name: 'Methylparaben',
    synonyms: ['methylparaben', 'ethylparaben'],
    category: 'concern',
    reason: 'Generally permitted paraben preservative; lower-concern than propyl/butyl but often avoided.',
    citation: TRANSPARENCY,
  },
  {
    name: 'BHT / BHA',
    synonyms: ['bht', 'butylatedhydroxytoluene', 'bha', 'butylatedhydroxyanisole'],
    category: 'concern',
    reason: 'Synthetic antioxidants with endocrine-disruption questions at higher exposures.',
    citation: TRANSPARENCY,
  },
  {
    name: 'Sodium Lauryl Sulfate',
    synonyms: ['sodiumlaurylsulfate'],
    category: 'concern',
    reason: 'Effective surfactant but a common irritant for sensitive or compromised skin.',
    citation: TRANSPARENCY,
  },

  // ── Regulated fragrance allergens (EU Annex III labelling list) ────────────
  ...([
    ['Limonene', ['limonene', 'dlimonene']],
    ['Linalool', ['linalool']],
    ['Citronellol', ['citronellol']],
    ['Geraniol', ['geraniol']],
    ['Citral', ['citral']],
    ['Eugenol', ['eugenol']],
    ['Coumarin', ['coumarin']],
    ['Benzyl Alcohol', ['benzylalcohol']],
    ['Benzyl Salicylate', ['benzylsalicylate']],
    ['Benzyl Benzoate', ['benzylbenzoate']],
    ['Hydroxycitronellal', ['hydroxycitronellal']],
    ['Isoeugenol', ['isoeugenol']],
    ['Cinnamal', ['cinnamal']],
    ['Cinnamyl Alcohol', ['cinnamylalcohol']],
    ['Amyl Cinnamal', ['amylcinnamal']],
    ['Hexyl Cinnamal', ['hexylcinnamal']],
    ['Farnesol', ['farnesol']],
    ['Alpha-Isomethyl Ionone', ['alphaisomethylionone']],
    ['Evernia Prunastri (Oakmoss) Extract', ['everniaprunastriextract', 'oakmoss']],
  ] as const).map(
    ([name, synonyms]): HazardEntry => ({
      name,
      synonyms: [...synonyms],
      category: 'allergen',
      reason: 'An EU-regulated fragrance allergen that must be labelled; a common contact-sensitization trigger.',
      citation: ANNEX_III_ALLERGEN,
    }),
  ),
];
