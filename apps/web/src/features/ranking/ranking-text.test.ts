import type { RankingPlayer } from '@fut-stats/shared';
import { describe, expect, it } from 'vitest';
import {
  formatAverage,
  goalkeeperLines,
  minimumText,
  missingRounds,
  missingRoundsText,
  parseRankingView,
  rankingRows,
  rankingSearch,
  roundLancesText,
  streakView,
  trendLabel,
} from './ranking-text';

const stats = {
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
  goalkeeper: null,
} satisfies RankingPlayer['stats'];

function player(
  id: string,
  primaryPosition: RankingPlayer['primaryPosition'],
  rank: number | null,
  positionRank: number | null,
): RankingPlayer {
  return {
    membershipId: id,
    nickname: id,
    avatar: { skin: 'TAN', hair: 'SHORT', hairColor: 'BLACK' },
    primaryPosition,
    rank,
    positionRank,
    trend: null,
    stats,
  };
}

describe('formatAverage', () => {
  it('uma casa com vírgula, meio para cima', () => {
    expect(formatAverage(8.4)).toBe('8,4');
    expect(formatAverage(8.45)).toBe('8,5');
    expect(formatAverage(7.17)).toBe('7,2');
    expect(formatAverage(1.67)).toBe('1,7');
    expect(formatAverage(10)).toBe('10,0');
    expect(formatAverage(0)).toBe('0,0');
  });
});

describe('trendLabel (C23)', () => {
  it('diz para onde foi, com concordância', () => {
    expect(trendLabel(2)).toBe('subiu 2 posições');
    expect(trendLabel(1)).toBe('subiu 1 posição');
    expect(trendLabel(-1)).toBe('desceu 1 posição');
    expect(trendLabel(-3)).toBe('desceu 3 posições');
    expect(trendLabel(0)).toBe('manteve a posição');
  });
});

describe('faltam rodadas (C22) e mínimo (C25)', () => {
  it('conta o que falta sem passar de zero', () => {
    expect(missingRounds(3, 1)).toBe(2);
    expect(missingRounds(3, 3)).toBe(0);
    expect(missingRounds(2, 5)).toBe(0);
  });
  it('concorda no singular e no plural', () => {
    expect(missingRoundsText(2)).toBe('Faltam 2 rodadas para você entrar no ranking');
    expect(missingRoundsText(1)).toBe('Falta 1 rodada para você entrar no ranking');
    expect(minimumText(3)).toBe('Precisa de 3 rodadas com nota para entrar no ranking');
    expect(minimumText(1)).toBe('Precisa de 1 rodada com nota para entrar no ranking');
  });
});

describe('streakView (C29)', () => {
  it('só aparece a partir de 2 iguais seguidos', () => {
    expect(streakView(null)).toBeNull();
    expect(streakView({ result: 'WIN', count: 1 })).toBeNull();
    expect(streakView({ result: 'WIN', count: 3 })).toEqual({
      mark: '▲',
      text: '3 vitórias seguidas',
    });
    expect(streakView({ result: 'LOSS', count: 2 })).toEqual({
      mark: '▼',
      text: '2 derrotas seguidas',
    });
    expect(streakView({ result: 'DRAW', count: 2 })).toEqual({
      mark: '=',
      text: '2 empates seguidos',
    });
  });
});

describe('goalkeeperLines (C27)', () => {
  it('gols por jogo e jogos sem sofrer gol, com concordância', () => {
    expect(
      goalkeeperLines({ games: 3, conceded: 5, cleanSheets: 3, concededPerGame: 1.67 }),
    ).toEqual([
      { value: '1,7', label: 'gols sofridos por jogo' },
      { value: '3', label: 'jogos sem sofrer gol' },
    ]);
    expect(goalkeeperLines({ games: 2, conceded: 2, cleanSheets: 1, concededPerGame: 1 })).toEqual([
      { value: '1,0', label: 'gols sofridos por jogo' },
      { value: '1', label: 'jogo sem sofrer gol' },
    ]);
  });
  it('sem jogo no gol', () => {
    expect(goalkeeperLines(null)).toEqual([{ value: null, label: 'Ainda sem jogo no gol' }]);
    expect(
      goalkeeperLines({ games: 0, conceded: 0, cleanSheets: 0, concededPerGame: null }),
    ).toEqual([{ value: null, label: 'Ainda sem jogo no gol' }]);
  });
});

describe('roundLancesText (C29)', () => {
  it('gols e assistências no singular e no plural', () => {
    expect(roundLancesText({ goals: 2, assists: 1 })).toBe('2 gols · 1 assistência');
    expect(roundLancesText({ goals: 1, assists: 0 })).toBe('1 gol');
    expect(roundLancesText({ goals: 0, assists: 3 })).toBe('3 assistências');
    expect(roundLancesText({ goals: 0, assists: 0 })).toBe('Sem gols nem assistências');
  });
});

describe('aba na URL (C26)', () => {
  const params = (search: string) => new URLSearchParams(search);
  it('sem nada na URL: Geral, e a posição é a minha', () => {
    expect(parseRankingView(params(''), 'WINGER')).toEqual({ tab: 'geral', position: 'WINGER' });
  });
  it('goleiro abre em Zagueiro', () => {
    expect(parseRankingView(params('?aba=posicao'), 'GOALKEEPER')).toEqual({
      tab: 'posicao',
      position: 'DEFENDER',
    });
  });
  it('a URL manda; valor inválido cai no padrão', () => {
    expect(parseRankingView(params('?aba=posicao&posicao=FORWARD'), 'WINGER')).toEqual({
      tab: 'posicao',
      position: 'FORWARD',
    });
    expect(parseRankingView(params('?aba=xis&posicao=ZZ'), 'MIDFIELDER')).toEqual({
      tab: 'geral',
      position: 'MIDFIELDER',
    });
    expect(parseRankingView(params('?aba=goleiros'), undefined).tab).toBe('goleiros');
  });
  it('a busca de cada aba volta para o parse', () => {
    expect(rankingSearch('geral', 'WINGER')).toBe('');
    expect(rankingSearch('goleiros', 'WINGER')).toBe('?aba=goleiros');
    expect(rankingSearch('posicao', 'WINGER')).toBe('?aba=posicao&posicao=WINGER');
  });
});

describe('rankingRows (C24, C25, C26, C27)', () => {
  const players = [
    player('a', 'MIDFIELDER', 1, 1),
    player('b', 'WINGER', 2, 1),
    player('c', 'MIDFIELDER', 2, 1),
    player('g', 'GOALKEEPER', 4, 1),
    player('d', 'MIDFIELDER', 5, 3),
    player('n', 'MIDFIELDER', null, null),
    player('m', 'GOALKEEPER', null, null),
  ];
  const ids = (list: RankingPlayer[]) => list.map((p) => p.membershipId);

  it('Geral: todos, os classificados e depois os de poucos jogos, na ordem da API', () => {
    const { ranked, few } = rankingRows(players, 'geral', 'DEFENDER');
    expect(ids(ranked)).toEqual(['a', 'b', 'c', 'g', 'd']);
    expect(ids(few)).toEqual(['n', 'm']);
  });
  it('Posição: só a posição escolhida', () => {
    const { ranked, few } = rankingRows(players, 'posicao', 'MIDFIELDER');
    expect(ids(ranked)).toEqual(['a', 'c', 'd']);
    expect(ids(few)).toEqual(['n']);
  });
  it('Goleiros: só quem tem Goleiro como posição principal', () => {
    const { ranked, few } = rankingRows(players, 'goleiros', 'DEFENDER');
    expect(ids(ranked)).toEqual(['g']);
    expect(ids(few)).toEqual(['m']);
  });
  it('posição sem ninguém fica vazia', () => {
    expect(rankingRows(players, 'posicao', 'FORWARD')).toEqual({ ranked: [], few: [] });
  });
});
