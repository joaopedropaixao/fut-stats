import { describe, expect, it } from 'vitest';
import type { Position } from '../core';
import type { RoundTeams } from '../round/match';
import { teamBalance, type BalancePlayer } from './team-balance';

const p = (id: string, primaryPosition: Position, rating: number): BalancePlayer => ({
  id,
  primaryPosition,
  rating,
});

const slot = (playerId: string, position: Position) => ({ playerId, position });
const noReserves = { WHITE: [], BLACK: [] };

describe('teamBalance', () => {
  it('C10: média por time, fora da posição × 0,9 (secundária ou não) e reserva com a nota cheia', () => {
    const players = [
      p('g1', 'GOALKEEPER', 8),
      p('d1', 'DEFENDER', 6), // na principal
      p('w1', 'WINGER', 10), // joga de zagueiro: 9
      p('m1', 'MIDFIELDER', 5), // joga de atacante: 4,5
      p('r1', 'DEFENDER', 7), // reserva: 7
      p('g2', 'GOALKEEPER', 5),
      p('f1', 'FORWARD', 5),
    ];
    const teams: RoundTeams = {
      WHITE: [
        slot('g1', 'GOALKEEPER'),
        slot('d1', 'DEFENDER'),
        slot('w1', 'DEFENDER'),
        slot('m1', 'FORWARD'),
      ],
      BLACK: [slot('g2', 'GOALKEEPER'), slot('f1', 'FORWARD')],
      reserves: { WHITE: ['r1'], BLACK: [] },
    };

    const result = teamBalance(teams, players);

    // Branco: (8 + 6 + 9 + 4,5 + 7) / 5 = 6,9; Preto: (5 + 5) / 2 = 5
    expect(result.average).toEqual({ WHITE: 6.9, BLACK: 5 });
    expect(result.difference).toBe(1.9);
  });

  it('C10: arredonda a média em 2 casas', () => {
    const players = [
      p('a', 'DEFENDER', 7),
      p('b', 'DEFENDER', 7),
      p('c', 'DEFENDER', 8),
      p('x', 'FORWARD', 5),
    ];
    const teams: RoundTeams = {
      WHITE: [slot('a', 'DEFENDER'), slot('b', 'DEFENDER'), slot('c', 'DEFENDER')],
      BLACK: [slot('x', 'FORWARD')],
      reserves: noReserves,
    };
    expect(teamBalance(teams, players).average.WHITE).toBe(7.33);
  });

  it('C10: o fator vem da config', () => {
    const players = [p('w1', 'WINGER', 10), p('x', 'FORWARD', 10)];
    const teams: RoundTeams = {
      WHITE: [slot('w1', 'DEFENDER')],
      BLACK: [slot('x', 'FORWARD')],
      reserves: noReserves,
    };
    expect(teamBalance(teams, players, { offPositionFactor: 0.5 }).average.WHITE).toBe(5);
  });

  it('C10: jogador que não está na lista é ignorado', () => {
    const players = [p('a', 'DEFENDER', 6), p('x', 'FORWARD', 6)];
    const teams: RoundTeams = {
      WHITE: [slot('a', 'DEFENDER'), slot('ghost', 'DEFENDER')],
      BLACK: [slot('x', 'FORWARD')],
      reserves: noReserves,
    };
    expect(teamBalance(teams, players).average.WHITE).toBe(6);
  });

  const teamsWithGap = (gap: number) => {
    const players = [p('a', 'DEFENDER', 5 + gap), p('x', 'DEFENDER', 5)];
    const teams: RoundTeams = {
      WHITE: [slot('a', 'DEFENDER')],
      BLACK: [slot('x', 'DEFENDER')],
      reserves: noReserves,
    };
    return teamBalance(teams, players);
  };

  it('C11: diferença de 0,5 é equilibrada', () => {
    expect(teamsWithGap(0.5)).toEqual({
      average: { WHITE: 5.5, BLACK: 5 },
      difference: 0.5,
      balanced: true,
      stronger: null,
    });
  });

  it('C11: diferença de 0,6 não é, e diz o time mais forte', () => {
    expect(teamsWithGap(0.6)).toMatchObject({
      difference: 0.6,
      balanced: false,
      stronger: 'WHITE',
    });
    const reversed = teamBalance(
      { WHITE: [slot('x', 'DEFENDER')], BLACK: [slot('a', 'DEFENDER')], reserves: noReserves },
      [p('a', 'DEFENDER', 5.6), p('x', 'DEFENDER', 5)],
    );
    expect(reversed.stronger).toBe('BLACK');
  });

  it('C11: a diferença é a que o usuário vê (1 casa): 0,54 vira 0,5 e é equilibrada; 0,56 vira 0,6', () => {
    const gap = (white: number, black: number) =>
      teamBalance(
        { WHITE: [slot('a', 'DEFENDER')], BLACK: [slot('x', 'DEFENDER')], reserves: noReserves },
        [p('a', 'DEFENDER', white), p('x', 'DEFENDER', black)],
      );
    expect(gap(6.4, 6.94)).toMatchObject({ difference: 0.5, balanced: true, stronger: null });
    expect(gap(6.4, 6.96)).toMatchObject({ difference: 0.6, balanced: false, stronger: 'BLACK' });
  });

  it('C11: time vazio: média null e sem comparação', () => {
    const teams: RoundTeams = {
      WHITE: [slot('a', 'DEFENDER')],
      BLACK: [],
      reserves: noReserves,
    };
    expect(teamBalance(teams, [p('a', 'DEFENDER', 6)])).toEqual({
      average: { WHITE: 6, BLACK: null },
      difference: null,
      balanced: null,
      stronger: null,
    });
  });

  it('C11: os dois times vazios', () => {
    expect(teamBalance({ WHITE: [], BLACK: [], reserves: noReserves }, [])).toEqual({
      average: { WHITE: null, BLACK: null },
      difference: null,
      balanced: null,
      stronger: null,
    });
  });
});
