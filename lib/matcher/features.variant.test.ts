import { describe, expect, it } from 'vitest';
import {
  computeFeatures,
  extractVariantTokens,
  mutateVariantToken,
  variantTokensConflict,
} from './features';
import { EVAL_BRANDS, EVAL_PAIRS } from './eval-pairs';

// The variant feature is the head-brand sibling disambiguator: it must read a
// FALSE on same-kind/different-value markers (SPF, shade, concentration, AM/PM)
// and stay undefined when there's nothing comparable, so it never disturbs the
// genuine-match cases the other features already resolve.

describe('features / extractVariantTokens', () => {
  it('reads SPF, percent, AM/PM, and explicit shade off the raw name', () => {
    expect(extractVariantTokens('Anthelios Melt-in Milk Sunscreen SPF 60').get('spf')).toBe('60');
    expect(extractVariantTokens('Niacinamide 10% + Zinc 1%').get('pct')).toBe('10');
    expect(extractVariantTokens('AM Facial Moisturizing Lotion SPF 30').get('ampm')).toBe('am');
    expect(extractVariantTokens('Pro Filt’r Foundation Shade 150, 32ml').get('shade')).toBe('150');
  });

  it('reads a bare shade number in a foundation context but not a glued size unit', () => {
    const t = extractVariantTokens("Pro Filt'r Soft Matte Longwear Foundation 150");
    expect(t.get('shade')).toBe('150');
    // The size, not a shade: no shade token from a non-shaded product name.
    expect(extractVariantTokens('Daily Moisturizing Lotion 300ml').has('shade')).toBe(false);
  });

  it('returns no tokens for a plain product name', () => {
    expect(extractVariantTokens('CeraVe Moisturizing Cream').size).toBe(0);
  });

  it('reads scent, color, and pack-count tokens', () => {
    expect(extractVariantTokens('Native Body Wash Coconut & Vanilla').get('scent')).toBe('coconut|vanilla');
    expect(extractVariantTokens("Pro Filt'r Foundation Nude").get('color')).toBe('nude');
    expect(extractVariantTokens('Dove Beauty Bar 3 Pack').get('pack')).toBe('3');
    expect(extractVariantTokens('Dove Beauty Bar Pack of 2').get('pack')).toBe('2');
    expect(extractVariantTokens('Dove Beauty Bar 6ct').get('pack')).toBe('6');
  });
});

describe('features / variantTokensConflict — scent, color, pack', () => {
  it('conflicts on disjoint scent or color, and on a different pack-count', () => {
    expect(variantTokensConflict('Native Body Wash Lavender', 'Native Body Wash Eucalyptus')).toBe(true);
    expect(variantTokensConflict("Pro Filt'r Foundation Nude", "Pro Filt'r Foundation Coral")).toBe(true);
    expect(variantTokensConflict('Dove Beauty Bar 3 Pack', 'Dove Beauty Bar 6 Pack')).toBe(true);
  });

  it('does not conflict when scent sets overlap (a truncated sighting of the same product)', () => {
    expect(variantTokensConflict('Native Body Wash Coconut & Vanilla', 'Native Body Wash Vanilla')).toBe(false);
  });

  it('does not conflict when only one side carries the token', () => {
    expect(variantTokensConflict('Body Wash Lavender', 'Body Wash')).toBe(false);
    // "Refill" is a repackage, not a pack-count — must stay a match (eval e6).
    expect(variantTokensConflict('Hydrating Cleanser', 'Hydrating Cleanser Refill')).toBe(false);
  });
});

describe('features / mutateVariantToken — mints a conflicting sibling for training', () => {
  it('mutates a scent token into a genuine conflict', () => {
    const original = 'Native Body Wash Lavender';
    const mutated = mutateVariantToken(original);
    expect(mutated).not.toBeNull();
    expect(mutated).not.toBe(original);
    expect(variantTokensConflict(original, mutated!)).toBe(true);
  });

  it('mutates a pack-count into a genuine conflict', () => {
    const mutated = mutateVariantToken('Dove Beauty Bar 3 Pack');
    expect(variantTokensConflict('Dove Beauty Bar 3 Pack', mutated!)).toBe(true);
  });
});

describe('features / variantConflict in computeFeatures', () => {
  const featureFor = (note: string) => {
    const pair = EVAL_PAIRS.find((p) => p.note === note);
    if (!pair) throw new Error(`no eval pair: ${note}`);
    return computeFeatures(pair.a, pair.b, EVAL_BRANDS).variantConflict;
  };

  it('is true for sibling conflicts (the head-brand failure mode)', () => {
    expect(featureFor('Fenty foundation, different shade (150 vs 350) — different product')).toBe(true);
    expect(featureFor('La Roche-Posay Anthelios SPF 60 vs SPF 30 — different product')).toBe(true);
    expect(featureFor('CeraVe AM (with SPF) vs PM facial lotion — different product')).toBe(true);
    expect(featureFor('The Ordinary retinoid strengths: 2% vs 5% granactive — different product')).toBe(true);
  });

  it('is undefined (neutral) when the variant token agrees — agreement is not penalized', () => {
    expect(featureFor('Fenty foundation, same shade, catalog vs Amazon title')).toBeUndefined();
    expect(featureFor('The Ordinary serum, catalog vs Amazon title with extra marketing tokens')).toBeUndefined();
  });

  it('is undefined when neither name exposes a comparable variant token', () => {
    // A real match (refill, different UPC) must NOT read as a variant conflict.
    expect(featureFor('variant-SKU refill: different UPC, same canonical product')).toBeUndefined();
    expect(featureFor('Aveeno lotion, catalog vs Amazon title (the classic length-gap case)')).toBeUndefined();
  });
});
