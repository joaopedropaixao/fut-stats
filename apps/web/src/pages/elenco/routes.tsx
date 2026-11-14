import type { RouteObject } from 'react-router';

/** O Elenco do admin e a edição de um jogador. Dentro do AppShell (a aba Perfil fica acesa). */
export const rosterRoutes: RouteObject[] = [
  {
    path: 'elenco',
    lazy: async () => ({ Component: (await import('./elenco-area')).RosterPage }),
  },
  {
    path: 'elenco/:membershipId',
    lazy: async () => ({ Component: (await import('./elenco-area')).EditMemberPage }),
  },
];
