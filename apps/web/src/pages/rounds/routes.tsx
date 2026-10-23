import type { RouteObject } from 'react-router';
import { RoundDetailPage } from './detail';
import { EditRoundPage, NewRoundPage } from './form';
import { RoundsPage } from './list';

/** Rotas da tela rodadas-e-presenca, dentro do shell (o início `/` é a `HomePage`, ligada no router no lugar do placeholder). */
export const roundsRoutes: RouteObject[] = [
  { path: 'rodadas', element: <RoundsPage /> },
  { path: 'rodadas/nova', element: <NewRoundPage /> },
  { path: 'rodadas/:roundId', element: <RoundDetailPage /> },
  { path: 'rodadas/:roundId/editar', element: <EditRoundPage /> },
];
