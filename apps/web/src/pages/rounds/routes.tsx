import type { RouteObject } from 'react-router';

/**
 * Rotas da tela rodadas-e-presenca, dentro do shell (o início `/` entra pela lista de abas no router).
 * Padrão de `lazy` (ver router.tsx): lista, detalhe e formulário saem no mesmo pedaço (`./rounds-area`); o jogo, em outro.
 */
export const roundsRoutes: RouteObject[] = [
  {
    path: 'rodadas',
    lazy: async () => ({ Component: (await import('./rounds-area')).RoundsPage }),
  },
  {
    path: 'rodadas/nova',
    lazy: async () => ({ Component: (await import('./rounds-area')).NewRoundPage }),
  },
  {
    path: 'rodadas/:roundId',
    lazy: async () => ({ Component: (await import('./rounds-area')).RoundDetailPage }),
  },
  {
    path: 'rodadas/:roundId/jogo',
    lazy: async () => ({ Component: (await import('../match/match-page')).MatchPage }),
  },
  {
    path: 'rodadas/:roundId/editar',
    lazy: async () => ({ Component: (await import('./rounds-area')).EditRoundPage }),
  },
];
