import type { RouteObject } from 'react-router';
import { HistoryPage } from './history-page';
import { MatchPage } from './match-page';

/** Rotas da aba Histórico, dentro do AppShell. */
export const historyRoutes: RouteObject[] = [
  { path: 'historico', element: <HistoryPage /> },
  { path: 'historico/:roundId', element: <MatchPage /> },
];
