import type { RouteObject } from 'react-router';

/**
 * Rota do detalhe da partida (a aba Histórico, `/historico`, entra pela lista de abas no router). Vai dentro do
 * AppShell. Lista e detalhe saem no mesmo pedaço (`./historico-area`), como pede o padrão de `lazy` do router.
 */
export const historyRoutes: RouteObject[] = [
  {
    path: 'historico/:roundId',
    lazy: async () => ({ Component: (await import('./historico-area')).HistoryDetailPage }),
  },
];
