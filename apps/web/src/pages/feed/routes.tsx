import type { RouteObject } from 'react-router';

/**
 * Rotas das resenhas, dentro do shell (o Feed `/` entra pela lista de abas no router). Padrão de `lazy`
 * (ver router.tsx): o Feed e o formulário saem no mesmo pedaço (`./feed-area`).
 */
export const feedRoutes: RouteObject[] = [
  {
    path: 'resenhas/nova',
    lazy: async () => ({ Component: (await import('./feed-area')).NewPostPage }),
  },
  {
    path: 'resenhas/:postId/editar',
    lazy: async () => ({ Component: (await import('./feed-area')).EditPostPage }),
  },
];
