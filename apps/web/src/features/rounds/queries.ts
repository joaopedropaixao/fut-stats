import {
  roundDetailSchema,
  roundListSchema,
  type CreateRoundInput,
  type RoundDetail,
  type UpdateRoundInput,
} from '@fut-stats/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../../lib/api';
import { applyAttendance } from './apply-attendance';

const roundsPath = (groupId: string) => `/groups/${groupId}/rounds`;

export const roundsKey = (groupId: string) => ['rounds', groupId] as const;
export const roundKey = (groupId: string, roundId: string) => ['rounds', groupId, roundId] as const;

/** Próximas e passadas do grupo. */
export function useRounds(groupId: string) {
  return useQuery({
    queryKey: roundsKey(groupId),
    queryFn: ({ signal }) => apiGet(roundsPath(groupId), roundListSchema, { signal }),
  });
}

/** A rodada com a lista de presença. */
export function useRound(groupId: string, roundId: string | undefined) {
  return useQuery({
    queryKey: roundKey(groupId, roundId ?? ''),
    queryFn: ({ signal }) =>
      apiGet(`${roundsPath(groupId)}/${roundId}`, roundDetailSchema, { signal }),
    enabled: roundId !== undefined,
  });
}

export function useCreateRound(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoundInput) => apiPost(roundsPath(groupId), roundDetailSchema, input),
    onSuccess: (round) => {
      queryClient.setQueryData(roundKey(groupId, round.id), round);
      return queryClient.invalidateQueries({ queryKey: roundsKey(groupId), exact: true });
    },
  });
}

export function useUpdateRound(groupId: string, roundId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateRoundInput) =>
      apiPatch(`${roundsPath(groupId)}/${roundId}`, roundDetailSchema, input),
    onSuccess: (round) => {
      queryClient.setQueryData(roundKey(groupId, roundId), round);
      return queryClient.invalidateQueries({ queryKey: roundsKey(groupId), exact: true });
    },
  });
}

export function useDeleteRound(groupId: string, roundId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete(`${roundsPath(groupId)}/${roundId}`),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: roundKey(groupId, roundId) });
      return queryClient.invalidateQueries({ queryKey: roundsKey(groupId), exact: true });
    },
  });
}

type AttendanceVars = { membershipId: string; confirmed: boolean };

/**
 * Vou / Não vou com atualização otimista: a lista muda na hora; se a API recusar, volta ao que estava
 * (o erro é de quem chama). A resposta da API substitui a previsão.
 */
export function useSetAttendance(groupId: string, roundId: string) {
  const queryClient = useQueryClient();
  const key = roundKey(groupId, roundId);

  const mutationKey = ['attendance', groupId, roundId];
  /** Com outro envio em andamento, a previsão dele está na tela: só a última resposta pode refazer o estado. */
  const othersInFlight = () => queryClient.isMutating({ mutationKey }) > 1;

  return useMutation({
    mutationKey,
    mutationFn: ({ membershipId, confirmed }: AttendanceVars) =>
      apiPut(`${roundsPath(groupId)}/${roundId}/attendances/${membershipId}`, roundDetailSchema, {
        confirmed,
      }),
    onMutate: async ({ membershipId, confirmed }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<RoundDetail>(key);
      if (previous)
        queryClient.setQueryData(key, applyAttendance(previous, membershipId, confirmed));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous && !othersInFlight()) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (round) => {
      if (!othersInFlight()) queryClient.setQueryData(key, round);
    },
    onSettled: () => {
      if (othersInFlight()) return;
      // Sozinho, a resposta (ou o estado de antes do erro) já está na tela; o resto só confere com a API
      void queryClient.invalidateQueries({ queryKey: key });
      return queryClient.invalidateQueries({ queryKey: roundsKey(groupId), exact: true });
    },
  });
}
