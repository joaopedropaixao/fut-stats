import type { MeResponse } from '@fut-stats/shared';
import type { QueryClient } from '@tanstack/react-query';
import { setMonitoringUser } from '../../app/monitoring';
import { sessionQueryKey } from './use-session';

/**
 * O Sentry sabe quem está logado (só o id) em qualquer tela, no ponto único onde a sessão (`/me`) vive: o cache do
 * TanStack. Cobre o AppShell, `RequireSession` (/comecar, /convite), a atualização em segundo plano e o "Sair da
 * conta" (que limpa o cache e grava `null`). Chamado uma vez, em `main.tsx`. Devolve a função que desfaz a assinatura.
 */
export function monitorSession(
  queryClient: QueryClient,
  setUser: (id: string | null) => void = setMonitoringUser,
): () => void {
  const isSession = (queryKey: readonly unknown[]) =>
    queryKey.length === sessionQueryKey.length && queryKey[0] === sessionQueryKey[0];

  return queryClient.getQueryCache().subscribe((event) => {
    if (!isSession(event.query.queryKey)) return;
    if (event.type === 'removed') return setUser(null);
    if (event.type === 'updated' && event.action.type === 'success') {
      const me = event.query.state.data as MeResponse | null | undefined;
      setUser(me?.user.id ?? null);
    }
  });
}
