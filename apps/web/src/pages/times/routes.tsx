import type { RouteObject } from 'react-router';
import { RoundLineupPage } from './round-lineup-page';
import { TeamsTabPage } from './teams-tab-page';

/** Rotas da tela "montar times": a aba Times e o campo do admin. Vão dentro do AppShell. */
export const timesRoutes: RouteObject[] = [
  { path: 'times', element: <TeamsTabPage /> },
  { path: 'rodadas/:roundId/times', element: <RoundLineupPage /> },
];
