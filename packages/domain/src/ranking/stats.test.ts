import { describe, expect, it } from 'vitest';
import type { MatchResult } from '../round';
import { playerStats, type PlayerRoundRecord } from './stats';

function record(overrides: Partial<PlayerRoundRecord> = {}): PlayerRoundRecord {
  return {
    result: 'WIN',
    goals: 0,
    assists: 0,
    ownGoals: 0,
    score: null,
    mvp: false,
    flop: false,
    playedAsGoalkeeper: false,
    goalsConceded: 0,
    ...overrides,
  };
}

const results = (...list: MatchResult[]) => list.map((result) => record({ result }));

describe('playerStats', () => {
  it('C1: conta jogos, resultados, lances, prêmios e média de 4 rodadas', () => {
    const stats = playerStats([
      record({ result: 'WIN', score: 8, goals: 2 }),
      record({ result: 'LOSS', score: null }),
      record({ result: 'DRAW', score: 7, assists: 1, mvp: true }),
      record({ result: 'WIN', score: 6.5, ownGoals: 1, flop: true }),
    ]);

    expect(stats).toMatchObject({
      games: 4,
      wins: 2,
      draws: 1,
      losses: 1,
      goals: 2,
      assists: 1,
      ownGoals: 1,
      mvps: 1,
      flops: 1,
      ratedGames: 3,
      average: 7.17,
    });
  });

  it('C1: gol contra não vira gol do jogador', () => {
    const stats = playerStats([record({ goals: 0, ownGoals: 2 })]);

    expect(stats.goals).toBe(0);
    expect(stats.ownGoals).toBe(2);
  });

  it('C2: sem rodada, tudo zero, média e sequência nulas', () => {
    expect(playerStats([])).toEqual({
      games: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals: 0,
      assists: 0,
      ownGoals: 0,
      mvps: 0,
      flops: 0,
      ratedGames: 0,
      average: null,
      streak: null,
      goalkeeper: { games: 0, conceded: 0, cleanSheets: 0, concededPerGame: null },
    });
  });

  it('C2: só rodadas sem nota: jogos contam, média é nula', () => {
    const stats = playerStats([record({ score: null }), record({ score: null })]);

    expect(stats.games).toBe(2);
    expect(stats.ratedGames).toBe(0);
    expect(stats.average).toBeNull();
  });

  it('C1: média com 2 casas, arredondando meio para cima', () => {
    const average = (...scores: number[]) =>
      playerStats(scores.map((score) => record({ score }))).average;

    expect(average(7, 7.5, 7.5)).toBe(7.33);
    expect(average(8, 7.5, 7.5)).toBe(7.67);
    // 28,5 / 4 = 7,125: exato em ponto flutuante, fecha em 7,13
    expect(average(7, 7, 7, 7.5)).toBe(7.13);
  });

  describe('sequência', () => {
    it('C3: V, V, V (antes uma derrota) é 3 vitórias', () => {
      expect(playerStats(results('LOSS', 'WIN', 'WIN', 'WIN')).streak).toEqual({
        result: 'WIN',
        count: 3,
      });
    });

    it('C3: D, D é 2 derrotas', () => {
      expect(playerStats(results('WIN', 'LOSS', 'LOSS')).streak).toEqual({
        result: 'LOSS',
        count: 2,
      });
    });

    it('C3: V, E é 1 empate', () => {
      expect(playerStats(results('WIN', 'DRAW')).streak).toEqual({ result: 'DRAW', count: 1 });
    });

    it('C3: todas as rodadas iguais contam todas', () => {
      expect(playerStats(results('WIN', 'WIN', 'WIN', 'WIN', 'WIN')).streak).toEqual({
        result: 'WIN',
        count: 5,
      });
    });
  });

  describe('goleiro', () => {
    const keeper = (goalsConceded: number) => record({ playedAsGoalkeeper: true, goalsConceded });

    it('C4: 3 jogos no gol (2, 0 e 3 sofridos) e 1 na linha: o da linha não entra', () => {
      const stats = playerStats([
        keeper(2),
        record({ playedAsGoalkeeper: false, goalsConceded: 6 }),
        keeper(0),
        keeper(3),
      ]);

      expect(stats.goalkeeper).toEqual({
        games: 3,
        conceded: 5,
        cleanSheets: 1,
        concededPerGame: 1.67,
      });
      expect(stats.games).toBe(4);
    });

    it('C4: sem jogo no gol, zeros e média por jogo nula', () => {
      const stats = playerStats([record({ goalsConceded: 4 })]);

      expect(stats.goalkeeper).toEqual({
        games: 0,
        conceded: 0,
        cleanSheets: 0,
        concededPerGame: null,
      });
    });

    it('C4: só jogos sem sofrer gol: por jogo é 0, não nulo', () => {
      expect(playerStats([keeper(0), keeper(0)]).goalkeeper).toEqual({
        games: 2,
        conceded: 0,
        cleanSheets: 2,
        concededPerGame: 0,
      });
    });
  });

  it('não muda a lista recebida', () => {
    const records = Object.freeze([record({ score: 7 }), record({ score: 8 })]);

    expect(() => playerStats(records)).not.toThrow();
  });
});
