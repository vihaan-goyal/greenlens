import type { VerdictBand } from './types';

export function verdictBand(score: number | null): VerdictBand | null {
  if (score === null || Number.isNaN(score)) return null;
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 55) return 'fair';
  if (score >= 40) return 'poor';
  return 'bad';
}

export const VERDICT_LABEL: Record<VerdictBand, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  bad: 'Bad',
};

/** CSS custom property names for each band, matching tokens.css. */
export const VERDICT_VAR: Record<VerdictBand, string> = {
  excellent: 'var(--verdict-excellent)',
  good: 'var(--verdict-good)',
  fair: 'var(--verdict-fair)',
  poor: 'var(--verdict-poor)',
  bad: 'var(--verdict-bad)',
};
