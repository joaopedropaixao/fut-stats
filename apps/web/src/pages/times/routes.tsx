import type { RouteObject } from 'react-router';

/** Rota do campo do admin (a aba Times, `/times`, entra pela lista de abas no router). Vai dentro do AppShell. */
export const timesRoutes: RouteObject[] = [
  {
    path: 'rodadas/:roundId/times',
    lazy: async () => ({ Component: (await import('./times-area')).RoundLineupPage }),
  },
];
