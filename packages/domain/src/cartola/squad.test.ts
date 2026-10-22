import { describe, expect, it } from 'vitest';
import type { Position, TeamLineup } from '../core';
import {
  canPickForPosition,
  isValidCartolaSquad,
  squadCost,
  validateCartolaSquad,
  type CartolaMarketPlayer,
} from './squad';

const picks: TeamLineup = [
  { playerId: 'gk', position: 'GOALKEEPER' },
  { playerId: 'd1', position: 'DEFENDER' },
  { playerId: 'd2', position: 'DEFENDER' },
  { playerId: 'w1', position: 'WINGER' },
  { playerId: 'w2', position: 'WINGER' },
  { playerId: 'm1', position: 'MIDFIELDER' },
  { playerId: 'f1', position: 'FORWARD' },
];

function player(
  price: number,
  primaryPosition: Position,
  secondaryPositions: Position[] = [],
): CartolaMarketPlayer {
  return { price, primaryPosition, secondaryPositions };
}

// Total dos escalados: 10 + 12 + 12 + 14 + 14 + 16 + 20 = 98
const players = new Map([
  ['gk', player(10, 'GOALKEEPER')],
  ['gk2', player(8, 'GOALKEEPER')],
  ['d1', player(12, 'DEFENDER', ['WINGER'])],
  ['d2', player(12, 'DEFENDER')],
  ['w1', player(14, 'WINGER', ['MIDFIELDER'])],
  ['w2', player(14, 'WINGER')],
  ['m1', player(16, 'MIDFIELDER', ['FORWARD'])],
  ['f1', player(20, 'FORWARD', ['WINGER'])],
  ['m2', player(12, 'MIDFIELDER')],
  ['other', player(5, 'DEFENDER')],
]);

/** Troca o jogador de uma vaga da escalação base. */
function swap(from: string, to: string): TeamLineup {
  return picks.map((s) => (s.playerId === from ? { ...s, playerId: to } : s));
}

describe('canPickForPosition', () => {
  it('aceita a posição principal e as secundárias', () => {
    expect(canPickForPosition(player(10, 'MIDFIELDER', ['FORWARD']), 'MIDFIELDER')).toBe(true);
    expect(canPickForPosition(player(10, 'MIDFIELDER', ['FORWARD']), 'FORWARD')).toBe(true);
  });

  it('rejeita posição que não é principal nem secundária', () => {
    expect(canPickForPosition(player(10, 'MIDFIELDER', ['FORWARD']), 'DEFENDER')).toBe(false);
  });

  it('vaga de goleiro só aceita quem é goleiro', () => {
    expect(canPickForPosition(player(10, 'GOALKEEPER'), 'GOALKEEPER')).toBe(true);
    expect(canPickForPosition(player(10, 'DEFENDER', ['GOALKEEPER']), 'GOALKEEPER')).toBe(false);
  });

  it('goleiro não entra em vaga de linha', () => {
    expect(canPickForPosition(player(10, 'GOALKEEPER', ['DEFENDER']), 'DEFENDER')).toBe(false);
  });
});

describe('squadCost', () => {
  it('soma os preços dos escalados', () => {
    expect(squadCost(picks, players)).toBe(98);
  });

  it('ignora quem não está no mercado', () => {
    expect(squadCost(swap('f1', 'ghost'), players)).toBe(78);
  });
});

describe('validateCartolaSquad', () => {
  it('aceita escalação 1-2-3-1 dentro do orçamento inicial (C$ 100)', () => {
    expect(validateCartolaSquad({ picks, captainId: 'f1' }, { players })).toEqual([]);
    expect(isValidCartolaSquad({ picks, captainId: 'f1' }, { players })).toBe(true);
  });

  it('aceita jogador na posição secundária', () => {
    // d1 (zagueiro, secundária ala) joga de ala no lugar de w2; other entra na zaga
    const lineup = picks.map((s) =>
      s.playerId === 'w2'
        ? { ...s, playerId: 'd1' }
        : s.playerId === 'd1'
          ? { ...s, playerId: 'other' }
          : s,
    );
    expect(validateCartolaSquad({ picks: lineup, captainId: 'f1' }, { players })).toEqual([]);
  });

  it('rejeita jogador fora da principal e das secundárias', () => {
    // m2 (meia, sem secundária) na vaga de zagueiro
    expect(validateCartolaSquad({ picks: swap('d2', 'm2'), captainId: 'f1' }, { players })).toEqual(
      ['POSITION_NOT_ALLOWED'],
    );
  });

  it('rejeita jogador de linha na vaga de goleiro', () => {
    expect(
      validateCartolaSquad({ picks: swap('gk', 'other'), captainId: 'f1' }, { players }),
    ).toEqual(['POSITION_NOT_ALLOWED']);
  });

  it('rejeita quem não segue a formação', () => {
    expect(
      validateCartolaSquad({ picks: picks.slice(0, 6), captainId: 'gk' }, { players }),
    ).toEqual(['INVALID_FORMATION']);
  });

  it('rejeita escalação acima do orçamento', () => {
    expect(validateCartolaSquad({ picks, captainId: 'f1' }, { players, budget: 97.5 })).toEqual([
      'OVER_BUDGET',
    ]);
  });

  it('aceita custo exatamente igual ao orçamento', () => {
    expect(isValidCartolaSquad({ picks, captainId: 'f1' }, { players, budget: 98 })).toBe(true);
  });

  it('rejeita capitão fora do time', () => {
    expect(validateCartolaSquad({ picks, captainId: 'other' }, { players })).toEqual([
      'CAPTAIN_NOT_IN_SQUAD',
    ]);
  });

  it('rejeita jogador fora do mercado, sem acusar posição dele', () => {
    expect(
      validateCartolaSquad({ picks: swap('f1', 'ghost'), captainId: 'gk' }, { players }),
    ).toEqual(['UNKNOWN_PLAYER']);
  });

  it('acumula vários erros', () => {
    expect(
      validateCartolaSquad(
        { picks: swap('gk', 'gk2').slice(1), captainId: 'gk' },
        { players, budget: 50 },
      ),
    ).toEqual(['INVALID_FORMATION', 'OVER_BUDGET', 'CAPTAIN_NOT_IN_SQUAD']);
  });
});
