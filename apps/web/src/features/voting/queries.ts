import {
  roundResultSchema,
  votingViewSchema,
  type SubmitVoteInput,
  type VotingView,
} from '@fut-stats/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '../../lib/api';
import { historyKey } from '../history/history-key';
import { refreshRounds, roundKey } from '../rounds/queries';

const votingPath = (groupId: string, roundId: string) =>
  `/groups/${groupId}/rounds/${roundId}/voting`;
const votingKey = (groupId: string, roundId: string) =>
  [...roundKey(groupId, roundId), 'voting'] as const;
export const resultKey = (groupId: string, roundId: string) =>
  [...roundKey(groupId, roundId), 'voting-result'] as const;

/** De quanto em quanto tempo a votação aberta se atualiza sozinha (ms): o medidor mostra quem votou. */
export const VOTING_REFRESH_MS = 15_000;

/**
 * A votação da rodada. Aberta, atualiza a cada 15 s e ao voltar para a aba (a `jogo-ao-vivo` troca por tempo
 * real depois). Fechada ou antes de abrir, nada muda sozinho.
 */
export function useVoting(groupId: string, roundId: string | undefined) {
  return useQuery({
    queryKey: votingKey(groupId, roundId ?? ''),
    queryFn: ({ signal }) =>
      apiGet(votingPath(groupId, roundId ?? ''), votingViewSchema, { signal }),
    enabled: roundId !== undefined,
    refetchInterval: (query) => (query.state.data?.status === 'VOTING' ? VOTING_REFRESH_MS : false),
    refetchOnWindowFocus: true,
  });
}

/** O resultado da rodada fechada. Antes disso a API responde 409 (`RESULT_NOT_READY`). */
export function useResult(groupId: string, roundId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: resultKey(groupId, roundId ?? ''),
    queryFn: ({ signal }) =>
      apiGet(`${votingPath(groupId, roundId ?? '')}/result`, roundResultSchema, { signal }),
    enabled: roundId !== undefined && enabled,
  });
}

/** Votar e encerrar devolvem a visão nova: troca o cache direto. Fechar refaz a lista de rodadas e o histórico. */
export function useVotingActions(groupId: string, roundId: string) {
  const queryClient = useQueryClient();
  const path = votingPath(groupId, roundId);
  const setView = (view: VotingView) => {
    queryClient.setQueryData(votingKey(groupId, roundId), view);
    void refreshRounds(queryClient, groupId);
    if (view.status === 'CLOSED') {
      void queryClient.invalidateQueries({ queryKey: historyKey(groupId), exact: true });
      void queryClient.invalidateQueries({ queryKey: resultKey(groupId, roundId), exact: true });
    }
  };

  return {
    submit: useMutation({
      mutationFn: (input: SubmitVoteInput) => apiPut(`${path}/vote`, votingViewSchema, input),
      onSuccess: setView,
      // A votação fechou enquanto votava: a visão do servidor (já fechada) é a que vale
      onError: () => void queryClient.invalidateQueries({ queryKey: votingKey(groupId, roundId) }),
    }),
    close: useMutation({
      mutationFn: () => apiPost(`${path}/close`, votingViewSchema),
      onSuccess: setView,
    }),
  };
}
