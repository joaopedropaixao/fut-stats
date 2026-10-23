import type { RouteObject } from 'react-router';
import { AppShell } from '../../app/shell';
import { MatchPage } from './match-page';

/** Rota da tela do jogo: placar e lances da rodada. */
export const matchRoutes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [{ path: '/rodadas/:roundId/jogo', element: <MatchPage /> }],
  },
];
