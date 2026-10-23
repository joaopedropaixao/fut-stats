import {
  matchViewSchema,
  type ChangeMatchStatusInput,
  type LaunchMatchEventInput,
  type MatchView,
  type SetMatchScoreInput,
} from '@fut-stats/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../../lib/api';

const matchPath = (groupId: string, roundId: string) =>
  `/groups/${groupId}/rounds/${roundId}/match`;

const matchKey = (groupId: string, roundId: string) => ['match', groupId, roundId] as const;

/** De quanto em quanto tempo o placar se atualiza sozinho durante o jogo (ms). */
const LIVE_REFRESH = 15_000;

/** O jogo da rodada. Enquanto está aberto (em jogo ou votação), atualiza sozinho para quem acompanha. */
export function useMatch(groupId: string | undefined, roundId: string) {
  return useQuery({
    queryKey: matchKey(groupId ?? '', roundId),
    queryFn: ({ signal }) => apiGet(matchPath(groupId!, roundId), matchViewSchema, { signal }),
    enabled: groupId !== undefined,
    refetchInterval: (query) => (query.state.data?.isOpen ? LIVE_REFRESH : false),
  });
}

/** Toda escrita devolve o jogo atualizado: troca o cache direto, sem nova ida à API. */
export function useMatchActions(groupId: string, roundId: string) {
  const queryClient = useQueryClient();
  const path = matchPath(groupId, roundId);
  const onSuccess = (view: MatchView) => queryClient.setQueryData(matchKey(groupId, roundId), view);

  return {
    changeStatus: useMutation({
      mutationFn: (body: ChangeMatchStatusInput) =>
        apiPatch(`${path}/status`, matchViewSchema, { body }),
      onSuccess,
    }),
    setScore: useMutation({
      mutationFn: (body: SetMatchScoreInput) => apiPut(`${path}/score`, matchViewSchema, { body }),
      onSuccess,
    }),
    launchEvent: useMutation({
      mutationFn: (body: LaunchMatchEventInput) =>
        apiPost(`${path}/events`, matchViewSchema, { body }),
      onSuccess,
    }),
    removeEvent: useMutation({
      mutationFn: (eventId: string) => apiDelete(`${path}/events/${eventId}`, matchViewSchema),
      onSuccess,
    }),
  };
}
