import {
  lineupSchema,
  lineupSuggestionSchema,
  type Lineup,
  type SaveLineupInput,
  type SuggestLineupInput,
} from '@fut-stats/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '../../lib/api';
import { roundKey, roundsKey } from '../rounds/queries';

const lineupKey = (groupId: string, roundId: string) =>
  [...roundKey(groupId, roundId), 'lineup'] as const;
const lineupPath = (groupId: string, roundId: string) =>
  `/groups/${groupId}/rounds/${roundId}/lineup`;

/** Os times da rodada: o rascunho (admin) ou os publicados. As permissões e o que falta vêm da API. */
export function useLineup(groupId: string, roundId: string | undefined) {
  return useQuery({
    queryKey: lineupKey(groupId, roundId ?? ''),
    queryFn: ({ signal }) => apiGet(lineupPath(groupId, roundId ?? ''), lineupSchema, { signal }),
    enabled: roundId !== undefined,
  });
}

/** Salvar, publicar e despublicar devolvem o lineup novo; o status da rodada muda, então refaz o detalhe e a lista. */
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
      void queryClient.invalidateQueries({ queryKey: roundKey(groupId, roundId), exact: true });
      void queryClient.invalidateQueries({ queryKey: roundsKey(groupId), exact: true });
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

/** Sugestão de times (só calcula, não grava): não mexe no cache do lineup; quem chama põe o resultado no rascunho. */
export function useSuggestLineup(groupId: string, roundId: string) {
  return useMutation({
    mutationFn: (input: SuggestLineupInput) =>
      apiPost(`${lineupPath(groupId, roundId)}/suggestion`, lineupSuggestionSchema, input),
  });
}
