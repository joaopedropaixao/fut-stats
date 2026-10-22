import { describe, expect, it } from 'vitest';
import { FORMATION, PLAYERS_PER_TEAM } from './formation';
import { isPosition } from './position';
import { opponentOf } from './team';

describe('formação 1-2-3-1', () => {
  it('tem 7 jogadores por time, com 1 goleiro', () => {
    expect(PLAYERS_PER_TEAM).toBe(7);
    expect(FORMATION.GOALKEEPER).toBe(1);
  });
});

describe('isPosition', () => {
  it('reconhece posições válidas e rejeita o resto', () => {
    expect(isPosition('WINGER')).toBe(true);
    expect(isPosition('LIBERO')).toBe(false);
    expect(isPosition(3)).toBe(false);
  });
});

describe('opponentOf', () => {
  it('troca Branco por Preto e vice-versa', () => {
    expect(opponentOf('WHITE')).toBe('BLACK');
    expect(opponentOf('BLACK')).toBe('WHITE');
  });
});
