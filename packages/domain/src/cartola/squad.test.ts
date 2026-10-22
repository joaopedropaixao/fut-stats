import { describe, expect, it } from 'vitest';
import type { TeamLineup } from '../core';
import { isValidCartolaSquad, squadCost, validateCartolaSquad } from './squad';

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

describe('squadCost', () => {
  it('soma os preços dos escalados', () => {
    expect(squadCost(picks, prices)).toBe(98);
  });

  it('ignora quem não tem preço no mercado', () => {
    const withUnknown = picks.map((s) => (s.playerId === 'f1' ? { ...s, playerId: 'ghost' } : s));
    expect(squadCost(withUnknown, prices)).toBe(78);
  });
});

describe('validateCartolaSquad', () => {
  it('aceita escalação 1-2-3-1 dentro do orçamento inicial (C$ 100)', () => {
    expect(validateCartolaSquad({ picks, captainId: 'f1' }, { prices })).toEqual([]);
    expect(isValidCartolaSquad({ picks, captainId: 'f1' }, { prices })).toBe(true);
  });

  it('rejeita quem não segue a formação', () => {
    expect(validateCartolaSquad({ picks: picks.slice(0, 6), captainId: 'gk' }, { prices })).toEqual(
      ['INVALID_FORMATION'],
    );
  });

  it('rejeita escalação acima do orçamento', () => {
    expect(validateCartolaSquad({ picks, captainId: 'f1' }, { prices, budget: 97.5 })).toEqual([
      'OVER_BUDGET',
    ]);
  });

  it('aceita custo exatamente igual ao orçamento', () => {
    expect(isValidCartolaSquad({ picks, captainId: 'f1' }, { prices, budget: 98 })).toBe(true);
  });

  it('rejeita capitão fora do time', () => {
    expect(validateCartolaSquad({ picks, captainId: 'other' }, { prices })).toEqual([
      'CAPTAIN_NOT_IN_SQUAD',
    ]);
  });

  it('rejeita jogador sem preço no mercado', () => {
    const withUnknown = picks.map((s) => (s.playerId === 'f1' ? { ...s, playerId: 'ghost' } : s));
    expect(validateCartolaSquad({ picks: withUnknown, captainId: 'gk' }, { prices })).toEqual([
      'UNKNOWN_PLAYER',
    ]);
  });

  it('acumula vários erros', () => {
    expect(
      validateCartolaSquad({ picks: picks.slice(1), captainId: 'gk' }, { prices, budget: 50 }),
    ).toEqual(['INVALID_FORMATION', 'OVER_BUDGET', 'CAPTAIN_NOT_IN_SQUAD']);
  });
});
