import type { RouteObject } from 'react-router';

const loadRoundsArea = () => import('./rounds-area');

/**
 * Rotas da tela rodadas-e-presenca, dentro do shell (o início `/` entra pela lista de abas no router).
 * Padrão de `lazy` (ver app-routes.tsx): lista, detalhe e formulário saem no mesmo pedaço (`./rounds-area`); o jogo, em outro.
 * Um `import()` só para as rotas do pedaço (`loadRoundsArea`): cada ponto de `import()` leva no JS inicial a
 * lista de dependências dele.
 */
export const roundsRoutes: RouteObject[] = [
  {
    path: 'rodadas',
    lazy: async () => ({ Component: (await loadRoundsArea()).RoundsPage }),
  },
  {
    path: 'rodadas/nova',
    lazy: async () => ({ Component: (await loadRoundsArea()).NewRoundPage }),
  },
  {
    path: 'rodadas/:roundId',
    lazy: async () => ({ Component: (await loadRoundsArea()).RoundDetailPage }),
  },
  {
    path: 'rodadas/:roundId/jogo',
    lazy: async () => ({ Component: (await import('../match/match-page')).MatchPage }),
  },
  {
    path: 'rodadas/:roundId/editar',
    lazy: async () => ({ Component: (await loadRoundsArea()).EditRoundPage }),
  },
];
