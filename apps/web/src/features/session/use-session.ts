import type { MeResponse } from '@fut-stats/shared';
import { useQuery } from '@tanstack/react-query';
import { ApiError, apiGet } from '../../lib/api';

export const sessionQueryKey = ['me'] as const;

/**
 * O schema do /me sai do pedaço inicial: zod, `shared` e `domain` pesam ~30 kB gzip e qualquer import de valor
 * de `shared` os puxa (aqui só entra tipo). O `import()` começa junto com o GET /me, então a validação não
 * espera um pedido depois do outro.
 */
const loadMeSchema = () => import('@fut-stats/shared').then((shared) => shared.meResponseSchema);

/** GET /api/me: os dados do usuário logado, ou `null` se não há sessão (401). */
export async function fetchSession(signal?: AbortSignal): Promise<MeResponse | null> {
  try {
    return await apiGet('/me', loadMeSchema(), { signal });
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
