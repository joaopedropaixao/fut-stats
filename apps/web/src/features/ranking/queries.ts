import { playerProfileSchema, rankingSchema } from '@fut-stats/shared';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';

// As chaves ficam sob ['group', groupId], como as do resto: trocar o perfil, o elenco ou o grupo refaz o ranking.
export const rankingKey = (groupId: string) => ['group', groupId, 'ranking'] as const;
/** Todas as figurinhas do grupo (prefixo de `playerProfileKey`). */
export const playerStatsPrefix = (groupId: string) => ['group', groupId, 'player-stats'] as const;
export const playerProfileKey = (groupId: string, membershipId: string) =>
  [...playerStatsPrefix(groupId), membershipId] as const;

/** O ranking do grupo inteiro (geral, por posição e goleiros vêm na mesma resposta; trocar de aba não espera a rede). */
export function useRanking(groupId: string) {
  return useQuery({
    queryKey: rankingKey(groupId),
    queryFn: ({ signal }) => apiGet(`/groups/${groupId}/ranking`, rankingSchema, { signal }),
  });
}

/** A figurinha de um jogador ativo: estatísticas, posição no ranking, nota de referência e as últimas rodadas. */
export function usePlayerProfile(groupId: string, membershipId: string | undefined) {
  return useQuery({
    queryKey: playerProfileKey(groupId, membershipId ?? ''),
    queryFn: ({ signal }) =>
      apiGet(`/groups/${groupId}/members/${membershipId}/stats`, playerProfileSchema, { signal }),
    enabled: membershipId !== undefined,
  });
}
