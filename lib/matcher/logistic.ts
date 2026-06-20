// Pure module — imports nothing from React/Next.
//
// Logistic-regression scorer: the learned counterpart to the hand-picked
// FEATURE_WEIGHTS in score.ts. The hand scorer is a normalized weighted average
// (Fellegi-Sunter style); this fits the weights from labeled pairs instead.
//
// FEATURE ENCODING (the important bit). Each pairwise feature can be *absent*
// (one side lacks the input — e.g. no GTIN). The hand scorer handles that by
// normalizing only over present features, so a missing GTIN is neutral rather
// than a zero. We give the model the same power by encoding each feature as a
// (value, present) pair: when absent both are 0, and the model can learn a
// `present` weight that offsets the missing value. So "no GTIN" and "GTIN
// mismatch" are distinct inputs, exactly as the matcher's asymmetric GTIN
// handling intends.
//
// Training is plain full-batch gradient descent with L2 — no dependency, and
// deterministic (zero init, no shuffling) so the tests and the emitted model
// artifact are reproducible. Swapping this in for the hand scorer also requires
// re-deriving MATCH_THRESHOLD on the new 0..1 probability scale; until then the
// default scorer in score.ts is unchanged.

import type { FeatureKey, FeatureScores } from './features';

/** Fixed feature order — the column layout every vector and weight follows. */
export const FEATURE_ORDER: readonly FeatureKey[] = [
  'gtinExact',
  'nameJaroWinkler',
  'nameTokenSet',
  'brandMatch',
  'ingredientsOverlap',
  'sizeMatch',
  'variantConflict',
] as const;

/** Two columns per feature: its value (0 when absent) then a present flag. */
export const VECTOR_LENGTH = FEATURE_ORDER.length * 2;

export interface LogisticModel {
  /** One weight per vector column; length === VECTOR_LENGTH. */
  weights: number[];
  bias: number;
  /** Decision threshold on the predicted probability, chosen at fit time. */
  threshold: number;
}

/**
 * Project a FeatureScores into the fixed (value, present) vector. Booleans map to
 * 0/1; absent features contribute (0, 0).
 */
export function featuresToVector(f: FeatureScores): number[] {
  const v: number[] = [];
  for (const key of FEATURE_ORDER) {
    const x = f[key];
    if (x === undefined) {
      v.push(0, 0);
    } else {
      v.push(typeof x === 'boolean' ? (x ? 1 : 0) : x, 1);
    }
  }
  return v;
}

export function sigmoid(z: number): number {
  // Branch to avoid Math.exp overflow on large-magnitude logits.
  if (z >= 0) {
    const e = Math.exp(-z);
    return 1 / (1 + e);
  }
  const e = Math.exp(z);
  return e / (1 + e);
}

function dot(w: number[], x: number[]): number {
  let s = 0;
  for (let i = 0; i < w.length; i++) s += w[i]! * x[i]!;
  return s;
}

/** Predicted match probability for an already-vectorized pair. */
export function predictProbaVector(model: LogisticModel, x: number[]): number {
  return sigmoid(dot(model.weights, x) + model.bias);
}

/** Predicted match probability straight from raw features. */
export function predictProba(model: LogisticModel, f: FeatureScores): number {
  return predictProbaVector(model, featuresToVector(f));
}

export interface TrainOptions {
  learningRate?: number;
  epochs?: number;
  /** L2 regularization strength (not applied to the bias). */
  l2?: number;
  /**
   * Threshold for the returned model. Default 0.5; the training script picks a
   * better one on a labeled split via `bestThreshold`.
   */
  threshold?: number;
}

const DEFAULT_TRAIN: Required<Omit<TrainOptions, 'threshold'>> = {
  learningRate: 0.3,
  epochs: 600,
  l2: 1e-3,
};

/**
 * Fit a logistic model by full-batch gradient descent on the binary
 * cross-entropy loss. `X` rows are vectors of length VECTOR_LENGTH (use
 * `featuresToVector`); `y` is 0/1. Deterministic: zero init, no shuffling.
 */
export function trainLogistic(X: number[][], y: number[], opts: TrainOptions = {}): LogisticModel {
  const lr = opts.learningRate ?? DEFAULT_TRAIN.learningRate;
  const epochs = opts.epochs ?? DEFAULT_TRAIN.epochs;
  const l2 = opts.l2 ?? DEFAULT_TRAIN.l2;
  const n = X.length;
  if (n === 0) throw new Error('trainLogistic: empty training set');
  const dim = X[0]!.length;

  const weights = new Array<number>(dim).fill(0);
  let bias = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradW = new Array<number>(dim).fill(0);
    let gradB = 0;
    for (let i = 0; i < n; i++) {
      const xi = X[i]!;
      const p = sigmoid(dot(weights, xi) + bias);
      const err = p - y[i]!; // dLoss/dLogit for cross-entropy
      for (let j = 0; j < dim; j++) gradW[j]! += err * xi[j]!;
      gradB += err;
    }
    for (let j = 0; j < dim; j++) {
      weights[j]! -= lr * (gradW[j]! / n + l2 * weights[j]!);
    }
    bias -= lr * (gradB / n);
  }

  return { weights, bias, threshold: opts.threshold ?? 0.5 };
}

// ─── evaluation ───────────────────────────────────────────────────────────────

export interface Metrics {
  threshold: number;
  total: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

/** Confusion-matrix metrics for `probs` vs binary `y` at a threshold. */
export function evaluate(probs: number[], y: number[], threshold: number): Metrics {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (let i = 0; i < probs.length; i++) {
    const pred = probs[i]! >= threshold ? 1 : 0;
    if (pred === 1 && y[i] === 1) tp++;
    else if (pred === 1 && y[i] === 0) fp++;
    else if (pred === 0 && y[i] === 0) tn++;
    else fn++;
  }
  const total = probs.length;
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return {
    threshold,
    total,
    accuracy: total === 0 ? 0 : (tp + tn) / total,
    precision,
    recall,
    f1,
    tp,
    fp,
    tn,
    fn,
  };
}

/**
 * Sweep candidate thresholds (the distinct predicted probabilities) and return
 * the one with the best F1 — ties broken toward the higher threshold (favoring
 * precision, which matches the matcher's "a wrong merge is worse than a miss"
 * stance). Used by the training script to set the model's decision threshold.
 */
export function bestThreshold(probs: number[], y: number[]): Metrics {
  const candidates = Array.from(new Set(probs)).sort((a, b) => a - b);
  // Include 0.5 and 1.01 (predict-none) as fallbacks so an empty/degenerate set
  // still yields a defined threshold.
  candidates.push(0.5, 1.01);
  let best: Metrics | null = null;
  for (const t of candidates) {
    const m = evaluate(probs, y, t);
    if (!best || m.f1 > best.f1 || (m.f1 === best.f1 && m.threshold > best.threshold)) {
      best = m;
    }
  }
  return best!;
}
