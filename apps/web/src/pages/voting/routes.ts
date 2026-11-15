import type { RouteObject } from 'react-router';

/**
 * Rotas da votação, dentro do AppShell. Padrão de `lazy` (ver router.tsx): votar e resultado saem no mesmo
 * pedaço (`./voting-area`).
 */
export const votingRoutes: RouteObject[] = [
  {
    path: 'rodadas/:roundId/votar',
    lazy: async () => ({ Component: (await import('./voting-area')).VotePage }),
  },
  {
    path: 'rodadas/:roundId/resultado',
    lazy: async () => ({ Component: (await import('./voting-area')).ResultPage }),
  },
];
