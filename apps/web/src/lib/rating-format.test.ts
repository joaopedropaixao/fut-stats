import { describe, expect, it } from 'vitest';
import { formatRating } from './rating-format';

describe('formatRating', () => {
  it('usa vírgula e não mostra ,0', () => {
    expect(formatRating(7.5)).toBe('7,5');
    expect(formatRating(8)).toBe('8');
    expect(formatRating(10)).toBe('10');
  });
});
