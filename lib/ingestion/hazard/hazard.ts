// Derived ingredient-safety scorer — pure, imports nothing from React/Next.
//
// Turns a product's INCI ingredient list into a transparent 0..100 safety score
// (higher = safer) plus per-ingredient reasoning, by matching each ingredient
// against the open-regulatory reference in hazard-data.ts. This is the lever for
// *coverage*: unlike a third-party review that exists only for popular products,
// it produces a rating for any product that has an ingredient list — so it lifts
// the long tail the matcher's coverage-bias test warns about.
//
// It is one opinion on the ingredient_safety axis, surfaced as its own Source so
// it can disagree with EWG / Yuka / INCI Beauty rather than being blended in.

import type { Listing, Rating, Source } from '../../domain/types';
import { verdictBand, VERDICT_LABEL } from '../../domain/verdict';
import { normalizeIngredient } from '../../matcher/features';
import {
  ALLERGEN_PENALTY_CAP,
  CATEGORY_PENALTY,
  HAZARD_ENTRIES,
  type HazardCategory,
  type HazardEntry,
} from './hazard-data';

export const HAZARD_SOURCE_ID = 'ingredient-hazard';

/**
 * The Source row for the derived scan. Funding model is `independent`: it is
 * Greenlens's own computation over public regulatory data — no advertiser,
 * subscription, or nonprofit org behind it. Shown next to every rating, as the
 * product requires. 0..100, higher = safer, so it needs no scale inversion.
 */
export const HAZARD_SOURCE: Source = {
  id: HAZARD_SOURCE_ID,
  name: 'Greenlens Ingredient Scan',
  axis: 'ingredient_safety',
  scaleMin: 0,
  scaleMax: 100,
  scaleDirection: 'higher_is_better',
  fundingModel: 'independent',
};

// Normalized-synonym → entry lookup, built once. normalizeIngredient is the same
// transform the matcher uses, so "Limonene", "limonene" and "LIMONENE" collide,
// as do "Parfum" / "Fragrance" via shared synonyms.
const LOOKUP: Map<string, HazardEntry> = (() => {
  const m = new Map<string, HazardEntry>();
  for (const entry of HAZARD_ENTRIES) {
    for (const syn of entry.synonyms) {
      const key = normalizeIngredient(syn);
      if (key) m.set(key, entry);
    }
  }
  return m;
})();

export interface HazardMatch {
  /** The ingredient as written on the product. */
  ingredient: string;
  category: HazardCategory;
  name: string;
  reason: string;
  citation: string;
  /** Points this match subtracted from the score (after the allergen cap). */
  penalty: number;
}

export interface HazardAssessment {
  /** 0..100, higher = safer. */
  score: number;
  /** Verdict-band label (Excellent…Bad), for display next to the score. */
  label: string;
  /** Every flagged ingredient, with category + reasoning + citation. */
  matches: HazardMatch[];
  /** Total ingredients considered. */
  ingredientCount: number;
  /** One-line plain-English summary of the result. */
  summary: string;
}

/**
 * Score an ingredient list. Penalty-based: start at 100 (no *recognized*
 * regulated hazard) and subtract per match. Allergen penalties are capped so
 * allergen labelling alone can't tank a score. Returns null when there are no
 * ingredients to assess — the caller should show "no ingredient data", never a
 * fabricated 100.
 */
export function scoreIngredientHazard(ingredients: ReadonlyArray<string>): HazardAssessment | null {
  const cleaned = ingredients.map((i) => i.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;

  // De-dupe by normalized key so a repeated ingredient is penalized once.
  const seen = new Set<string>();
  const raw: Array<{ ingredient: string; entry: HazardEntry }> = [];
  for (const ingredient of cleaned) {
    const key = normalizeIngredient(ingredient);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const entry = LOOKUP.get(key);
    if (entry) raw.push({ ingredient, entry });
  }

  // Apply penalties, capping the cumulative allergen contribution.
  let allergenSpent = 0;
  const matches: HazardMatch[] = raw.map(({ ingredient, entry }) => {
    const base = CATEGORY_PENALTY[entry.category];
    let penalty = base;
    if (entry.category === 'allergen') {
      penalty = Math.max(0, Math.min(base, ALLERGEN_PENALTY_CAP - allergenSpent));
      allergenSpent += penalty;
    }
    return {
      ingredient,
      category: entry.category,
      name: entry.name,
      reason: entry.reason,
      citation: entry.citation,
      penalty,
    };
  });

  const totalPenalty = matches.reduce((sum, m) => sum + m.penalty, 0);
  const score = Math.round(Math.max(0, Math.min(100, 100 - totalPenalty)));
  const band = verdictBand(score);

  return {
    score,
    label: band ? VERDICT_LABEL[band] : 'Unknown',
    matches,
    ingredientCount: cleaned.length,
    summary: summarize(matches, cleaned.length),
  };
}

function summarize(matches: ReadonlyArray<HazardMatch>, total: number): string {
  if (matches.length === 0) {
    return `No EU-regulated hazards recognized among ${total} ingredient${total === 1 ? '' : 's'}.`;
  }
  const counts = new Map<HazardCategory, number>();
  for (const m of matches) counts.set(m.category, (counts.get(m.category) ?? 0) + 1);
  const order: HazardCategory[] = ['prohibited', 'restricted', 'concern', 'allergen'];
  const phrase: Record<HazardCategory, (n: number) => string> = {
    prohibited: (n) => `${n} prohibited`,
    restricted: (n) => `${n} restricted`,
    concern: (n) => `${n} of concern`,
    allergen: (n) => `${n} regulated allergen${n === 1 ? '' : 's'}`,
  };
  const parts = order.filter((c) => counts.has(c)).map((c) => phrase[c](counts.get(c)!));
  return `Flagged ${matches.length} of ${total} ingredients: ${parts.join(', ')}.`;
}

/** The full assessment is stored as the Listing payload so nothing is lost. */
export interface HazardListingInput {
  productId: string;
  displayName: string;
  brandName?: string;
  gtin?: string;
  ingredients: string[];
}

/**
 * Build the synthetic Listing + Rating that carry a hazard assessment for one
 * product. The "listing" is our computed assessment record: the same data shape
 * an external source would produce, so it flows through the existing read path
 * (summarizePillars → RaterList → disagreement) with no special-casing. The
 * payload preserves the per-ingredient reasoning for the flag screen.
 */
export function buildHazardListing(
  input: HazardListingInput,
  assessment: HazardAssessment,
  opts: { now?: Date } = {},
): { listing: Listing; rating: Rating } {
  const now = opts.now ?? new Date();
  const listingId = `hz-${input.productId}`;
  const listing: Listing = {
    id: listingId,
    sourceId: HAZARD_SOURCE_ID,
    nativeId: input.productId,
    rawName: input.displayName,
    rawBrand: input.brandName ?? '',
    rawGtin: input.gtin,
    rawIngredients: input.ingredients,
    url: '/methodology#ingredient-hazard',
    payload: assessment,
    fetchedAt: now,
  };
  const rating: Rating = {
    id: `r-${listingId}`,
    listingId,
    scoreRaw: assessment.score,
    scoreLabel: assessment.label,
    ingestedAt: now,
  };
  return { listing, rating };
}
