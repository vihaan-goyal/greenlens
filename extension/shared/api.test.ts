import { describe, expect, it } from 'vitest';
import { DEFAULT_API_BASE, normalizeApiBase } from './api';

describe('normalizeApiBase', () => {
  it('strips trailing slashes', () => {
    expect(normalizeApiBase('https://greenlens.app/')).toBe('https://greenlens.app');
    expect(normalizeApiBase('https://greenlens.app///')).toBe('https://greenlens.app');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeApiBase('  http://localhost:3000  ')).toBe('http://localhost:3000');
  });

  it('round-trips an already-clean base unchanged', () => {
    expect(normalizeApiBase('https://greenlens.app')).toBe('https://greenlens.app');
  });

  it('falls back to the default on blank input', () => {
    expect(normalizeApiBase('')).toBe(DEFAULT_API_BASE);
    expect(normalizeApiBase('   ')).toBe(DEFAULT_API_BASE);
  });
});
