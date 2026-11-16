import type { RouteObject } from 'react-router';

/**
 * O pedaço do Feed e das resenhas. Um só `import()` para as rotas e para o preload: cada ponto de `import()`
 * leva no JS inicial a lista de dependências do pedaço, então reaproveitar o loader mantém o custo em uma cópia.
 */
export const loadFeedArea = () => import('./feed-area');

/** Rotas das resenhas, dentro do shell (o Feed `/` entra pela lista de abas no router): uma rota só, com as telas dentro do pedaço. */
export const feedRoutes: RouteObject[] = [
  {
    path: 'resenhas/*',
    lazy: async () => ({ Component: (await loadFeedArea()).PostRoutes }),
  },
];
