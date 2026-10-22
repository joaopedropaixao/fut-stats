import { describe, expect, it } from 'vitest';
import { isValidRating, validateRating } from './rating';

describe('isValidRating', () => {
  it.each([0, 0.5, 5, 7.5, 10])('aceita %s', (value) => {
    expect(isValidRating(value)).toBe(true);
  });

  it.each([-0.5, 10.5, 7.3, 6.25, Number.NaN, Number.POSITIVE_INFINITY])('rejeita %s', (value) => {
    expect(isValidRating(value)).toBe(false);
  });
});

describe('validateRating', () => {
  it('devolve null para nota válida', () => {
    expect(validateRating(7.5)).toBeNull();
  });

  it.each([
    [Number.NaN, 'NOT_A_NUMBER'],
    [Number.POSITIVE_INFINITY, 'NOT_A_NUMBER'],
    [-0.5, 'OUT_OF_RANGE'],
    [10.5, 'OUT_OF_RANGE'],
    [7.3, 'INVALID_STEP'],
  ])('%s → %s', (value, code) => {
    expect(validateRating(value)).toBe(code);
  });
});
