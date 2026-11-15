import { describe, expect, it } from 'vitest';
import { FIRST_RATING } from './vote-flow';
import { ratingAtRatio, ratioOfRating, stepRating } from './rating-scale';

describe('régua da nota', () => {
  it('um toque na régua cai na nota de 0,5 em 0,5 mais próxima', () => {
    expect(ratingAtRatio(0)).toBe(0);
    expect(ratingAtRatio(1)).toBe(10);
    expect(ratingAtRatio(0.5)).toBe(5);
    expect(ratingAtRatio(0.76)).toBe(7.5);
    expect(ratingAtRatio(0.731)).toBe(7.5);
    expect(ratingAtRatio(0.724)).toBe(7);
    expect(ratingAtRatio(0.7)).toBe(7);
  });

  it('fora da régua prende nas pontas', () => {
    expect(ratingAtRatio(-0.4)).toBe(0);
    expect(ratingAtRatio(1.4)).toBe(10);
    expect(ratingAtRatio(Number.NaN)).toBe(0);
  });

  it('a posição da nota na régua vai de 0 a 1', () => {
    expect(ratioOfRating(0)).toBe(0);
    expect(ratioOfRating(7.5)).toBe(0.75);
    expect(ratioOfRating(10)).toBe(1);
  });

  it('+ e − andam 0,5 e param em 0 e em 10', () => {
    expect(stepRating(6, 1)).toBe(6.5);
    expect(stepRating(6, -1)).toBe(5.5);
    expect(stepRating(10, 1)).toBeNull();
    expect(stepRating(0, -1)).toBeNull();
    expect(stepRating(0.5, -1)).toBe(0);
  });

  it('a primeira nota é 6,0, uma nota válida', () => {
    expect(FIRST_RATING).toBe(6);
    expect(stepRating(FIRST_RATING, 1)).not.toBeNull();
  });
});
