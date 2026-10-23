import {
  lineupSchema,
  roundDetailSchema,
  roundListSchema,
  type Lineup,
  type RoundList,
  type RoundSummary,
  type SaveLineupInput,
} from '@fut-stats/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiGet, apiPost, apiPut } from '../../lib/api';

const roundsKey = (groupId: string) => ['groups', groupId, 'rounds'] as const;
const roundKey = (groupId: string, roundId: string) => [...roundsKey(groupId), roundId] as const;
const lineupKey = (groupId: string, roundId: string) =>
  [...roundKey(groupId, roundId), 'lineup'] as const;
const lineupPath = (groupId: string, roundId: string) =>
  `/groups/${groupId}/rounds/${roundId}/lineup`;

/** O texto que a API mandou (já em português); sem ele, uma frase genérica. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.body) return error.body.message;
  return 'Não deu para falar com o servidor. Tente de novo em instantes.';
}

export function useRoundDetail(groupId: string, roundId: string) {
  return useQuery({
    queryKey: roundKey(groupId, roundId),
    queryFn: ({ signal }) =>
      apiGet(`/groups/${groupId}/rounds/${roundId}`, roundDetailSchema, { signal }),
  });
}

export function useLineup(groupId: string, roundId: string, { enabled = true } = {}) {
  return useQuery({
    enabled,
    queryKey: lineupKey(groupId, roundId),
    queryFn: ({ signal }) => apiGet(lineupPath(groupId, roundId), lineupSchema, { signal }),
  });
}

/**
 * A próxima rodada do grupo: a mais perto daqui para frente; se não há, a mais recente que ainda
 * não encerrou (jogo que já começou).
 */
export function useNextRound(groupId: string) {
  return useQuery({
    queryKey: roundsKey(groupId),
    queryFn: ({ signal }) => apiGet(`/groups/${groupId}/rounds`, roundListSchema, { signal }),
    select: (list: RoundList): RoundSummary | null =>
      list.upcoming[0] ?? list.past.find((round) => round.status !== 'CLOSED') ?? null,
  });
}

/** Salvar, publicar e despublicar devolvem o lineup novo; a rodada (etapa) muda, então refaz o detalhe e a lista. */
function useLineupMutation<V>(
  groupId: string,
  roundId: string,
  run: (variables: V) => Promise<Lineup>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (lineup) => {
      queryClient.setQueryData(lineupKey(groupId, roundId), lineup);
      void queryClient.invalidateQueries({ queryKey: roundsKey(groupId) });
    },
  });
}

export function useSaveLineup(groupId: string, roundId: string) {
  return useLineupMutation(groupId, roundId, (input: SaveLineupInput) =>
    apiPut(lineupPath(groupId, roundId), lineupSchema, input),
  );
}

export function usePublishLineup(groupId: string, roundId: string) {
  return useLineupMutation(groupId, roundId, () =>
    apiPost(`${lineupPath(groupId, roundId)}/publish`, lineupSchema),
  );
}

export function useUnpublishLineup(groupId: string, roundId: string) {
  return useLineupMutation(groupId, roundId, () =>
    apiPost(`${lineupPath(groupId, roundId)}/unpublish`, lineupSchema),
  );
}
