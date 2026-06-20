import { describe, it, expect } from 'vitest';
import { narrateWeightChange, greet, LOW_KEY_LINES } from './sonion-lines';

describe('narrateWeightChange', () => {
  it('says leaning into an above-mean axis lifts the score and names the pillar', () => {
    const line = narrateWeightChange({
      prevOverall: 60,
      nextOverall: 63,
      changedAxis: 'ingredient_safety',
      effect: 'lifts',
      increased: true,
    });
    expect(line).toContain('ingredient safety');
    expect(line.toLowerCase()).toContain('lifts');
    expect(line.toLowerCase()).not.toContain('drags');
  });

  it('says leaning into a below-mean axis drags the score and names the pillar', () => {
    const line = narrateWeightChange({
      prevOverall: 60,
      nextOverall: 57,
      changedAxis: 'packaging',
      effect: 'drags',
      increased: true,
    });
    expect(line).toContain('packaging');
    expect(line.toLowerCase()).toContain('drags');
  });

  it('says easing off a lifting axis drags the score down (verb tracks real movement, not the pillar role)', () => {
    // User lowered ingredient safety (an above-mean axis): the composite falls,
    // so the line must say it drags — never "lifts".
    const line = narrateWeightChange({
      prevOverall: 60,
      nextOverall: 55,
      changedAxis: 'ingredient_safety',
      effect: 'lifts',
      increased: false,
    });
    expect(line.toLowerCase()).toContain('easing off');
    expect(line).toContain('ingredient safety');
    expect(line.toLowerCase()).toContain('drags');
    expect(line.toLowerCase()).not.toContain('lifts');
  });

  it('announces an upward band crossing with both band labels', () => {
    const line = narrateWeightChange({
      prevOverall: 68, // Fair
      nextOverall: 72, // Good
      changedAxis: 'ingredient_safety',
      effect: 'lifts',
      increased: true,
    });
    expect(line).toContain('Fair');
    expect(line).toContain('Good');
  });

  it('does not contradict the band crossing when the user eases off (Fair → Poor while drags)', () => {
    const line = narrateWeightChange({
      prevOverall: 59, // Fair
      nextOverall: 54, // Poor
      changedAxis: 'ingredient_safety',
      effect: 'lifts',
      increased: false,
    });
    expect(line.toLowerCase()).toContain('drags');
    expect(line.toLowerCase()).not.toContain('lifts');
    expect(line).toContain('Fair');
    expect(line).toContain('Poor');
  });

  it('returns a low-key, claim-free line for a negligible change', () => {
    const line = narrateWeightChange({
      prevOverall: 60,
      nextOverall: 60.2,
      changedAxis: 'labor',
      effect: 'neutral',
      increased: true,
      rotation: 0,
    });
    expect(LOW_KEY_LINES).toContain(line);
    // Low-key lines must not claim a pillar effect.
    expect(line).not.toContain('labor');
  });

  it('rotates consecutive low-key lines so they do not repeat', () => {
    const a = narrateWeightChange({
      prevOverall: 60, nextOverall: 60.1, changedAxis: 'labor', effect: 'neutral', increased: true, rotation: 0,
    });
    const b = narrateWeightChange({
      prevOverall: 60, nextOverall: 60.1, changedAxis: 'labor', effect: 'neutral', increased: true, rotation: 1,
    });
    expect(a).not.toEqual(b);
  });

  it('still announces a band crossing even when the point delta is small', () => {
    // 69.6 (Fair) → 70.1 (Good): delta < 0.5 but it crosses a band.
    const line = narrateWeightChange({
      prevOverall: 69.6,
      nextOverall: 70.1,
      changedAxis: 'ingredient_safety',
      effect: 'lifts',
      increased: true,
    });
    expect(line).toContain('Fair');
    expect(line).toContain('Good');
  });

  it('handles a null / no-data composite without throwing', () => {
    const line = narrateWeightChange({
      prevOverall: null,
      nextOverall: null,
      changedAxis: null,
      effect: 'unavailable',
      increased: true,
    });
    expect(typeof line).toBe('string');
    expect(line.length).toBeGreaterThan(0);
  });
});

describe('greet', () => {
  it('greets a strong composite differently from a weak one', () => {
    expect(greet(82)).not.toEqual(greet(30));
  });

  it('handles a null composite', () => {
    expect(typeof greet(null)).toBe('string');
    expect(greet(null).length).toBeGreaterThan(0);
  });
});
