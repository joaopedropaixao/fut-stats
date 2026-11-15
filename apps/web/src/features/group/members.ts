import {
  memberSchema,
  rosterMemberSchema,
  type Member,
  type RosterMember,
  type UpdateMemberInput,
} from '@fut-stats/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet, apiPatch } from '../../lib/api';
import { applyRosterChange } from './roster-state';
import { sessionQueryKey } from '../session/use-session';

const groupPath = (groupId: string) => `/groups/${groupId}`;

export const memberKey = (groupId: string, membershipId: string) =>
  ['group', groupId, 'member', membershipId] as const;
export const rosterKey = (groupId: string) => ['group', groupId, 'roster'] as const;

/** Um membro do grupo (o próprio, ou qualquer um para o admin; o inativo só o admin vê). */
export function useMember(groupId: string, membershipId: string | undefined) {
  return useQuery({
    queryKey: memberKey(groupId, membershipId ?? ''),
    queryFn: ({ signal }) =>
      apiGet(`${groupPath(groupId)}/members/${membershipId}`, memberSchema, { signal }),
    enabled: membershipId !== undefined,
  });
}

/** O Elenco: todos os membros, ativos primeiro (só o admin; para o jogador comum a API responde 403). */
export function useRoster(groupId: string, enabled = true) {
  return useQuery({
    queryKey: rosterKey(groupId),
    queryFn: ({ signal }) =>
      apiGet(`${groupPath(groupId)}/roster`, z.array(rosterMemberSchema), { signal }),
    enabled,
  });
}

/** O PATCH devolve a linha do Elenco (admin) ou o `Member` (o próprio, jogador comum). */
const updatedMemberSchema = z.union([rosterMemberSchema, memberSchema]);

type Client = ReturnType<typeof useQueryClient>;

/**
 * Marca como velho tudo o que mostra membros do grupo e o `/me` (início, listas de presença, times, jogo):
 * o que está na tela só troca com o que a API guardou.
 */
export function refreshMembers(queryClient: Client, groupId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: sessionQueryKey }),
    queryClient.invalidateQueries({ queryKey: ['group', groupId] }),
    queryClient.invalidateQueries({ queryKey: ['rounds', groupId] }),
  ]);
}

/** Edita um membro (`PATCH`): o próprio, ou qualquer um para o admin. */
export function useUpdateMember(groupId: string, membershipId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMemberInput) =>
      apiPatch(`${groupPath(groupId)}/members/${membershipId}`, updatedMemberSchema, input),
    onSuccess: () => {
      void refreshMembers(queryClient, groupId);
    },
  });
}

type RowChange = { membershipId: string; change: Pick<UpdateMemberInput, 'role' | 'active'> };

/**
 * A mudança do menu ⋯ do Elenco (papel ou ativo): a linha troca na hora; se a API recusar, volta ao que era.
 * Quem chama mostra o aviso (com Desfazer, ou o erro com o texto da API).
 */
export function useChangeRosterMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, change }: RowChange) =>
      apiPatch(`${groupPath(groupId)}/members/${membershipId}`, updatedMemberSchema, change),
    onMutate: async ({ membershipId, change }) => {
      await queryClient.cancelQueries({ queryKey: rosterKey(groupId) });
      const previous = queryClient.getQueryData<RosterMember[]>(rosterKey(groupId));
      if (previous) {
        queryClient.setQueryData(
          rosterKey(groupId),
          applyRosterChange(previous, membershipId, change),
        );
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(rosterKey(groupId), context.previous);
    },
    onSettled: () => refreshMembers(queryClient, groupId),
  });
}

export type { Member, RosterMember };
