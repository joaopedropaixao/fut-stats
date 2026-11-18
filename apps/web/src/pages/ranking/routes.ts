import type { RouteObject } from 'react-router';

/**
 * Rota da figurinha do jogador (a aba Ranking, `/ranking`, entra pela lista de abas no router). Vai dentro do AppShell.
 * A aba e a figurinha saem no mesmo pedaço (`./ranking-area`), como pede o padrão de `lazy` do router.
 */
export const rankingRoutes: RouteObject[] = [
  {
    path: 'jogadores/:membershipId',
    lazy: async () => ({ Component: (await import('./ranking-area')).PlayerPage }),
  },
];
