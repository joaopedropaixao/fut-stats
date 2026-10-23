import { describe, expect, it } from 'vitest';
import { matchWinner } from './winner';

describe('matchWinner', () => {
  it('quem fez mais gols vence', () => {
    expect(matchWinner({ WHITE: 4, BLACK: 3 })).toBe('WHITE');
    expect(matchWinner({ WHITE: 0, BLACK: 1 })).toBe('BLACK');
  });

  it('placar igual é empate, inclusive 0 a 0', () => {
    expect(matchWinner({ WHITE: 2, BLACK: 2 })).toBe('DRAW');
    expect(matchWinner({ WHITE: 0, BLACK: 0 })).toBe('DRAW');
  });
});
