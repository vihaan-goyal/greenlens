import { describe, expect, it } from 'vitest';
import type { MatchableItem } from './features';
import {
  MIN_INGREDIENTS,
  MINHASH_PARAMS,
  bandKeys,
  ingredientBlockKeys,
  minhashSignature,
  normalizedIngredientSet,
} from './minhash';

const { K, B, R } = MINHASH_PARAMS;

/** How many band keys two key lists share. */
function sharedKeys(a: string[], b: string[]): number {
  const bs = new Set(b);
  return a.filter((k) => bs.has(k)).length;
}

function item(ingredients: string[]): MatchableItem {
  return { id: 'x', name: 'Test Product', ingredients };
}

// A realistic ~10-ingredient INCI list and some controlled variants of it.
const BASE = [
  'Aqua', 'Glycerin', 'Cetearyl Alcohol', 'Caprylic/Capric Triglyceride',
  'Ceramide NP', 'Niacinamide', 'Squalane', 'Panthenol', 'Tocopherol', 'Phenoxyethanol',
];
const DISJOINT = [
  'Castor Oil', 'Beeswax', 'Lanolin', 'Coconut Oil', 'Rosemary Extract',
  'Limonene', 'Linalool', 'Peppermint Oil', 'Carnauba Wax', 'Shea Butter',
];

describe('minhash / parameters and floor', () => {
  it('K equals B*R', () => {
    expect(K).toBe(B * R);
  });

  it('emits exactly B band keys for an ingredient-rich item', () => {
    const keys = ingredientBlockKeys(item(BASE));
    expect(keys).toHaveLength(B);
    expect(keys.every((k) => k.startsWith('ing:'))).toBe(true);
  });

  it('emits no keys below the richness floor', () => {
    const thin = BASE.slice(0, MIN_INGREDIENTS - 1);
    expect(thin).toHaveLength(MIN_INGREDIENTS - 1);
    expect(ingredientBlockKeys(item(thin))).toEqual([]);
  });

  it('emits keys exactly at the floor', () => {
    expect(ingredientBlockKeys(item(BASE.slice(0, MIN_INGREDIENTS)))).toHaveLength(B);
  });

  it('counts distinct normalized tokens for the floor, not raw entries', () => {
    // Four distinct ingredients written with duplicates/format noise → still < floor.
    const dupes = ['Aqua', 'aqua', 'AQUA', 'Glycerin', 'glycerin', 'Ceramide NP', 'ceramide-np', 'Squalane'];
    expect(normalizedIngredientSet(dupes)).toHaveLength(4);
    expect(ingredientBlockKeys(item(dupes))).toEqual([]);
  });
});

describe('minhash / determinism and order-independence', () => {
  it('produces an identical signature across calls', () => {
    expect([...minhashSignature(BASE)]).toEqual([...minhashSignature(BASE)]);
  });

  it('is order-independent (set, not sequence)', () => {
    const shuffled = [...BASE].reverse();
    expect([...minhashSignature(BASE)]).toEqual([...minhashSignature(shuffled)]);
    expect(ingredientBlockKeys(item(BASE))).toEqual(ingredientBlockKeys(item(shuffled)));
  });

  it('is invariant to ingredient formatting (uses normalizeIngredient)', () => {
    const noisy = BASE.map((s) => ` ${s.toUpperCase()}! `);
    expect(ingredientBlockKeys(item(noisy))).toEqual(ingredientBlockKeys(item(BASE)));
  });
});

describe('minhash / LSH collision behavior', () => {
  it('identical sets share all B band keys', () => {
    const a = ingredientBlockKeys(item(BASE));
    const b = ingredientBlockKeys(item([...BASE].sort()));
    expect(sharedKeys(a, b)).toBe(B);
  });

  it('a high-overlap set shares strictly more keys than a disjoint one', () => {
    const base = ingredientBlockKeys(item(BASE));
    // Swap one ingredient out of ten → Jaccard ≈ 0.82.
    const highOverlap = ingredientBlockKeys(item([...BASE.slice(0, 9), 'Allantoin']));
    const disjoint = ingredientBlockKeys(item(DISJOINT));

    const sharedHigh = sharedKeys(base, highOverlap);
    const sharedDisjoint = sharedKeys(base, disjoint);

    expect(sharedHigh).toBeGreaterThan(0); // LSH surfaces the near-duplicate
    expect(sharedHigh).toBeGreaterThan(sharedDisjoint); // monotone in similarity
    expect(sharedDisjoint).toBeLessThan(B); // disjoint sets do not fully collide
  });

  it('bandKeys length matches the band count', () => {
    expect(bandKeys(minhashSignature(BASE))).toHaveLength(B);
  });
});
