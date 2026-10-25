import type { RouteObject } from 'react-router';
import { RoundLineupPage } from './round-lineup-page';

/** Rota do campo do admin (a aba Times, `/times`, entra pela lista de abas no router). Vai dentro do AppShell. */
export const timesRoutes: RouteObject[] = [
  { path: 'rodadas/:roundId/times', element: <RoundLineupPage /> },
];
