import { describe, expect, it } from 'vitest';
import { STATUS_SCORE } from './brand-ethics-data';
import {
  assessBrandEthics,
  BRAND_ETHICS_SOURCE,
  BRAND_ETHICS_SOURCE_ID,
  buildBrandEthicsListing,
  resolveBrandEthics,
} from './brand-ethics';

describe('resolveBrandEthics', () => {
  it('matches a brand by name, case- and punctuation-insensitively', () => {
    expect(resolveBrandEthics(['e.l.f.'])?.brand).toBe('e.l.f.');
    expect(resolveBrandEthics(['ELF'])?.brand).toBe('e.l.f.');
    expect(resolveBrandEthics(['elf cosmetics'])?.brand).toBe('e.l.f.');
  });

  it('matches via an alias', () => {
    expect(resolveBrandEthics(['Deciem'])?.brand).toBe('The Ordinary');
  });

  it('returns the first hit so a brand wins over a later parent name', () => {
    // brand's own name resolves before a (hypothetical) parent name later in the list
    expect(resolveBrandEthics(['Glossier', "Burt's Bees"])?.brand).toBe('Glossier');
  });

  it('returns null for an unknown brand (no certification on record ≠ bad)', () => {
    expect(resolveBrandEthics(['Some Unlisted Brand'])).toBeNull();
  });
});

describe('assessBrandEthics', () => {
  it('scores a certified vegan brand highest', () => {
    const a = assessBrandEthics(resolveBrandEthics(['e.l.f.'])!);
    expect(a.score).toBe(STATUS_SCORE.certified_vegan);
    expect(a.status).toBe('certified_vegan');
    expect(a.label).toBe('Excellent');
    expect(a.asOf).toMatch(/^\d{4}-\d{2}$/);
  });

  it('scores a not-certified brand low, with the parent named in the reasoning', () => {
    const a = assessBrandEthics(resolveBrandEthics(['CeraVe'])!);
    expect(a.score).toBe(STATUS_SCORE.not_certified);
    expect(a.note).toMatch(/L'Oréal/);
  });

  it('puts a contested parent-conflict brand in the disagreement-prone middle', () => {
    const a = assessBrandEthics(resolveBrandEthics(['The Ordinary'])!);
    expect(a.score).toBe(STATUS_SCORE.parent_conflict);
    expect(a.score).toBeGreaterThan(STATUS_SCORE.not_certified);
    expect(a.score).toBeLessThan(STATUS_SCORE.certified);
  });
});

describe('buildBrandEthicsListing', () => {
  const now = new Date('2026-06-18T00:00:00Z');

  it('wraps an assessment in a Listing + Rating on the labor axis source', () => {
    const assessment = assessBrandEthics(resolveBrandEthics(['e.l.f.'])!);
    const { listing, rating } = buildBrandEthicsListing(
      { productId: 'prod-elf-putty', displayName: 'Putty Primer', brandName: 'e.l.f.' },
      assessment,
      { now },
    );
    expect(listing.id).toBe('be-prod-elf-putty');
    expect(listing.sourceId).toBe(BRAND_ETHICS_SOURCE_ID);
    expect(listing.payload).toBe(assessment); // certifier + reasoning preserved
    expect(rating.id).toBe('r-be-prod-elf-putty');
    expect(rating.scoreRaw).toBe(assessment.score);
  });

  it('is a nonprofit-certified source on the labor axis', () => {
    expect(BRAND_ETHICS_SOURCE).toMatchObject({
      id: BRAND_ETHICS_SOURCE_ID,
      axis: 'labor',
      scaleDirection: 'higher_is_better',
      fundingModel: 'nonprofit',
    });
  });
});
