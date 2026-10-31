import { describe, expect, it } from 'vitest';
import { formatAverage, whiteShare } from './balance-format';

describe('formatAverage', () => {
  it('uma casa, com vírgula', () => {
    expect(formatAverage(7.4)).toBe('7,4');
    expect(formatAverage(7)).toBe('7,0');
    expect(formatAverage(7.26)).toBe('7,3');
  });
});

describe('whiteShare', () => {
  it('é proporcional às médias', () => {
    expect(whiteShare(7.5, 2.5)).toBe(75);
  });
  it('sem as duas médias, metade', () => {
    expect(whiteShare(null, 7)).toBe(50);
    expect(whiteShare(0, 0)).toBe(50);
  });
});
