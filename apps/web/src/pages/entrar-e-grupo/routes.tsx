import type { RouteObject } from 'react-router';
import { RouteError } from '../../app/route-error';
import { RouteFallback } from '../../app/route-fallback';
import { RequireSession } from '../../features/session/require-session';

/** /comecar fica fora da moldura com abas (quem não tem grupo ainda não tem o que navegar). */
export const startRoutes: RouteObject[] = [
  {
    path: '/convite/:code',
    lazy: async () => ({ Component: (await import('./start-area')).InvitePage }),
    hydrateFallbackElement: <RouteFallback />,
    errorElement: <RouteError />,
  },
  {
    element: <RequireSession />,
    hydrateFallbackElement: <RouteFallback />,
    errorElement: <RouteError />,
    children: [
      {
        path: '/comecar',
        lazy: async () => ({ Component: (await import('./start-area')).StartPage }),
      },
    ],
  },
];

/** /perfil entra dentro do shell, na aba Perfil. */
export const profileRoute: RouteObject = {
  path: '/perfil',
  lazy: async () => ({ Component: (await import('./profile-page')).ProfilePage }),
};
