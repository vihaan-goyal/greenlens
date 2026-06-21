import { describe, expect, it } from 'vitest';
import type { Source } from './types';
import { summarizePillars, type ScoredRating } from './scoring';
import {
  WEAK_MATCH_THRESHOLD,
  coverageSummary,
  matchTier,
} from './provenance';

const EWG: Source = {
  id: 'ewg',
  name: 'EWG',
  axis: 'ingredient_safety',
  scaleMin: 1,
  scaleMax: 10,
  scaleDirection: 'lower_is_better',
  fundingModel: 'nonprofit',
};
const ECO: Source = {
  id: 'obf-eco',
  name: 'Open Beauty Facts',
  axis: 'environmental',
  scaleMin: 0,
  scaleMax: 100,
  scaleDirection: 'higher_is_better',
  fundingModel: 'nonprofit',
};
const LABOR: Source = {
  id: 'good-on-you',
  name: 'Good On You',
  axis: 'labor',
  scaleMin: 1,
  scaleMax: 5,
  scaleDirection: 'higher_is_better',
  fundingModel: 'independent',
};
const PKG: Source = {
  id: 'how2recycle',
  name: 'How2Recycle',
  axis: 'packaging',
  scaleMin: 0,
  scaleMax: 100,
  scaleDirection: 'higher_is_better',
  fundingModel: 'nonprofit',
};
const ALL_SOURCES = [EWG, ECO, LABOR, PKG];

describe('matchTier', () => {
  it('treats a reviewed match as verified regardless of confidence', () => {
    expect(matchTier(0.2, true)).toBe('verified');
    expect(matchTier(undefined, true)).toBe('verified');
  });

  it('treats a missing confidence as a clean, certain match', () => {
    // Curated/seed data and callers without match info read as verified, not weak.
    expect(matchTier(undefined, false)).toBe('verified');
    expect(matchTier(undefined, undefined)).toBe('verified');
  });

  it('splits unreviewed matches at the weak threshold', () => {
    expect(matchTier(WEAK_MATCH_THRESHOLD, false)).toBe('auto'); // boundary is inclusive
    expect(matchTier(0.95, false)).toBe('auto');
    expect(matchTier(WEAK_MATCH_THRESHOLD - 0.01, false)).toBe('weak');
    expect(matchTier(0.5, false)).toBe('weak');
  });
});

/** One rating per axis, all on confident reviewed matches unless overridden. */
function fullCoverage(overrides: Partial<Record<string, Partial<ScoredRating>>> = {}): ScoredRating[] {
  const base: ScoredRating[] = [
    { sourceId: 'ewg', scoreRaw: 2 },
    { sourceId: 'obf-eco', scoreRaw: 60 },
    { sourceId: 'good-on-you', scoreRaw: 3 },
    { sourceId: 'how2recycle', scoreRaw: 55 },
  ];
  return base.map((r) => ({ ...r, ...overrides[r.sourceId] }));
}

describe('coverageSummary', () => {
  it('reports clean, full coverage when every match is verified', () => {
    const pillars = summarizePillars(
      fullCoverage({
        ewg: { matchReviewed: true },
        'obf-eco': { matchReviewed: true },
        'good-on-you': { matchReviewed: true },
        how2recycle: { matchReviewed: true },
      }),
      ALL_SOURCES,
    );
    const c = coverageSummary(pillars);
    expect(c.sourceCount).toBe(4);
    expect(c.axesCovered).toBe(4);
    expect(c.sparseCoverage).toBe(false);
    expect(c.weakestTier).toBe('verified');
    expect(c.hasUnreviewed).toBe(false);
    expect(c.hasWeak).toBe(false);
  });

  it('flags an unreviewed below-threshold match as weak', () => {
    const pillars = summarizePillars(
      fullCoverage({ ewg: { matchConfidence: 0.6, matchReviewed: false } }),
      ALL_SOURCES,
    );
    const c = coverageSummary(pillars);
    expect(c.weakestTier).toBe('weak');
    expect(c.hasWeak).toBe(true);
    expect(c.hasUnreviewed).toBe(true);
  });

  it('flags an unreviewed high-confidence match as auto, not weak', () => {
    const pillars = summarizePillars(
      fullCoverage({ ewg: { matchConfidence: 0.95, matchReviewed: false } }),
      ALL_SOURCES,
    );
    const c = coverageSummary(pillars);
    expect(c.weakestTier).toBe('auto');
    expect(c.hasUnreviewed).toBe(true);
    expect(c.hasWeak).toBe(false);
  });

  it('reports sparse coverage when fewer than four axes have ratings', () => {
    const pillars = summarizePillars(
      [
        { sourceId: 'ewg', scoreRaw: 2 },
        { sourceId: 'obf-eco', scoreRaw: 60 },
      ],
      ALL_SOURCES,
    );
    const c = coverageSummary(pillars);
    expect(c.sourceCount).toBe(2);
    expect(c.axesCovered).toBe(2);
    expect(c.sparseCoverage).toBe(true);
  });

  it('handles empty pillars', () => {
    const c = coverageSummary(summarizePillars([], ALL_SOURCES));
    expect(c.sourceCount).toBe(0);
    expect(c.axesCovered).toBe(0);
    expect(c.weakestTier).toBeNull();
    expect(c.sparseCoverage).toBe(true);
  });
});
