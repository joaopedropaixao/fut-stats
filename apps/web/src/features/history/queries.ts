import {
  historyDetailSchema,
  historyListSchema,
  HISTORY_PAGE_DEFAULT,
  type HistoryDetail,
} from '@fut-stats/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';

export function useHistoryList(groupId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['history', groupId, 'list'],
    enabled: groupId !== undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => {
      const query = new URLSearchParams({ limit: String(HISTORY_PAGE_DEFAULT) });
      if (pageParam) query.set('cursor', pageParam);
      return apiGet(`/groups/${groupId}/history?${query}`, historyListSchema, { signal });
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useHistoryDetail(groupId: string | undefined, roundId: string | undefined) {
  return useQuery<HistoryDetail>({
    queryKey: ['history', groupId, 'detail', roundId],
    enabled: groupId !== undefined && roundId !== undefined,
    queryFn: ({ signal }) =>
      apiGet(`/groups/${groupId}/history/${roundId}`, historyDetailSchema, { signal }),
  });
}
