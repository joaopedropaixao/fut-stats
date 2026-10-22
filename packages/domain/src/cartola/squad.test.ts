import { describe, expect, it } from 'vitest';
import type { TeamLineup } from '../core';
import { validateCartolaSquad } from './squad';

const picks: TeamLineup = [
  { playerId: 'gk', position: 'GOALKEEPER' },
  { playerId: 'd1', position: 'DEFENDER' },
  { playerId: 'd2', position: 'DEFENDER' },
  { playerId: 'w1', position: 'WINGER' },
  { playerId: 'w2', position: 'WINGER' },
  { playerId: 'm1', position: 'MIDFIELDER' },
  { playerId: 'f1', position: 'FORWARD' },
];

// Total: 10 + 12 + 12 + 14 + 14 + 16 + 20 = 98
const prices = new Map([
  ['gk', 10],
  ['d1', 12],
  ['d2', 12],
  ['w1', 14],
  ['w2', 14],
  ['m1', 16],
  ['f1', 20],
  ['other', 5],
]);

describe('validateCartolaSquad', () => {
  it('aceita escalação 1-2-3-1 dentro do orçamento inicial (C$ 100)', () => {
    expect(validateCartolaSquad({ picks, captainId: 'f1' }, { prices })).toEqual({
      valid: true,
      cost: 98,
      errors: [],
    });
  });

  it('rejeita quem não segue a formação', () => {
    const result = validateCartolaSquad({ picks: picks.slice(1), captainId: 'f1' }, { prices });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('INVALID_FORMATION');
  });

  it('rejeita escalação acima do orçamento', () => {
    const result = validateCartolaSquad({ picks, captainId: 'f1' }, { prices, budget: 97.5 });
    expect(result).toEqual({ valid: false, cost: 98, errors: ['OVER_BUDGET'] });
  });

  it('aceita custo exatamente igual ao orçamento', () => {
    expect(validateCartolaSquad({ picks, captainId: 'f1' }, { prices, budget: 98 }).valid).toBe(
      true,
    );
  });

  it('rejeita capitão fora do time', () => {
    const result = validateCartolaSquad({ picks, captainId: 'other' }, { prices });
    expect(result.errors).toEqual(['CAPTAIN_NOT_IN_SQUAD']);
  });

  it('rejeita jogador sem preço no mercado', () => {
    const withUnknown = picks.map((s) => (s.playerId === 'f1' ? { ...s, playerId: 'ghost' } : s));
    const result = validateCartolaSquad({ picks: withUnknown, captainId: 'gk' }, { prices });
    expect(result.errors).toEqual(['UNKNOWN_PLAYER']);
    expect(result.cost).toBe(78);
  });

  it('acumula vários erros', () => {
    const result = validateCartolaSquad(
      { picks: picks.slice(1), captainId: 'gk' },
      { prices, budget: 50 },
    );
    expect(result.errors).toEqual(['INVALID_FORMATION', 'OVER_BUDGET', 'CAPTAIN_NOT_IN_SQUAD']);
  });
});
