import { describe, expect, it } from 'vitest';
import { verdictBand } from './verdict';

describe('verdictBand', () => {
  it('returns null for null/NaN inputs (no opinion without data)', () => {
    expect(verdictBand(null)).toBeNull();
    expect(verdictBand(Number.NaN)).toBeNull();
  });

  it('classifies each band at its inclusive lower edge', () => {
    expect(verdictBand(100)).toBe('excellent');
    expect(verdictBand(85)).toBe('excellent');
    expect(verdictBand(84.999)).toBe('good');
    expect(verdictBand(70)).toBe('good');
    expect(verdictBand(69.999)).toBe('fair');
    expect(verdictBand(55)).toBe('fair');
    expect(verdictBand(54.999)).toBe('poor');
    expect(verdictBand(40)).toBe('poor');
    expect(verdictBand(39.999)).toBe('bad');
    expect(verdictBand(0)).toBe('bad');
  });
});
