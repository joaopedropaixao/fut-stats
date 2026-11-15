import { describe, expect, it } from 'vitest';
import { minRatedGames, rankPlayers, rankTrend } from './ranking';

describe('minRatedGames', () => {
  it('C5: 1, 2, 3 e 10 rodadas encerradas dão 1, 2, 3, 3', () => {
    expect([1, 2, 3, 10].map((rounds) => minRatedGames(rounds))).toEqual([1, 2, 3, 3]);
  });

  it('C5: com 0 rodadas, 1', () => {
    expect(minRatedGames(0)).toBe(1);
  });

  it('C5: alvo ajustável por config', () => {
    expect(minRatedGames(10, { target: 5 })).toBe(5);
    expect(minRatedGames(4, { target: 5 })).toBe(4);
  });

  it('C5: número inválido não lança e cai no mínimo de 1', () => {
    expect(minRatedGames(-2)).toBe(1);
    expect(minRatedGames(Number.NaN)).toBe(1);
  });
});

describe('rankPlayers', () => {
  it('C6: empate divide a posição e pula a seguinte; poucos jogos fica sem posição', () => {
    const ranks = rankPlayers(
      [
        { id: 'a', average: 8.4, ratedGames: 5 },
        { id: 'few', average: 9.5, ratedGames: 1 },
        { id: 'b', average: 8.4, ratedGames: 4 },
        { id: 'c', average: 7.9, ratedGames: 3 },
      ],
      { minRatedGames: 3 },
    );

    expect(ranks.get('a')).toBe(1);
    expect(ranks.get('b')).toBe(1);
    expect(ranks.get('c')).toBe(3);
    expect(ranks.get('few')).toBeNull();
  });

  it('C6: devolve todos os ids, os classificados na ordem do ranking', () => {
    const ranks = rankPlayers(
      [
        { id: 'low', average: 6, ratedGames: 3 },
        { id: 'few', average: null, ratedGames: 0 },
        { id: 'high', average: 9, ratedGames: 3 },
      ],
      { minRatedGames: 3 },
    );

    expect([...ranks]).toEqual([
      ['high', 1],
      ['low', 2],
      ['few', null],
    ]);
  });

  it('C6: quem tem jogos suficientes mas nenhuma média não é classificado', () => {
    const ranks = rankPlayers([{ id: 'a', average: null, ratedGames: 3 }], { minRatedGames: 3 });

    expect(ranks.get('a')).toBeNull();
  });

  it('C6: ninguém classificado: todos sem posição; lista vazia dá mapa vazio', () => {
    const ranks = rankPlayers([{ id: 'a', average: 9, ratedGames: 1 }], { minRatedGames: 2 });

    expect([...ranks]).toEqual([['a', null]]);
    expect(rankPlayers([], { minRatedGames: 1 }).size).toBe(0);
  });
});

describe('rankTrend', () => {
  it('C7: A desce 1, B sobe 1, C igual, D novo é nulo', () => {
    const trend = rankTrend(
      new Map([
        ['a', 1],
        ['b', 2],
        ['c', 3],
      ]),
      new Map([
        ['b', 1],
        ['a', 2],
        ['c', 3],
        ['d', 4],
      ]),
    );

    expect(trend.get('a')).toBe(-1);
    expect(trend.get('b')).toBe(1);
    expect(trend.get('c')).toBe(0);
    expect(trend.get('d')).toBeNull();
  });

  it('C7: sem posição antes (poucos jogos) ou depois, sem tendência', () => {
    const trend = rankTrend(
      new Map<string, number | null>([
        ['a', null],
        ['b', 1],
      ]),
      new Map<string, number | null>([
        ['a', 1],
        ['b', null],
      ]),
    );

    expect(trend.get('a')).toBeNull();
    expect(trend.get('b')).toBeNull();
  });

  it('C7: subiu 2 posições é +2; quem saiu do depois não aparece', () => {
    const trend = rankTrend(
      new Map([
        ['a', 4],
        ['gone', 1],
      ]),
      new Map([['a', 2]]),
    );

    expect(trend.get('a')).toBe(2);
    expect(trend.has('gone')).toBe(false);
  });
});
