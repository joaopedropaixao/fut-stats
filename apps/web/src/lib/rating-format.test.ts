import { describe, expect, it } from 'vitest';
import { formatRating } from './rating-format';

describe('formatRating', () => {
  it('sempre uma casa decimal, com vírgula', () => {
    expect(formatRating(7.5)).toBe('7,5');
    expect(formatRating(8)).toBe('8,0');
    expect(formatRating(10)).toBe('10,0');
    expect(formatRating(6.25)).toBe('6,3');
  });
});
