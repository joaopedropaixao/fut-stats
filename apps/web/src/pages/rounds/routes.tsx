import type { RouteObject } from 'react-router';
import { RoundDetailPage } from './detail';
import { EditRoundPage, NewRoundPage } from './form';
import { RoundsPage } from './list';
import { MatchPage } from '../match/match-page';

/** Rotas da tela rodadas-e-presenca, dentro do shell (o início `/` é a `HomePage`, ligada no router no lugar do placeholder). */
export const roundsRoutes: RouteObject[] = [
  { path: 'rodadas', element: <RoundsPage /> },
  { path: 'rodadas/nova', element: <NewRoundPage /> },
  { path: 'rodadas/:roundId', element: <RoundDetailPage /> },
  { path: 'rodadas/:roundId/jogo', element: <MatchPage /> },
  { path: 'rodadas/:roundId/editar', element: <EditRoundPage /> },
];
