import { historyListSchema } from '@fut-stats/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';
import { historyKey } from './history-key';

/**
 * As partidas finalizadas do grupo, uma página por vez. O cursor é o `nextCursor` da página anterior; sem `limit`,
 * a API usa o padrão dela.
 */
export function useHistory(groupId: string) {
  return useInfiniteQuery({
    queryKey: historyKey(groupId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      apiGet(
        `/groups/${groupId}/history${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`,
        historyListSchema,
        { signal },
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
