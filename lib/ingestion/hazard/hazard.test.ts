import { describe, expect, it } from 'vitest';
import { ALLERGEN_PENALTY_CAP, CATEGORY_PENALTY } from './hazard-data';
import {
  buildHazardListing,
  HAZARD_SOURCE,
  HAZARD_SOURCE_ID,
  scoreIngredientHazard,
} from './hazard';

describe('scoreIngredientHazard', () => {
  it('returns null for an empty / whitespace-only ingredient list', () => {
    expect(scoreIngredientHazard([])).toBeNull();
    expect(scoreIngredientHazard(['', '   '])).toBeNull();
  });

  it('scores a clean list 100 with no matches', () => {
    const a = scoreIngredientHazard(['Aqua', 'Glycerin', 'Sodium Hyaluronate', 'Tocopherol'])!;
    expect(a.score).toBe(100);
    expect(a.matches).toHaveLength(0);
    expect(a.label).toBe('Excellent');
    expect(a.summary).toMatch(/No EU-regulated hazards/);
  });

  it('penalizes a restricted preservative', () => {
    const a = scoreIngredientHazard(['Aqua', 'Glycerin', 'Phenoxyethanol'])!;
    expect(a.score).toBe(100 - CATEGORY_PENALTY.restricted);
    expect(a.matches).toHaveLength(1);
    expect(a.matches[0]).toMatchObject({ category: 'restricted', name: 'Phenoxyethanol' });
  });

  it('normalizes case and punctuation when matching (Limonene/LIMONENE)', () => {
    const lower = scoreIngredientHazard(['Aqua', 'limonene'])!;
    const upper = scoreIngredientHazard(['Aqua', 'LIMONENE'])!;
    expect(lower.score).toBe(upper.score);
    expect(lower.matches[0]?.category).toBe('allergen');
  });

  it('treats Fragrance and Parfum as the same concern via synonyms', () => {
    const frag = scoreIngredientHazard(['Aqua', 'Fragrance'])!;
    const parf = scoreIngredientHazard(['Aqua', 'Parfum'])!;
    expect(frag.matches[0]?.name).toBe(parf.matches[0]?.name);
    expect(frag.matches[0]?.category).toBe('concern');
  });

  it('de-dupes a repeated ingredient so it is penalized once', () => {
    const once = scoreIngredientHazard(['Phenoxyethanol'])!;
    const twice = scoreIngredientHazard(['Phenoxyethanol', 'phenoxyethanol'])!;
    expect(twice.score).toBe(once.score);
    expect(twice.matches).toHaveLength(1);
  });

  it('caps cumulative allergen load so labelling alone cannot tank a score', () => {
    const manyAllergens = [
      'Limonene', 'Linalool', 'Citronellol', 'Geraniol', 'Citral',
      'Eugenol', 'Coumarin', 'Benzyl Alcohol', 'Benzyl Salicylate', 'Farnesol',
    ];
    const a = scoreIngredientHazard(['Aqua', ...manyAllergens])!;
    // 10 allergens × 6 = 60 uncapped, but the cap holds it to ALLERGEN_PENALTY_CAP.
    expect(a.score).toBe(100 - ALLERGEN_PENALTY_CAP);
    const allergenPenalty = a.matches
      .filter((m) => m.category === 'allergen')
      .reduce((s, m) => s + m.penalty, 0);
    expect(allergenPenalty).toBe(ALLERGEN_PENALTY_CAP);
  });

  it('hits a prohibited substance hard but never below zero', () => {
    const a = scoreIngredientHazard(['Formaldehyde'])!;
    expect(a.score).toBe(100 - CATEGORY_PENALTY.prohibited);
    expect(a.matches[0]?.category).toBe('prohibited');

    const stacked = scoreIngredientHazard(['Formaldehyde', 'Mercury', 'Lead Acetate'])!;
    expect(stacked.score).toBe(0); // 3 × 55 = 165, clamped
  });

  it('produces a higher score for a fragrance-free product than its fragranced twin (disagreement fuel)', () => {
    const clean = scoreIngredientHazard(['Aqua', 'Glycerin', 'Ceramide NP'])!;
    const scented = scoreIngredientHazard(['Aqua', 'Glycerin', 'Ceramide NP', 'Fragrance', 'Linalool'])!;
    expect(clean.score).toBeGreaterThan(scented.score);
  });
});

describe('buildHazardListing', () => {
  const now = new Date('2026-06-18T00:00:00Z');

  it('wraps an assessment in a Listing + Rating on the hazard source', () => {
    const assessment = scoreIngredientHazard(['Aqua', 'Phenoxyethanol', 'Fragrance'])!;
    const { listing, rating } = buildHazardListing(
      {
        productId: 'prod-cerave-mc',
        displayName: 'CeraVe Moisturizing Cream',
        brandName: 'CeraVe',
        gtin: '301871239019',
        ingredients: ['Aqua', 'Phenoxyethanol', 'Fragrance'],
      },
      assessment,
      { now },
    );
    expect(listing.id).toBe('hz-prod-cerave-mc');
    expect(listing.sourceId).toBe(HAZARD_SOURCE_ID);
    expect(listing.nativeId).toBe('prod-cerave-mc');
    expect(listing.payload).toBe(assessment); // reasoning preserved for the flag screen
    expect(rating.id).toBe('r-hz-prod-cerave-mc');
    expect(rating.scoreRaw).toBe(assessment.score);
    expect(rating.scoreLabel).toBe(assessment.label);
  });

  it('describes itself as an independent source on the ingredient_safety axis', () => {
    expect(HAZARD_SOURCE).toMatchObject({
      id: HAZARD_SOURCE_ID,
      axis: 'ingredient_safety',
      scaleDirection: 'higher_is_better',
      fundingModel: 'independent',
    });
  });
});
