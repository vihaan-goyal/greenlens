import { describe, expect, it } from 'vitest';
import { isGenericName, tokenDocFrequencies } from './features';

// Generic-name detection: a short name made entirely of corpus-common category
// words is a token-subset of thousands of products and becomes a universal false
// near-tie (the generic-name-containment failure). We drop those at load time;
// a name with a distinctive token, or a specific-enough multi-word combination,
// is kept.

// A toy corpus where "shampoo"/"soap" are common and "niacinamide" is rare.
const NAMES = [
  'Smooth Rose Hips Shampoo',
  'Green Apple Shampoo',
  'Hibiscus Shampoo',
  'Shampoo',
  'Hand Soap',
  'Kroger Hand Soap',
  'Lavender Hand Soap',
  'Daily Moisturizing Lotion',
  'Niacinamide Serum',
];

describe('features / tokenDocFrequencies', () => {
  it('counts each token once per name', () => {
    const df = tokenDocFrequencies(NAMES);
    expect(df.get('shampoo')).toBe(4);
    expect(df.get('soap')).toBe(3);
    expect(df.get('niacinamide')).toBe(1);
  });
});

describe('features / isGenericName', () => {
  const df = tokenDocFrequencies(NAMES);
  const n = NAMES.length;
  const check = (name: string) => isGenericName(name, df, n, { genericDf: 0.2, maxTokens: 2 });

  it('drops short all-generic names (the universal-rival rows)', () => {
    expect(check('Shampoo')).toBe(true); // 1 common token
    expect(check('Hand Soap')).toBe(true); // 2 common tokens
  });

  it('keeps a name with a distinctive token', () => {
    expect(check('Niacinamide Serum')).toBe(false); // niacinamide is rare
  });

  it('keeps a longer all-generic name (specific-enough combination)', () => {
    // 3 tokens — over maxTokens, so kept even though each token is common.
    expect(check('Daily Moisturizing Lotion')).toBe(false);
  });

  it('does not flag an empty name (its own filter owns that)', () => {
    expect(check('...')).toBe(false);
  });
});
