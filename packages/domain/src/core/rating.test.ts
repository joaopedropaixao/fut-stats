import { describe, expect, it } from 'vitest';
import { isValidRating } from './rating';

describe('isValidRating', () => {
  it.each([0, 0.5, 5, 7.5, 10])('aceita %s', (value) => {
    expect(isValidRating(value)).toBe(true);
  });

  it.each([-0.5, 10.5, 7.3, 6.25, Number.NaN, Number.POSITIVE_INFINITY])('rejeita %s', (value) => {
    expect(isValidRating(value)).toBe(false);
  });
});
