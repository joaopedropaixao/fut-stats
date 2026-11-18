import type { RouteObject } from 'react-router';

const loadVotingArea = () => import('./voting-area');

/**
 * Rotas da votação, dentro do AppShell. Padrão de `lazy` (ver app-routes.tsx): votar e resultado saem no mesmo
 * pedaço (`./voting-area`).
 */
export const votingRoutes: RouteObject[] = [
  {
    path: 'rodadas/:roundId/votar',
    lazy: async () => ({ Component: (await loadVotingArea()).VotePage }),
  },
  {
    path: 'rodadas/:roundId/resultado',
    lazy: async () => ({ Component: (await loadVotingArea()).ResultPage }),
  },
];
