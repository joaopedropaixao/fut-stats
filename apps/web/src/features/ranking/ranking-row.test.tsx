import type { RankingPlayer } from '@fut-stats/shared';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { RankingRow } from './ranking-row';

const player: RankingPlayer = {
  membershipId: 'm1',
  nickname: 'Marcelinho',
  avatar: { skin: 'TAN', hair: 'SHORT', hairColor: 'BLACK' },
  primaryPosition: 'FORWARD',
  rank: 1,
  positionRank: 1,
  trend: null,
  stats: {
    games: 8,
    wins: 4,
    draws: 2,
    losses: 2,
    goals: 3,
    assists: 1,
    ownGoals: 0,
    mvps: 0,
    flops: 0,
    ratedGames: 8,
    average: 8.4,
    streak: null,
    goalkeeper: null,
  },
};

const html = (p: RankingPlayer, tab: 'geral' | 'posicao' | 'goleiros' = 'geral') =>
  renderToString(
    <StaticRouter location="/ranking">
      <ul>
        <RankingRow player={p} tab={tab} index={0} mine={false} />
      </ul>
    </StaticRouter>,
  );

describe('pódio nas linhas do ranking', () => {
  it('1º, 2º e 3º levam a medalha e o nome para leitor de tela', () => {
    expect(html({ ...player, rank: 1 })).toContain('aria-label="1º lugar, ouro"');
    expect(html({ ...player, rank: 2 })).toContain('aria-label="2º lugar, prata"');
    expect(html({ ...player, rank: 3 })).toContain('aria-label="3º lugar, bronze"');
    expect(html({ ...player, rank: 1 })).toContain('<svg aria-hidden');
  });

  it('do 4º em diante, e sem posição, sem medalha', () => {
    expect(html({ ...player, rank: 4 })).toContain('aria-label="4º no ranking"');
    expect(html({ ...player, rank: 4 })).not.toContain('lugar,');
    expect(html({ ...player, rank: null })).not.toContain('lugar,');
  });

  it('nas abas Posição e Goleiros a medalha segue a posição de dentro da posição', () => {
    const p = { ...player, rank: 9, positionRank: 2 };
    expect(html(p, 'posicao')).toContain('aria-label="2º lugar, prata"');
    expect(html(p, 'geral')).not.toContain('lugar,');
  });

  it('nunca o amarelo de ação no pódio', () => {
    for (const rank of [1, 2, 3]) expect(html({ ...player, rank })).not.toContain('accent');
  });
});
