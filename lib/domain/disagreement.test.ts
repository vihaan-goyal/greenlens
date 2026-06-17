import { describe, expect, it } from 'vitest';
import type { Source } from './types';
import { summarizePillars } from './scoring';
import { describeDisagreement, detectDisagreements } from './disagreement';

const EWG: Source = {
  id: 'ewg',
  name: 'EWG',
  axis: 'ingredient_safety',
  scaleMin: 1,
  scaleMax: 10,
  scaleDirection: 'lower_is_better',
  fundingModel: 'nonprofit',
};
const YUKA: Source = {
  id: 'yuka',
  name: 'Yuka',
  axis: 'ingredient_safety',
  scaleMin: 0,
  scaleMax: 100,
  scaleDirection: 'higher_is_better',
  fundingModel: 'subscription',
};
const INCI: Source = {
  id: 'inci',
  name: 'INCI Beauty',
  axis: 'ingredient_safety',
  scaleMin: 0,
  scaleMax: 20,
  scaleDirection: 'higher_is_better',
  fundingModel: 'ad_supported',
};

describe('detectDisagreements', () => {
  it('finds the axis where EWG and Yuka split, and names them', () => {
    const pillars = summarizePillars(
      [
        { sourceId: 'ewg', scoreRaw: 6 }, // ~44.4 (concern)
        { sourceId: 'yuka', scoreRaw: 90 }, // 90 (clean)
        { sourceId: 'inci', scoreRaw: 14 }, // 70
      ],
      [EWG, YUKA, INCI],
    );
    const ds = detectDisagreements(pillars);
    expect(ds).toHaveLength(1);
    const d = ds[0]!;
    expect(d.axis).toBe('ingredient_safety');
    expect(d.low.sourceId).toBe('ewg');
    expect(d.high.sourceId).toBe('yuka');
    expect(d.spread).toBeGreaterThan(40);
  });

  it('returns nothing when raters cluster', () => {
    const pillars = summarizePillars(
      [
        { sourceId: 'yuka', scoreRaw: 78 },
        { sourceId: 'inci', scoreRaw: 16 }, // 80
      ],
      [YUKA, INCI],
    );
    expect(detectDisagreements(pillars)).toEqual([]);
  });
});

describe('describeDisagreement', () => {
  it('names both raters and their funding models so the reader can judge', () => {
    const pillars = summarizePillars(
      [
        { sourceId: 'ewg', scoreRaw: 6 },
        { sourceId: 'yuka', scoreRaw: 90 },
      ],
      [EWG, YUKA],
    );
    const [d] = detectDisagreements(pillars);
    const text = describeDisagreement(d!);
    expect(text).toContain('EWG');
    expect(text).toContain('Yuka');
    expect(text).toContain('nonprofit');
    expect(text).toContain('subscription');
    expect(text.toLowerCase()).toContain('ingredient safety');
  });
});
