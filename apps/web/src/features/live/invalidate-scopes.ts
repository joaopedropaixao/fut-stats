import type { MatchView, RoundStreamScope } from '@fut-stats/shared';
import type { QueryClient } from '@tanstack/react-query';
import { historyKey } from '../history/history-key';
import { matchKey } from '../match/queries';
import { playerStatsPrefix, rankingKey } from '../ranking/queries';
import { alertsKey, roundKey, roundsKey } from '../rounds/queries';
import { resultKey, votingKey } from '../voting/queries';

/**
 * O que refazer para cada escopo do aviso. O aviso não traz dado: só marca a consulta como velha e o TanStack
 * busca de novo (só as que estão na tela), pela rota de sempre e com as permissões de quem está vendo.
 *
 * Tudo fica preso à rodada do aviso. O que é do grupo inteiro (lista de rodadas, avisos do Feed, histórico,
 * ranking) é pedido sem cancelar a busca em andamento: com dois canais abertos (rodada da vez e em votação),
 * o segundo aviso entra na busca do primeiro em vez de pedir de novo.
 */
export function invalidateScopes(
  queryClient: QueryClient,
  groupId: string,
  roundId: string,
  scopes: readonly RoundStreamScope[],
): void {
  const wanted = new Set(scopes);
  const invalidate = (queryKey: readonly unknown[], exact = true) =>
    void queryClient.invalidateQueries({ queryKey, exact });
  const invalidateShared = (queryKey: readonly unknown[], exact = true) =>
    void queryClient.invalidateQueries({ queryKey, exact }, { cancelRefetch: false });
  // `status` = mudou a etapa. O prefixo da rodada já alcança a visão do jogo, a da votação e o resultado: pedir
  // de novo cada um à parte cancelaria e repetiria a mesma busca
  const stageChanged = wanted.has('status');

  const votingClosed = wanted.has('voting') && stageChanged;
  let history = false;

  if (wanted.has('match')) {
    if (!stageChanged) invalidate(matchKey(groupId, roundId));
    // Em jogo, placar e lance não mexem no histórico (a partida ainda não terminou): só na troca de etapa e,
    // depois do apito, nos lances da Resenha
    const status = queryClient.getQueryData<MatchView>(matchKey(groupId, roundId))?.status;
    history = stageChanged || status !== 'IN_PROGRESS';
  }
  if (wanted.has('voting') && !stageChanged) {
    invalidate(votingKey(groupId, roundId));
    invalidate(resultKey(groupId, roundId));
  }
  if (history || votingClosed) invalidateShared(historyKey(groupId));
  if (votingClosed) {
    // A votação fechou: a apuração entra no ranking e nas figurinhas (e no histórico, acima)
    invalidateShared(rankingKey(groupId));
    invalidateShared(playerStatsPrefix(groupId), false);
  }
  if (stageChanged) {
    // Por prefixo, só desta rodada: o detalhe, os times, o jogo, a votação e o resultado
    invalidate(roundKey(groupId, roundId), false);
    // A lista de rodadas e os avisos do Feed são do grupo
    invalidateShared(roundsKey(groupId));
    invalidateShared(alertsKey(groupId));
  }
}
