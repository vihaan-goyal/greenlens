import { describe, expect, it } from 'vitest';
import type { Brand } from '../domain/types';
import { computeFeatures, type FeatureScores } from './features';
import type { CatalogEntry } from './matcher';
import {
  bestThreshold,
  evaluate,
  featuresToVector,
  FEATURE_ORDER,
  predictProbaVector,
  sigmoid,
  trainLogistic,
  VECTOR_LENGTH,
} from './logistic';
import { generateLabeledPairs, mulberry32, toDataset } from './labeling';
import { EVAL_BRANDS, EVAL_PAIRS } from './eval-pairs';

// ─── vectorization ────────────────────────────────────────────────────────────

describe('logistic / featuresToVector — (value, present) encoding', () => {
  it('encodes present features as (value, 1) and absent as (0, 0)', () => {
    const f: FeatureScores = {
      gtinExact: true,
      nameJaroWinkler: 0.9,
      // nameTokenSet absent
      brandMatch: false,
      ingredientsOverlap: 0.5,
      // sizeMatch absent
    };
    const v = featuresToVector(f);
    expect(v).toHaveLength(VECTOR_LENGTH);
    expect(v).toEqual([
      1, 1, // gtinExact true, present
      0.9, 1, // nameJaroWinkler
      0, 0, // nameTokenSet absent
      0, 1, // brandMatch false, present
      0.5, 1, // ingredientsOverlap
      0, 0, // sizeMatch absent
    ]);
  });

  it('distinguishes a false binary feature from an absent one', () => {
    const present = featuresToVector({ gtinExact: false });
    const absent = featuresToVector({});
    // value column equal (0), present flag differs — the whole point of the encoding.
    expect(present[0]).toBe(0);
    expect(present[1]).toBe(1);
    expect(absent[0]).toBe(0);
    expect(absent[1]).toBe(0);
  });
});

// ─── sigmoid ──────────────────────────────────────────────────────────────────

describe('logistic / sigmoid', () => {
  it('is centered, monotonic, and saturates without overflow', () => {
    expect(sigmoid(0)).toBeCloseTo(0.5);
    expect(sigmoid(1000)).toBeCloseTo(1);
    expect(sigmoid(-1000)).toBeCloseTo(0);
    expect(sigmoid(2)).toBeGreaterThan(sigmoid(1));
  });
});

// ─── training ─────────────────────────────────────────────────────────────────

describe('logistic / trainLogistic — learns a separable signal', () => {
  it('fits a single-feature separable set to ~perfect accuracy', () => {
    // One informative column: high value → positive. Two columns per "feature".
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 40; i++) {
      const positive = i % 2 === 0;
      const value = positive ? 0.8 + (i % 5) * 0.02 : 0.2 - (i % 5) * 0.02;
      X.push([value, 1]);
      y.push(positive ? 1 : 0);
    }
    const model = trainLogistic(X, y, { epochs: 800, learningRate: 0.5 });
    const probs = X.map((x) => predictProbaVector(model, x));
    const m = evaluate(probs, y, 0.5);
    expect(m.accuracy).toBe(1);
    // Weight on the value column is positive (higher value ⇒ more likely match).
    expect(model.weights[0]).toBeGreaterThan(0);
  });
});

// ─── metrics ──────────────────────────────────────────────────────────────────

describe('logistic / evaluate + bestThreshold', () => {
  it('computes the confusion matrix and derived metrics', () => {
    const probs = [0.9, 0.8, 0.4, 0.2];
    const y = [1, 0, 1, 0];
    const m = evaluate(probs, y, 0.5);
    expect(m.tp).toBe(1);
    expect(m.fp).toBe(1);
    expect(m.fn).toBe(1);
    expect(m.tn).toBe(1);
    expect(m.precision).toBeCloseTo(0.5);
    expect(m.recall).toBeCloseTo(0.5);
  });

  it('finds a threshold that separates a separable set', () => {
    const probs = [0.95, 0.92, 0.1, 0.05];
    const y = [1, 1, 0, 0];
    const best = bestThreshold(probs, y);
    expect(best.f1).toBe(1);
    expect(best.threshold).toBeGreaterThan(0.1);
    expect(best.threshold).toBeLessThanOrEqual(0.92);
  });
});

// ─── labeling ─────────────────────────────────────────────────────────────────

const TRAIN_BRANDS: Brand[] = [
  { id: 'ta', name: 'Acme', aliases: [] },
  { id: 'tb', name: 'Botan', aliases: ['botan co'] },
  { id: 'tc', name: 'Cirro', aliases: [] },
  { id: 'td', name: 'Dewy', aliases: [] },
];

const TRAIN_CATALOG: CatalogEntry[] = [
  { productId: 'ta1', id: 'ta1', brand: 'Acme', name: 'Daily Glow Serum', gtin: '012345678905', sizeValue: 30, sizeUnit: 'ml', ingredients: ['aqua', 'ascorbic acid', 'glycerin', 'sodium hyaluronate', 'tocopherol'] },
  { productId: 'ta2', id: 'ta2', brand: 'Acme', name: 'Ceramide Repair Cream', gtin: '012345678912', sizeValue: 50, sizeUnit: 'ml', ingredients: ['aqua', 'glycerin', 'ceramide np', 'niacinamide', 'squalane'] },
  { productId: 'ta3', id: 'ta3', brand: 'Acme', name: 'Gentle Foaming Cleanser', gtin: '012345678929', sizeValue: 200, sizeUnit: 'ml', ingredients: ['aqua', 'cocamidopropyl betaine', 'glycerin', 'sodium chloride', 'citric acid'] },
  { productId: 'tb1', id: 'tb1', brand: 'Botan', name: 'Hydra Boost Lotion', gtin: '023456789016', sizeValue: 100, sizeUnit: 'ml', ingredients: ['water', 'glycerin', 'dimethicone', 'panthenol', 'tocopherol'] },
  { productId: 'tb2', id: 'tb2', brand: 'Botan', name: 'Overnight Repair Balm', gtin: '023456789023', sizeValue: 40, sizeUnit: 'ml', ingredients: ['water', 'shea butter', 'glycerin', 'squalane', 'ceramide ap'] },
  { productId: 'tc1', id: 'tc1', brand: 'Cirro', name: 'Vitamin C Brightening Drops', gtin: '034567890127', sizeValue: 30, sizeUnit: 'ml', ingredients: ['aqua', 'ascorbic acid', 'ferulic acid', 'glycerin', 'propylene glycol'] },
  { productId: 'tc2', id: 'tc2', brand: 'Cirro', name: 'Retinol Renewal Oil', gtin: '034567890134', sizeValue: 30, sizeUnit: 'ml', ingredients: ['caprylic capric triglyceride', 'retinol', 'squalane', 'tocopherol', 'bisabolol'] },
  { productId: 'tc3', id: 'tc3', brand: 'Cirro', name: 'Gentle Hydrating Toner', gtin: '034567890141', sizeValue: 200, sizeUnit: 'ml', ingredients: ['aqua', 'glycerin', 'betaine', 'panthenol', 'allantoin'] },
  { productId: 'td1', id: 'td1', brand: 'Dewy', name: 'Whipped Shea Body Butter', gtin: '045678901238', sizeValue: 200, sizeUnit: 'ml', ingredients: ['butyrospermum parkii butter', 'cocos nucifera oil', 'tocopherol', 'fragrance', 'glycerin'] },
  // Cross-brand name collisions so brandMatch becomes a discriminative signal
  // (two brands selling a generically-named "Daily Moisturizing Lotion" / "Vitamin C Serum").
  { productId: 'ta4', id: 'ta4', brand: 'Acme', name: 'Daily Moisturizing Lotion', gtin: '012345678936', sizeValue: 300, sizeUnit: 'ml', ingredients: ['aqua', 'glycerin', 'caprylic capric triglyceride', 'dimethicone', 'panthenol'] },
  { productId: 'tb3', id: 'tb3', brand: 'Botan', name: 'Daily Moisturizing Lotion', gtin: '023456789030', sizeValue: 300, sizeUnit: 'ml', ingredients: ['water', 'glycerin', 'petrolatum', 'cetyl alcohol', 'tocopherol'] },
  { productId: 'td2', id: 'td2', brand: 'Dewy', name: 'Vitamin C Serum', gtin: '045678901245', sizeValue: 30, sizeUnit: 'ml', ingredients: ['aqua', 'ascorbic acid', 'glycerin', 'panthenol', 'tocopherol'] },
];

describe('labeling / generateLabeledPairs', () => {
  it('emits self-positives and same-block hard negatives (same brand, different product)', () => {
    const pairs = generateLabeledPairs(TRAIN_CATALOG, TRAIN_BRANDS, {
      positivesPerProduct: 2,
      negativesPerProduct: 2,
      crossBrandNegativesPerProduct: 0, // isolate the same-block path
      rng: mulberry32(7),
    });
    const positives = pairs.filter((p) => p.label === 1);
    const negatives = pairs.filter((p) => p.label === 0);

    expect(positives.length).toBe(TRAIN_CATALOG.length * 2);
    expect(negatives.length).toBeGreaterThan(0);
    // Same-block negatives pair two *different* products of the *same* brand —
    // that's precisely what makes them hard (brandMatch is true on both classes).
    expect(negatives.every((p) => p.a !== p.b)).toBe(true);
    expect(negatives.every((p) => p.features.brandMatch === true)).toBe(true);

    // A positive (self-sighting) carries strong same-product signal pre-training.
    const posFeat = positives.find((p) => p.a === 'ta1')!.features;
    expect(posFeat.brandMatch).toBe(true);
    expect(posFeat.nameTokenSet).toBeGreaterThan(0.5);
  });

  it('emits cross-brand negatives so brandMatch is discriminative', () => {
    const pairs = generateLabeledPairs(TRAIN_CATALOG, TRAIN_BRANDS, {
      positivesPerProduct: 0,
      negativesPerProduct: 0,
      crossBrandNegativesPerProduct: 2,
      rng: mulberry32(7),
    });
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.every((p) => p.label === 0)).toBe(true);
    // At least one cross-brand negative has a brand mismatch (the whole point).
    expect(pairs.some((p) => p.features.brandMatch === false)).toBe(true);
  });
});

// ─── end-to-end: train on synthetic, grade on the held-out human set ──────────

describe('logistic / end-to-end — trained model generalizes to the held-out eval set', () => {
  it('classifies hand-labeled pairs well above chance', () => {
    const pairs = generateLabeledPairs(TRAIN_CATALOG, TRAIN_BRANDS, {
      positivesPerProduct: 6,
      negativesPerProduct: 4,
      crossBrandNegativesPerProduct: 3,
      keepGtinFraction: 0.4,
      rng: mulberry32(2024),
    });
    const { X, y } = toDataset(pairs);
    const model = trainLogistic(X, y, { epochs: 1500, learningRate: 0.5, l2: 1e-3 });

    const evalProbs = EVAL_PAIRS.map((p) =>
      predictProbaVector(model, featuresToVector(computeFeatures(p.a, p.b, EVAL_BRANDS))),
    );
    const evalY = EVAL_PAIRS.map((p) => (p.isMatch ? 1 : 0));

    // The brand-signal fix: cross-brand negatives give brandMatch a positive
    // value-weight (without them it trains to ~0 / negative — see git history).
    const brandValueCol = FEATURE_ORDER.indexOf('brandMatch') * 2;
    expect(model.weights[brandValueCol]).toBeGreaterThan(0);

    // The model must RANK held-out matches above non-matches. This is the honest
    // claim for a model trained on a tiny synthetic catalog; absolute calibration
    // (and the 90%+ accuracy) is what the real-data training script demonstrates.
    const posMean = mean(evalProbs.filter((_, i) => evalY[i] === 1));
    const negMean = mean(evalProbs.filter((_, i) => evalY[i] === 0));
    expect(posMean).toBeGreaterThan(negMean);

    // Rank quality: some threshold separates the held-out set well (≈AUC ≥ bar),
    // independent of whether the tiny model's probabilities are well-calibrated.
    const best = bestThreshold(evalProbs, evalY);
    console.log(`[eval] posMean=${posMean.toFixed(3)} negMean=${negMean.toFixed(3)} bestF1=${best.f1.toFixed(3)} bestAcc=${best.accuracy.toFixed(3)}`);
    expect(best.f1).toBeGreaterThanOrEqual(0.85);
  });
});

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}
