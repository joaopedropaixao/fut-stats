import type { RouteObject } from 'react-router';

/** `/perfil/editar` (a `/perfil` é a aba, ligada em `entrar-e-grupo/routes.tsx`). Dentro do AppShell. */
export const profileEditRoutes: RouteObject[] = [
  {
    path: 'perfil/editar',
    lazy: async () => ({ Component: (await import('./perfil-area')).EditProfilePage }),
  },
];
