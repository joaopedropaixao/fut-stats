import {
  matchViewSchema,
  type LaunchMatchEventInput,
  type MatchView,
  type SetMatchScoreInput,
} from '@fut-stats/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDeleteJson, apiGet, apiPost, apiPut } from '../../lib/api';
import { roundKey, roundsKey } from '../rounds/queries';
import { matchRefreshInterval } from './refresh-interval';

const matchPath = (groupId: string, roundId: string) =>
  `/groups/${groupId}/rounds/${roundId}/match`;
const matchKey = (groupId: string, roundId: string) =>
  [...roundKey(groupId, roundId), 'match'] as const;

/**
 * O jogo da rodada. Em jogo (15 s) e na Resenha (5 s), atualiza sozinho: quem acompanha vê os lances dos outros.
 * Ao voltar para a aba, também atualiza na hora.
 */
export function useMatch(groupId: string, roundId: string | undefined) {
  return useQuery({
    queryKey: matchKey(groupId, roundId ?? ''),
    queryFn: ({ signal }) => apiGet(matchPath(groupId, roundId ?? ''), matchViewSchema, { signal }),
    enabled: roundId !== undefined,
    refetchInterval: (query) => matchRefreshInterval(query.state.data?.status),
    refetchOnWindowFocus: true,
  });
}

/** Toda escrita devolve a visão nova: troca o cache direto. Mudar de etapa refaz o detalhe e a lista de rodadas. */
export function useMatchActions(groupId: string, roundId: string) {
  const queryClient = useQueryClient();
  const path = matchPath(groupId, roundId);
  const setView = (view: MatchView) => queryClient.setQueryData(matchKey(groupId, roundId), view);
  const setViewAndRefreshRound = (view: MatchView) => {
    setView(view);
    void queryClient.invalidateQueries({ queryKey: roundKey(groupId, roundId), exact: true });
    void queryClient.invalidateQueries({ queryKey: roundsKey(groupId), exact: true });
  };

  return {
    start: useMutation({
      mutationFn: () => apiPost(`${path}/start`, matchViewSchema),
      onSuccess: setViewAndRefreshRound,
    }),
    finish: useMutation({
      mutationFn: (score: SetMatchScoreInput) => apiPost(`${path}/finish`, matchViewSchema, score),
      onSuccess: setViewAndRefreshRound,
    }),
    openVoting: useMutation({
      mutationFn: () => apiPost(`${path}/open-voting`, matchViewSchema),
      onSuccess: setViewAndRefreshRound,
    }),
    setScore: useMutation({
      mutationFn: (score: SetMatchScoreInput) => apiPut(`${path}/score`, matchViewSchema, score),
      onSuccess: setView,
    }),
    launch: useMutation({
      mutationFn: (input: LaunchMatchEventInput) =>
        apiPost(`${path}/events`, matchViewSchema, input),
      onSuccess: setView,
    }),
    remove: useMutation({
      mutationFn: (eventId: string) => apiDeleteJson(`${path}/events/${eventId}`, matchViewSchema),
      onSuccess: setView,
    }),
  };
}
