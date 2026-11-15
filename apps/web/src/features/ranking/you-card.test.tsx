import type { RankingPlayer } from '@fut-stats/shared';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { YouCard } from './you-card';

const me: RankingPlayer = {
  membershipId: 'm1',
  nickname: 'Serginho',
  avatar: { skin: 'TAN', hair: 'SHORT', hairColor: 'BLACK' },
  primaryPosition: 'GOALKEEPER',
  rank: null,
  positionRank: null,
  trend: null,
  stats: {
    games: 1,
    wins: 1,
    draws: 0,
    losses: 0,
    goals: 0,
    assists: 0,
    ownGoals: 0,
    mvps: 0,
    flops: 0,
    ratedGames: 1,
    average: 5.9,
    streak: null,
    goalkeeper: null,
  },
};

describe('YouCard (C22, C36)', () => {
  it('C36: fora do ranking, a frase quebra por palavra (nenhum trecho que não quebra, que vazava em 320 px)', () => {
    const html = renderToString(<YouCard me={me} minRatedGames={3} closedRounds={9} />);
    expect(html).toContain('Faltam 2 rodadas para você entrar no ranking');
    expect(html).not.toContain('whitespace-pre');
  });

  it('C22: classificado vê a posição', () => {
    const ranked = { ...me, rank: 4, trend: 1, stats: { ...me.stats, ratedGames: 5 } };
    expect(renderToString(<YouCard me={ranked} minRatedGames={3} closedRounds={9} />)).toContain(
      'Você está em 4º',
    );
  });

  it('pódio: no top 3 o rótulo diz a medalha e a moldura ganha a cor do degrau (nunca o amarelo de ação)', () => {
    const podium = (rank: number) =>
      renderToString(
        <YouCard
          me={{ ...me, rank, trend: 0, stats: { ...me.stats, ratedGames: 5 } }}
          minRatedGames={3}
          closedRounds={9}
        />,
      );
    expect(podium(1)).toContain('Você está em 1º lugar, ouro');
    expect(podium(2)).toContain('Você está em 2º lugar, prata');
    expect(podium(3)).toContain('Você está em 3º lugar, bronze');
    expect(podium(2)).toContain('border-color:var(--color-silver)');
    expect(podium(4)).not.toContain('lugar,');
    expect(podium(4)).not.toContain('border-color');
    for (const rank of [1, 2, 3]) expect(podium(rank)).not.toContain('accent');
  });
});
