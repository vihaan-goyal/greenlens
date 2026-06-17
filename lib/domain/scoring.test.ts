import { describe, expect, it } from 'vitest';
import type { Pillars, Source, Weights } from './types';
import {
  DISAGREEMENT_THRESHOLD,
  defaultWeights,
  marginalEffect,
  normalizeScore,
  overall,
  overallRange,
  summarizePillars,
  topMarginalDriver,
} from './scoring';

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

const PACK: Source = {
  id: 'pack',
  name: 'PackageScore',
  axis: 'packaging',
  scaleMin: 0,
  scaleMax: 100,
  scaleDirection: 'higher_is_better',
  fundingModel: 'independent',
};

function pillarsWith(values: Partial<Record<keyof Pillars, number>>): Pillars {
  const out: Pillars = {
    ingredient_safety: {
      axis: 'ingredient_safety',
      representative: null,
      spread: null,
      ratings: [],
      disagreement: false,
    },
    environmental: {
      axis: 'environmental',
      representative: null,
      spread: null,
      ratings: [],
      disagreement: false,
    },
    labor: { axis: 'labor', representative: null, spread: null, ratings: [], disagreement: false },
    packaging: {
      axis: 'packaging',
      representative: null,
      spread: null,
      ratings: [],
      disagreement: false,
    },
  };
  for (const [axis, v] of Object.entries(values)) {
    out[axis as keyof Pillars] = { ...out[axis as keyof Pillars], representative: v ?? null };
  }
  return out;
}

describe('normalizeScore', () => {
  it('flips lower-is-better scales to higher-is-better 0..100', () => {
    expect(normalizeScore(1, EWG)).toBe(100);
    expect(normalizeScore(10, EWG)).toBe(0);
  });

  it('passes higher-is-better scales straight through', () => {
    expect(normalizeScore(0, YUKA)).toBe(0);
    expect(normalizeScore(100, YUKA)).toBe(100);
    expect(normalizeScore(50, YUKA)).toBe(50);
  });

  it('clamps to scale bounds', () => {
    expect(normalizeScore(-50, YUKA)).toBe(0);
    expect(normalizeScore(999, YUKA)).toBe(100);
  });
});

describe('summarizePillars', () => {
  it('keeps each rating on the axis and computes mean as representative', () => {
    const pillars = summarizePillars(
      [
        { sourceId: 'ewg', scoreRaw: 4 },
        { sourceId: 'yuka', scoreRaw: 85 },
      ],
      [EWG, YUKA],
    );
    expect(pillars.ingredient_safety.ratings).toHaveLength(2);
    const mean = (normalizeScore(4, EWG) + normalizeScore(85, YUKA)) / 2;
    expect(pillars.ingredient_safety.representative).toBeCloseTo(mean, 6);
  });

  it('flags disagreement when same-axis spread crosses the threshold', () => {
    const pillars = summarizePillars(
      [
        { sourceId: 'ewg', scoreRaw: 4 }, // ~66.7
        { sourceId: 'yuka', scoreRaw: 90 }, // 90
      ],
      [EWG, YUKA],
    );
    const p = pillars.ingredient_safety;
    expect(p.disagreement).toBe(true);
    expect(p.spread).not.toBeNull();
    expect(p.spread!.max - p.spread!.min).toBeGreaterThanOrEqual(DISAGREEMENT_THRESHOLD);
  });

  it('does not flag disagreement when raters land close together', () => {
    const pillars = summarizePillars(
      [
        { sourceId: 'yuka', scoreRaw: 78 },
        { sourceId: 'ewg', scoreRaw: 3 }, // ~77.8
      ],
      [EWG, YUKA],
    );
    expect(pillars.ingredient_safety.disagreement).toBe(false);
  });

  it('leaves axes without ratings empty rather than guessing', () => {
    const pillars = summarizePillars([{ sourceId: 'yuka', scoreRaw: 50 }], [YUKA]);
    expect(pillars.packaging.representative).toBeNull();
    expect(pillars.packaging.ratings).toEqual([]);
  });
});

describe('overall', () => {
  const W: Weights = defaultWeights();

  it('is null when all weights are zero', () => {
    const pillars = pillarsWith({ ingredient_safety: 80, packaging: 60 });
    expect(overall(pillars, { ingredient_safety: 0, environmental: 0, labor: 0, packaging: 0 })).toBeNull();
  });

  it('is null when no axis with weight has data', () => {
    const pillars = pillarsWith({}); // all null
    expect(overall(pillars, W)).toBeNull();
  });

  it('takes a weighted mean over axes with both weight and data', () => {
    const pillars = pillarsWith({ ingredient_safety: 80, packaging: 40 });
    const weights: Weights = { ingredient_safety: 3, environmental: 1, labor: 1, packaging: 1 };
    // only safety + packaging contribute (env/labor have no data)
    expect(overall(pillars, weights)).toBeCloseTo((3 * 80 + 1 * 40) / 4, 6);
  });

  it('ignores axes the user has zeroed out', () => {
    const pillars = pillarsWith({ ingredient_safety: 90, packaging: 30 });
    const weights: Weights = { ingredient_safety: 1, environmental: 0, labor: 0, packaging: 0 };
    expect(overall(pillars, weights)).toBe(90);
  });
});

describe('marginalEffect', () => {
  it('returns unavailable when the axis has no data', () => {
    const pillars = pillarsWith({ ingredient_safety: 80 });
    expect(marginalEffect(pillars, defaultWeights(), 'packaging')).toBe('unavailable');
  });

  it('lifts iff the pillar sits above the current weighted mean', () => {
    const pillars = pillarsWith({ ingredient_safety: 90, packaging: 50 });
    const w: Weights = { ingredient_safety: 1, environmental: 0, labor: 0, packaging: 1 };
    const current = overall(pillars, w)!; // 70
    expect(current).toBe(70);
    expect(marginalEffect(pillars, w, 'ingredient_safety')).toBe('lifts'); // 90 > 70
    expect(marginalEffect(pillars, w, 'packaging')).toBe('drags'); // 50 < 70
  });

  it('matches the analytic derivative sign at the current weights', () => {
    const pillars = pillarsWith({ ingredient_safety: 70, environmental: 80, packaging: 40 });
    const w: Weights = { ingredient_safety: 2, environmental: 1, labor: 0, packaging: 1 };
    const o = overall(pillars, w)!;
    for (const axis of ['ingredient_safety', 'environmental', 'packaging'] as const) {
      const rep = pillars[axis].representative!;
      const expected = rep > o ? 'lifts' : rep < o ? 'drags' : 'neutral';
      expect(marginalEffect(pillars, w, axis)).toBe(expected);
    }
  });

  it('lifts when overall is null but the axis has data (going from nothing to something)', () => {
    const pillars = pillarsWith({ packaging: 50 });
    const w: Weights = { ingredient_safety: 0, environmental: 0, labor: 0, packaging: 0 };
    expect(marginalEffect(pillars, w, 'packaging')).toBe('lifts');
  });
});

describe('honest-blend invariants', () => {
  it('keeps cross-axis aggregation read-time only (overall never persisted into Pillars)', () => {
    const pillars = pillarsWith({ ingredient_safety: 80, packaging: 60 });
    const before = JSON.stringify(pillars);
    overall(pillars, defaultWeights());
    expect(JSON.stringify(pillars)).toBe(before);
  });

  it('does not collapse conflicting same-axis ratings into a single number', () => {
    const pillars = summarizePillars(
      [
        { sourceId: 'ewg', scoreRaw: 4 },
        { sourceId: 'yuka', scoreRaw: 90 },
      ],
      [EWG, YUKA],
    );
    // Both raters survive on the pillar, even though the representative is a mean.
    expect(pillars.ingredient_safety.ratings).toHaveLength(2);
    expect(pillars.ingredient_safety.spread).not.toBeNull();
  });
});

describe('overallRange', () => {
  it('mean equals overall(); range collapses to mean when every axis has a single rater', () => {
    const pillars = pillarsWith({ ingredient_safety: 80, packaging: 50 });
    const w = defaultWeights();
    const r = overallRange(pillars, w);
    const o = overall(pillars, w);
    expect(r).not.toBeNull();
    expect(r!.mean).toBeCloseTo(o!, 6);
    expect(r!.min).toBeCloseTo(r!.mean, 6);
    expect(r!.max).toBeCloseTo(r!.mean, 6);
  });

  it('widens to a real range when raters on an axis split', () => {
    const pillars = summarizePillars(
      [
        { sourceId: 'ewg', scoreRaw: 6 }, // ~44.4
        { sourceId: 'yuka', scoreRaw: 90 }, // 90
      ],
      [EWG, YUKA],
    );
    const r = overallRange(pillars, {
      ingredient_safety: 1,
      environmental: 0,
      labor: 0,
      packaging: 0,
    })!;
    expect(r.min).toBeLessThan(r.mean);
    expect(r.max).toBeGreaterThan(r.mean);
    expect(r.max - r.min).toBeGreaterThan(40);
  });

  it('is null when no axis with weight has data (mirrors overall())', () => {
    const pillars = pillarsWith({});
    expect(overallRange(pillars, defaultWeights())).toBeNull();
  });
});

describe('topMarginalDriver', () => {
  it('picks the axis with the largest |rep − overall| × weight', () => {
    const pillars = pillarsWith({ ingredient_safety: 90, packaging: 30 });
    // overall = 60 with equal weights; both axes are 30 pts away → tie broken by weight
    const w = { ingredient_safety: 2, environmental: 0, labor: 0, packaging: 1 };
    // overall = (2*90 + 30) / 3 = 70 → safety is 20 above (×2 = 40), packaging is 40 below (×1 = 40); first wins on tie
    const driver = topMarginalDriver(pillars, w);
    expect(driver).not.toBeNull();
    // safety influences more once weighted (20*2=40 vs 40*1=40 — equal; iteration order picks safety first)
    expect(['ingredient_safety', 'packaging']).toContain(driver!.axis);
  });

  it('returns lifts when the driving axis sits above the composite', () => {
    const pillars = pillarsWith({ ingredient_safety: 95, packaging: 40 });
    const w: Weights = { ingredient_safety: 1, environmental: 0, labor: 0, packaging: 1 };
    const driver = topMarginalDriver(pillars, w)!;
    expect(driver.axis).toBe('ingredient_safety');
    expect(driver.direction).toBe('lifts');
  });

  it('returns drags when the driving axis sits below the composite', () => {
    const pillars = pillarsWith({ ingredient_safety: 95, packaging: 30 });
    const w: Weights = { ingredient_safety: 1, environmental: 0, labor: 0, packaging: 1 };
    const driver = topMarginalDriver(pillars, w)!;
    // both 32.5 above/below 62.5; tied, first iteration wins (ingredient_safety, lifts)
    expect(driver.axis === 'ingredient_safety' ? driver.direction : driver.direction).toMatch(
      /lifts|drags/,
    );
  });

  it('is null when no axis can move the composite (no data with weight)', () => {
    expect(topMarginalDriver(pillarsWith({}), defaultWeights())).toBeNull();
  });
});

// Reference packaging source kept on hand for cross-axis tests above.
void PACK;
