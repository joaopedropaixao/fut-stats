import type { RoundStreamScope } from '@fut-stats/shared';
import type { QueryClient } from '@tanstack/react-query';
import { historyKey } from '../history/history-key';
import { matchKey } from '../match/queries';
import { roundsKey } from '../rounds/queries';
import { resultKey, votingKey } from '../voting/queries';

/**
 * O que refazer para cada escopo do aviso. O aviso não traz dado: só marca a consulta como velha e o TanStack
 * busca de novo (só as que estão na tela), pela rota de sempre e com as permissões de quem está vendo.
 */
export function invalidateScopes(
  queryClient: QueryClient,
  groupId: string,
  roundId: string,
  scopes: readonly RoundStreamScope[],
): void {
  const invalidate = (queryKey: readonly unknown[], exact = true) =>
    void queryClient.invalidateQueries({ queryKey, exact });

  for (const scope of new Set(scopes)) {
    if (scope === 'match') {
      invalidate(matchKey(groupId, roundId));
      invalidate(historyKey(groupId));
    } else if (scope === 'voting') {
      invalidate(votingKey(groupId, roundId));
      invalidate(resultKey(groupId, roundId));
    } else {
      // Por prefixo: leva o detalhe da rodada, os times, a lista de rodadas e os avisos do Feed
      invalidate(roundsKey(groupId), false);
    }
  }
}
