import { meResponseSchema, type MeResponse } from '@fut-stats/shared';
import { useQuery } from '@tanstack/react-query';
import { ApiError, apiGet } from '../../lib/api';

export const sessionQueryKey = ['me'] as const;

/** GET /api/me: os dados do usuário logado, ou `null` se não há sessão (401). */
export async function fetchSession(signal?: AbortSignal): Promise<MeResponse | null> {
  try {
    return await apiGet('/me', meResponseSchema, { signal });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

/**
 * Sessão atual. `data` é `null` quando não está logado; `isError` só quando a API falhou de verdade
 * (fora do ar, contrato quebrado), para a tela mostrar "Tentar de novo" em vez de mandar para o login.
 */
export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: ({ signal }) => fetchSession(signal),
    staleTime: 5 * 60 * 1000,
  });
}
