import { describe, expect, it } from 'vitest';
import {
  MAX_SECONDARY_POSITIONS,
  positionsErrorText,
  secondariesAfterPrimary,
  toggleSecondary,
} from './secondary-positions';

describe('toggleSecondary', () => {
  it('marca e desmarca até o limite', () => {
    const one = toggleSecondary([], 'WINGER', 'DEFENDER');
    expect(one).toEqual({ secondaries: ['WINGER'], error: null });
    const two = toggleSecondary(one.secondaries, 'MIDFIELDER', 'DEFENDER');
    expect(two.secondaries).toEqual(['WINGER', 'MIDFIELDER']);
    expect(toggleSecondary(two.secondaries, 'WINGER', 'DEFENDER').secondaries).toEqual([
      'MIDFIELDER',
    ]);
  });

  it('a terceira não marca e devolve o erro do contrato', () => {
    expect(MAX_SECONDARY_POSITIONS).toBe(2);
    const full = toggleSecondary(['WINGER', 'MIDFIELDER'], 'FORWARD', 'DEFENDER');
    expect(full.secondaries).toEqual(['WINGER', 'MIDFIELDER']);
    expect(full.error).toBe('TOO_MANY_SECONDARIES');
    expect(positionsErrorText(full.error!)).toBe('No máximo 2 posições secundárias');
  });

  it('a principal e o goleiro nunca entram como secundária', () => {
    expect(toggleSecondary([], 'DEFENDER', 'DEFENDER').secondaries).toEqual([]);
    expect(toggleSecondary([], 'GOALKEEPER', 'DEFENDER').secondaries).toEqual([]);
  });
});

describe('secondariesAfterPrimary', () => {
  it('a nova principal sai das secundárias', () => {
    expect(secondariesAfterPrimary('WINGER', ['WINGER', 'MIDFIELDER'])).toEqual(['MIDFIELDER']);
  });

  it('goleiro joga só no gol: sem secundárias', () => {
    expect(secondariesAfterPrimary('GOALKEEPER', ['WINGER', 'MIDFIELDER'])).toEqual([]);
    expect(positionsErrorText('GOALKEEPER_HAS_SECONDARY')).toBe('Goleiro joga só no gol');
  });
});
