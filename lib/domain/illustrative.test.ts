import { describe, expect, it } from 'vitest';
import { isIllustrative } from './types';
import { SOURCES } from '../data/seed-data';

// The UI's honesty marker keys off isIllustrative(sourceId). If a demo source
// stops being flagged, or a real (computed) source gets flagged by mistake, the
// "Where each rater lands" screens would lie either way — so pin both directions.
describe('isIllustrative', () => {
  it('flags the licensing-blocked + stand-in demo raters', () => {
    for (const id of ['ewg', 'yuka', 'inci-beauty', 'good-on-you', 'how2recycle']) {
      expect(isIllustrative(id)).toBe(true);
    }
  });

  it('does not flag the sources with real data paths', () => {
    for (const id of ['obf-eco', 'ingredient-hazard', 'cruelty-free', 'packaging-scan']) {
      expect(isIllustrative(id)).toBe(false);
    }
  });

  it('only flags sources that actually exist in SOURCES', () => {
    const known = new Set(SOURCES.map((s) => s.id));
    for (const id of ['ewg', 'yuka', 'inci-beauty', 'good-on-you', 'how2recycle']) {
      expect(known.has(id)).toBe(true);
    }
  });
});
