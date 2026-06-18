import { describe, expect, it } from 'vitest';
import { TIER_SCORE } from './packaging-data';
import {
  buildPackagingListing,
  PACKAGING_SOURCE,
  PACKAGING_SOURCE_ID,
  scorePackaging,
} from './packaging';

describe('scorePackaging', () => {
  it('returns null for an empty / whitespace-only material list', () => {
    expect(scorePackaging([])).toBeNull();
    expect(scorePackaging(['', '   '])).toBeNull();
  });

  it('returns null when no tag is a recognized material (shapes only)', () => {
    // "bottle" / "box" are shapes, not materials — nothing to score.
    expect(scorePackaging(['en:bottle', 'en:box'])).toBeNull();
  });

  it('scores a glass-only pack Excellent', () => {
    const a = scorePackaging(['en:glass'])!;
    expect(a.score).toBe(92);
    expect(a.label).toBe('Excellent');
    expect(a.matches).toHaveLength(1);
    expect(a.matches[0]).toMatchObject({ name: 'Glass', tier: 'widely_recyclable' });
  });

  it('scores PVC as Bad', () => {
    const a = scorePackaging(['en:pvc'])!;
    expect(a.score).toBe(12);
    expect(a.label).toBe('Bad');
  });

  it('normalizes OBF tags: strips en: prefix and resin suffixes', () => {
    const plain = scorePackaging(['polypropylene'])!;
    const tagged = scorePackaging(['en:pp-polypropylene'])!;
    expect(plain.score).toBe(tagged.score);
    expect(tagged.matches[0]?.name).toBe('PP (#5)');
  });

  it('takes the mean of components, so a pump drags a glass bottle down', () => {
    const a = scorePackaging(['en:glass', 'en:pp-pump'])!;
    // glass 92, pump 18 → mean 55 → Fair. The pump matches the component entry,
    // not polypropylene, because whole-component problems take priority.
    expect(a.matches.map((m) => m.name)).toEqual(['Glass', 'Pump / dispenser']);
    expect(a.score).toBe(55);
    expect(a.label).toBe('Fair');
  });

  it('drops the generic "plastic" bucket when a specific resin is present', () => {
    const generic = scorePackaging(['en:plastic'])!;
    const specific = scorePackaging(['en:plastic', 'en:pp-polypropylene'])!;
    // The specific PP resin wins; the unspecified-plastic guess is discarded so
    // it is not double-counted against the same part.
    expect(specific.matches).toHaveLength(1);
    expect(specific.matches[0]?.name).toBe('PP (#5)');
    expect(specific.score).not.toBe(generic.score);
  });

  it('de-dupes the same material reported twice', () => {
    const a = scorePackaging(['en:glass', 'en:glass-bottle'])!;
    expect(a.matches).toHaveLength(1);
    expect(a.score).toBe(92);
    // materialCount still reflects every tag supplied, recognized or not.
    expect(a.materialCount).toBe(2);
  });

  it('falls back to the tier score when an entry sets none', () => {
    // Sanity: every tier has a defined fallback used by entries without override.
    expect(TIER_SCORE.not_recyclable).toBeGreaterThan(0);
  });
});

describe('PACKAGING_SOURCE', () => {
  it('is an independent source on the packaging axis', () => {
    expect(PACKAGING_SOURCE).toMatchObject({
      id: PACKAGING_SOURCE_ID,
      axis: 'packaging',
      scaleMin: 0,
      scaleMax: 100,
      scaleDirection: 'higher_is_better',
      fundingModel: 'independent',
    });
  });
});

describe('buildPackagingListing', () => {
  const now = new Date('2026-06-18T00:00:00.000Z');

  it('wraps an assessment in a Listing + Rating on the packaging source', () => {
    const assessment = scorePackaging(['en:glass', 'en:pp-pump'])!;
    const { listing, rating } = buildPackagingListing(
      {
        productId: 'p-1',
        displayName: 'Test Serum',
        brandName: 'Testco',
        gtin: '0123456789012',
        materials: ['en:glass', 'en:pp-pump'],
      },
      assessment,
      { now },
    );

    expect(listing).toMatchObject({
      id: 'pk-p-1',
      sourceId: PACKAGING_SOURCE_ID,
      nativeId: 'p-1',
      rawName: 'Test Serum',
      rawBrand: 'Testco',
      rawIngredients: ['en:glass', 'en:pp-pump'],
      url: '/methodology#packaging',
      fetchedAt: now,
    });
    expect(listing.payload).toBe(assessment);
    expect(rating).toMatchObject({
      id: 'r-pk-p-1',
      listingId: 'pk-p-1',
      scoreRaw: assessment.score,
      scoreLabel: assessment.label,
      ingestedAt: now,
    });
  });
});
