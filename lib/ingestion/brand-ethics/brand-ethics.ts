// Brand-level ethics rater — pure, imports nothing from React/Next.
//
// Resolves a product's brand (and, optionally, its parent brand) against the
// open cruelty-free / vegan certification lists in brand-ethics-data.ts and
// emits a rating on the `labor` ethics axis. Because the signal is per-brand, a
// single dataset row rates every product of that brand — the coverage multiplier
// that a per-product review can't match.
//
// Surfaced as its own Source so it can disagree with a holistic ethics rater
// (e.g. Good On You rates People/Planet/Animals; this rates the animal-testing
// dimension only) instead of being averaged into a false consensus.

import type { Listing, Rating, Source } from '../../domain/types';
import { verdictBand, VERDICT_LABEL } from '../../domain/verdict';
import {
  AS_OF,
  BRAND_ETHICS_ENTRIES,
  STATUS_SCORE,
  type BrandEthicsEntry,
  type CrueltyStatus,
} from './brand-ethics-data';

export const BRAND_ETHICS_SOURCE_ID = 'cruelty-free';

/**
 * The Source row. Funding model is `nonprofit`: the certifications behind it
 * (Leaping Bunny, PETA) are run by nonprofits. 0..100, higher = more aligned.
 */
export const BRAND_ETHICS_SOURCE: Source = {
  id: BRAND_ETHICS_SOURCE_ID,
  name: 'Cruelty-Free Certification',
  axis: 'labor',
  scaleMin: 0,
  scaleMax: 100,
  scaleDirection: 'higher_is_better',
  fundingModel: 'nonprofit',
};

/** Lowercase, strip non-alphanumerics — same shape the matcher uses for brands. */
function normBrand(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const LOOKUP: Map<string, BrandEthicsEntry> = (() => {
  const m = new Map<string, BrandEthicsEntry>();
  for (const entry of BRAND_ETHICS_ENTRIES) {
    for (const name of entry.names) {
      const key = normBrand(name);
      if (key) m.set(key, entry);
    }
  }
  return m;
})();

/**
 * Find a certification entry for any of the supplied brand names (a brand's own
 * name + aliases, optionally followed by its parent's). Returns the first hit so
 * a brand's own listing wins over its parent's.
 */
export function resolveBrandEthics(names: ReadonlyArray<string>): BrandEthicsEntry | null {
  for (const name of names) {
    const entry = LOOKUP.get(normBrand(name));
    if (entry) return entry;
  }
  return null;
}

export interface BrandEthicsAssessment {
  /** 0..100, higher = more aligned. */
  score: number;
  /** Verdict-band label, for display next to the score. */
  label: string;
  status: CrueltyStatus;
  certifier: string;
  note: string;
  /** Certification snapshot date — statuses change, so this is shown. */
  asOf: string;
}

export function assessBrandEthics(entry: BrandEthicsEntry): BrandEthicsAssessment {
  const score = STATUS_SCORE[entry.status];
  const band = verdictBand(score);
  return {
    score,
    label: band ? VERDICT_LABEL[band] : 'Unknown',
    status: entry.status,
    certifier: entry.certifier,
    note: entry.note,
    asOf: AS_OF,
  };
}

export interface BrandEthicsListingInput {
  productId: string;
  displayName: string;
  brandName: string;
  gtin?: string;
}

/**
 * Build the synthetic Listing + Rating carrying a brand-ethics assessment for one
 * product. Same shape an external rater would produce, so it flows through the
 * existing read path with no special-casing; the payload keeps the certifier +
 * reasoning for the flag/disagreement screen.
 */
export function buildBrandEthicsListing(
  input: BrandEthicsListingInput,
  assessment: BrandEthicsAssessment,
  opts: { now?: Date } = {},
): { listing: Listing; rating: Rating } {
  const now = opts.now ?? new Date();
  const listingId = `be-${input.productId}`;
  const listing: Listing = {
    id: listingId,
    sourceId: BRAND_ETHICS_SOURCE_ID,
    nativeId: input.brandName,
    rawName: input.displayName,
    rawBrand: input.brandName,
    rawGtin: input.gtin,
    rawIngredients: [],
    url: '/methodology#cruelty-free',
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
