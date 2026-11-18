import {
  matchViewSchema,
  startRotationSchema,
  type LaunchMatchEventInput,
  type MatchView,
  type StartRotationInput,
  type SetMatchScoreInput,
} from '@fut-stats/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDeleteJson, apiGet, apiPost, apiPut } from '../../lib/api';
import { historyKey } from '../history/history-key';
import { useChannelMode } from '../live/channel-mode';
import { refreshRounds, roundKey } from '../rounds/queries';
import { matchRefreshInterval } from './refresh-interval';

const matchPath = (groupId: string, roundId: string) =>
  `/groups/${groupId}/rounds/${roundId}/match`;
export const matchKey = (groupId: string, roundId: string) =>
  [...roundKey(groupId, roundId), 'match'] as const;

/**
 * O jogo da rodada. Em jogo e na Resenha, atualiza sozinho: quem acompanha vê os lances dos outros. Com o canal ao
 * vivo conectado, o aviso da API dispara a busca (60 s de segurança); sem ele, 15 s em jogo e 5 s na Resenha.
 * Ao voltar para a aba, também atualiza na hora.
 */
export function useMatch(groupId: string, roundId: string | undefined) {
  const channel = useChannelMode(roundId);
  return useQuery({
    queryKey: matchKey(groupId, roundId ?? ''),
    queryFn: ({ signal }) => apiGet(matchPath(groupId, roundId ?? ''), matchViewSchema, { signal }),
    enabled: roundId !== undefined,
    refetchInterval: (query) => matchRefreshInterval(query.state.data?.status, channel),
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
    void refreshRounds(queryClient, groupId);
    // A partida entra no Histórico ao finalizar: a lista refaz ao abrir
    void queryClient.invalidateQueries({ queryKey: historyKey(groupId), exact: true });
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
    startRotation: useMutation({
      mutationFn: (input: StartRotationInput) =>
        apiPost(`${path}/rotation`, matchViewSchema, startRotationSchema.parse(input)),
      onSuccess: setView,
    }),
    stopRotation: useMutation({
      mutationFn: () => apiDeleteJson(`${path}/rotation`, matchViewSchema),
      onSuccess: setView,
    }),
    openVoting: useMutation({
      mutationFn: () => apiPost(`${path}/open-voting`, matchViewSchema),
      onSuccess: setViewAndRefreshRound,
    }),
    setScore: useMutation({
      mutationFn: (score: SetMatchScoreInput) => apiPut(`${path}/score`, matchViewSchema, score),
      onSuccess: (view: MatchView) => {
        setView(view);
        void queryClient.invalidateQueries({ queryKey: historyKey(groupId), exact: true });
      },
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
