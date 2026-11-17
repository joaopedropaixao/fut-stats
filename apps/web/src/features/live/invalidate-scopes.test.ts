import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { historyKey } from '../history/history-key';
import { matchKey } from '../match/queries';
import { alertsKey, roundKey, roundsKey } from '../rounds/queries';
import { resultKey, votingKey } from '../voting/queries';
import { invalidateScopes } from './invalidate-scopes';

const G = 'g1';
const R = 'r1';

function seeded() {
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
    otherGroup: roundsKey('g2'),
    ranking: ['ranking', G] as const,
  };
  for (const key of Object.values(keys)) client.setQueryData(key, {});
  const invalidated = () =>
    Object.entries(keys)
      .filter(([, key]) => client.getQueryState(key)?.isInvalidated)
      .map(([name]) => name)
      .sort();
  return { client, invalidated };
}

describe('invalidateScopes: o que refaz em cada escopo', () => {
  it('match: a visão do jogo e o histórico, nada mais', () => {
    const { client, invalidated } = seeded();
    invalidateScopes(client, G, R, ['match']);
    expect(invalidated()).toEqual(['history', 'match']);
  });

  it('voting: a visão da votação e o resultado', () => {
    const { client, invalidated } = seeded();
    invalidateScopes(client, G, R, ['voting']);
    expect(invalidated()).toEqual(['result', 'voting']);
  });

  it('status: tudo sob a lista de rodadas do grupo (detalhe, times, avisos), sem tocar em outro grupo', () => {
    const { client, invalidated } = seeded();
    invalidateScopes(client, G, R, ['status']);
    expect(invalidated()).toEqual(
      ['alerts', 'detail', 'lineup', 'list', 'match', 'voting', 'result'].sort(),
    );
  });

  it('vários escopos somam, e o mesmo escopo repetido não atrapalha', () => {
    const { client, invalidated } = seeded();
    invalidateScopes(client, G, R, ['voting', 'voting']);
    expect(invalidated()).toEqual(['result', 'voting']);
    invalidateScopes(client, G, R, ['match']);
    expect(invalidated()).toEqual(['history', 'match', 'result', 'voting']);
  });
});
