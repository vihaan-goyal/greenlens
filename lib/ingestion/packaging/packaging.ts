// Derived packaging-recyclability scorer — pure, imports nothing from React/Next.
//
// Turns a product's packaging materials (the tags Open Beauty Facts records —
// "en:glass", "en:pp-polypropylene", "en:plastic", …) into a transparent 0..100
// recyclability score (higher = easier to recycle) plus per-component reasoning,
// by matching each material against the open reference in packaging-data.ts.
//
// This is the coverage lever for the `packaging` axis: OBF carries packaging-
// material tags for far more cosmetics than it has a computed Eco-Score, so this
// lifts the long tail the matcher's coverage-bias test warns about. It is one
// opinion, surfaced as its own Source so it can disagree with a label rater like
// How2Recycle rather than being blended into a false consensus.

import type { Listing, Rating, Source } from '../../domain/types';
import { verdictBand, VERDICT_LABEL } from '../../domain/verdict';
import {
  MATERIAL_ENTRIES,
  TIER_LABEL,
  TIER_SCORE,
  type MaterialEntry,
  type RecyclabilityTier,
} from './packaging-data';

export const PACKAGING_SOURCE_ID = 'packaging-scan';

/**
 * The Source row for the derived scan. Funding model is `independent`: it is
 * Greenlens's own computation over open packaging standards — no advertiser,
 * subscription, or nonprofit org behind it. Shown next to every rating, as the
 * product requires. 0..100, higher = more recyclable, so no scale inversion.
 */
export const PACKAGING_SOURCE: Source = {
  id: PACKAGING_SOURCE_ID,
  name: 'Greenlens Packaging Scan',
  axis: 'packaging',
  scaleMin: 0,
  scaleMax: 100,
  scaleDirection: 'higher_is_better',
  fundingModel: 'independent',
};

/** Strip an OBF language prefix ("en:"), lowercase, split on non-alphanumerics. */
function tokenize(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/^[a-z]{2}:/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/**
 * The reference entry a material tag matches, or null. MATERIAL_ENTRIES is in
 * priority order (components → specific resins → generic plastic → bulk), and we
 * take the first entry any of whose synonyms appears as a whole token — so
 * "pp-pump" matches the pump component, "pet-1" matches PET, "bottle" matches
 * nothing (it's a shape, not a material).
 */
function matchMaterial(raw: string): MaterialEntry | null {
  const tokens = new Set(tokenize(raw));
  if (tokens.size === 0) return null;
  for (const entry of MATERIAL_ENTRIES) {
    if (entry.synonyms.some((syn) => tokens.has(syn))) return entry;
  }
  return null;
}

const entryScore = (e: MaterialEntry): number => e.score ?? TIER_SCORE[e.tier];

export interface PackagingMatch {
  /** The material as written on the product / OBF tag. */
  material: string;
  tier: RecyclabilityTier;
  tierLabel: string;
  name: string;
  reason: string;
  citation: string;
  /** This component's 0..100 recyclability score (higher = more recyclable). */
  score: number;
}

export interface PackagingAssessment {
  /** 0..100, higher = more recyclable. Mean of recognized components. */
  score: number;
  /** Verdict-band label (Excellent…Bad), for display next to the score. */
  label: string;
  /** Every recognized packaging component, with tier + reasoning + citation. */
  matches: PackagingMatch[];
  /** Total material tags supplied (including ones we didn't recognize). */
  materialCount: number;
  /** One-line plain-English summary of the result. */
  summary: string;
}

/**
 * Score a list of packaging material tags. The overall is the *mean* of the
 * recognized components: a glass bottle with a plastic pump is partly recyclable,
 * and the mean reflects that the pump drags an otherwise-clean pack down. Returns
 * null when no tag is a recognized material — the caller should show "no
 * packaging data", never a fabricated score.
 */
export function scorePackaging(materials: ReadonlyArray<string>): PackagingAssessment | null {
  const cleaned = materials.map((m) => m.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;

  // Match each tag, de-duping by reference entry so two "glass" tags count once.
  const seen = new Set<string>();
  const matches: PackagingMatch[] = [];
  let hasSpecificResin = false;
  for (const material of cleaned) {
    const entry = matchMaterial(material);
    if (!entry || seen.has(entry.name)) continue;
    seen.add(entry.name);
    if (entry.resinSpecific) hasSpecificResin = true;
    matches.push({
      material,
      tier: entry.tier,
      tierLabel: TIER_LABEL[entry.tier],
      name: entry.name,
      reason: entry.reason,
      citation: entry.citation,
      score: entryScore(entry),
    });
  }

  // Drop the generic "plastic (unspecified)" bucket when a specific resin is also
  // present — they describe the same part, and the specific resin is the truth.
  const effective = hasSpecificResin
    ? matches.filter((m) => m.name !== 'Plastic (unspecified)')
    : matches;

  if (effective.length === 0) return null;

  const mean = effective.reduce((sum, m) => sum + m.score, 0) / effective.length;
  const score = Math.round(Math.max(0, Math.min(100, mean)));
  const band = verdictBand(score);

  return {
    score,
    label: band ? VERDICT_LABEL[band] : 'Unknown',
    matches: effective,
    materialCount: cleaned.length,
    summary: summarize(effective),
  };
}

function summarize(matches: ReadonlyArray<PackagingMatch>): string {
  const n = matches.length;
  const noun = `${n} packaging component${n === 1 ? '' : 's'}`;
  // Lead with the component that limits recyclability the most.
  const worst = matches.reduce((a, b) => (b.score < a.score ? b : a));
  const best = matches.reduce((a, b) => (b.score > a.score ? b : a));
  if (n === 1) {
    return `${best.name} — ${best.tierLabel}.`;
  }
  return `${noun}: best is ${best.name} (${best.tierLabel}), limited by ${worst.name} (${worst.tierLabel}).`;
}

/** The full assessment is stored as the Listing payload so nothing is lost. */
export interface PackagingListingInput {
  productId: string;
  displayName: string;
  brandName?: string;
  gtin?: string;
  /** The packaging material tags this assessment was computed from. */
  materials: string[];
}

/**
 * Build the synthetic Listing + Rating that carry a packaging assessment for one
 * product. The "listing" is our computed assessment record: the same data shape
 * an external source would produce, so it flows through the existing read path
 * (summarizePillars → RaterList → disagreement) with no special-casing. The
 * payload preserves the per-component reasoning for the flag screen.
 */
export function buildPackagingListing(
  input: PackagingListingInput,
  assessment: PackagingAssessment,
  opts: { now?: Date } = {},
): { listing: Listing; rating: Rating } {
  const now = opts.now ?? new Date();
  const listingId = `pk-${input.productId}`;
  const listing: Listing = {
    id: listingId,
    sourceId: PACKAGING_SOURCE_ID,
    nativeId: input.productId,
    rawName: input.displayName,
    rawBrand: input.brandName ?? '',
    rawGtin: input.gtin,
    // Packaging materials, not ingredients — kept on the listing so the scan is
    // reproducible from its own record.
    rawIngredients: input.materials,
    url: '/methodology#packaging',
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
