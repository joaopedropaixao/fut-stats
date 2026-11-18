import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { historyKey } from '../history/history-key';
import { matchKey } from '../match/queries';
import { playerProfileKey, rankingKey } from '../ranking/queries';
import { alertsKey, roundKey, roundsKey } from '../rounds/queries';
import { resultKey, votingKey } from '../voting/queries';
import { invalidateScopes } from './invalidate-scopes';

const G = 'g1';
const R = 'r1';

function seeded(matchStatus: string = 'POST_MATCH') {
  const client = new QueryClient();
  const keys = {
    match: matchKey(G, R),
    history: historyKey(G),
    voting: votingKey(G, R),
    result: resultKey(G, R),
    list: roundsKey(G),
    alerts: alertsKey(G),
    detail: roundKey(G, R),
    lineup: [...roundKey(G, R), 'lineup'] as const,
    otherRound: [...roundKey(G, 'r2'), 'match'] as const,
    otherGroup: roundsKey('g2'),
    ranking: rankingKey(G),
    profile: playerProfileKey(G, 'm1'),
  };
  for (const key of Object.values(keys)) client.setQueryData(key, {});
  client.setQueryData(keys.match, { status: matchStatus });
  const invalidated = () =>
    Object.entries(keys)
      .filter(([, key]) => client.getQueryState(key)?.isInvalidated)
      .map(([name]) => name)
      .sort();
  return { client, invalidated };
}

describe('invalidateScopes: o que refaz em cada escopo', () => {
  it('match na Resenha: a visão do jogo e o histórico (os lances entram nele)', () => {
    const { client, invalidated } = seeded('POST_MATCH');
    invalidateScopes(client, G, R, ['match']);
    expect(invalidated()).toEqual(['history', 'match']);
  });

  it('match em jogo: só a visão do jogo; o histórico espera a troca de etapa', () => {
    const { client, invalidated } = seeded('IN_PROGRESS');
    invalidateScopes(client, G, R, ['match']);
    expect(invalidated()).toEqual(['match']);
  });

  it('voting: a visão da votação e o resultado', () => {
    const { client, invalidated } = seeded();
    invalidateScopes(client, G, R, ['voting']);
    expect(invalidated()).toEqual(['result', 'voting']);
  });

  it('status: tudo desta rodada, a lista e os avisos do Feed; nem outra rodada nem outro grupo', () => {
    const { client, invalidated } = seeded();
    invalidateScopes(client, G, R, ['status']);
    expect(invalidated()).toEqual(
      ['alerts', 'detail', 'lineup', 'list', 'match', 'voting', 'result'].sort(),
    );
  });

  it('match + status (troca de etapa do jogo): refaz o histórico mesmo em jogo', () => {
    const { client, invalidated } = seeded('IN_PROGRESS');
    invalidateScopes(client, G, R, ['match', 'status']);
    expect(invalidated()).toContain('history');
  });

  it('voting + status (a votação fechou): histórico, ranking e figurinhas também', () => {
    const { client, invalidated } = seeded();
    invalidateScopes(client, G, R, ['voting', 'status']);
    expect(invalidated()).toEqual(
      [
        'alerts',
        'detail',
        'history',
        'lineup',
        'list',
        'match',
        'profile',
        'ranking',
        'result',
        'voting',
      ].sort(),
    );
  });

  it('status junto de match e voting: nenhuma chave da rodada é pedida duas vezes', () => {
    const { client } = seeded();
    const spy = vi.spyOn(client, 'invalidateQueries');
    invalidateScopes(client, G, R, ['match', 'voting', 'status']);
    const keys = spy.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((k) => k.startsWith(JSON.stringify(roundKey(G, R)).slice(0, -1)))).toEqual([
      JSON.stringify(roundKey(G, R)),
    ]);
  });

  it('o que é do grupo não cancela a busca em andamento (dois canais juntam a mesma busca)', () => {
    const { client } = seeded();
    const spy = vi.spyOn(client, 'invalidateQueries');
    invalidateScopes(client, G, R, ['status']);
    invalidateScopes(client, G, 'r2', ['status']);
    const shared = spy.mock.calls.filter(([filters]) =>
      [JSON.stringify(roundsKey(G)), JSON.stringify(alertsKey(G))].includes(
        JSON.stringify(filters?.queryKey),
      ),
    );
    expect(shared).toHaveLength(4);
    for (const [, options] of shared) expect(options).toEqual({ cancelRefetch: false });
  });

  it('vários escopos somam, e o mesmo escopo repetido não atrapalha', () => {
    const { client, invalidated } = seeded();
    invalidateScopes(client, G, R, ['voting', 'voting']);
    expect(invalidated()).toEqual(['result', 'voting']);
    invalidateScopes(client, G, R, ['match']);
    expect(invalidated()).toEqual(['history', 'match', 'result', 'voting']);
  });
});
