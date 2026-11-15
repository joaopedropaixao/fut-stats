// Padrão de `lazy` (toda tela nova segue este): a página nunca entra por `import` estático nem por `element`;
// entra por `lazy: async () => ({ Component: (await import('./pasta/x-area')).NomeDaPagina })`, onde `x-area.ts`
// reexporta as páginas da mesma área. Todas as rotas de uma área importam o mesmo arquivo, então saem num pedaço
// só (um pedido de rede por área, não por tela); área de uma tela só importa o arquivo da própria tela.
// Pedaço novo: acrescente a linha em `app/preload.ts`.
// Quem carrega: a primeira carga mostra `hydrateFallbackElement`; na troca de tela o AppShell mantém a anterior
// e, passando de 300 ms, mostra o esqueleto; pedaço que sumiu cai no `RouteError`.
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { AppShell } from './app/shell';
import { RouteError } from './app/route-error';
import { RouteFallback } from './app/route-fallback';
import { TABS } from './app/tabs';
import type { Tab } from './components/ui/tab-bar';
import { PlaceholderPage } from './pages/placeholder';
import { profileRoute, startRoutes } from './pages/entrar-e-grupo/routes';
import { rosterRoutes } from './pages/elenco/routes';
import { historyRoutes } from './pages/historico/routes';
import { profileEditRoutes } from './pages/perfil/routes';
import { rankingRoutes } from './pages/ranking/routes';
import { roundsRoutes } from './pages/rounds/routes';
import { timesRoutes } from './pages/times/routes';
import { votingRoutes } from './pages/voting/routes';

/** Página de cada aba (pela rota da aba). Cada tela nova entra com uma linha aqui. */
const TAB_PAGES: Partial<Record<string, RouteObject>> = {
  '/': {
    index: true,
    lazy: async () => ({ Component: (await import('./pages/rounds/home')).HomePage }),
  },
  '/times': {
    path: '/times',
    lazy: async () => ({ Component: (await import('./pages/times/times-area')).TeamsTabPage }),
  },
  '/ranking': {
    path: '/ranking',
    lazy: async () => ({ Component: (await import('./pages/ranking/ranking-area')).RankingPage }),
  },
  '/historico': {
    path: '/historico',
    lazy: async () => ({
      Component: (await import('./pages/historico/historico-area')).HistoryPage,
    }),
  },
  '/perfil': profileRoute,
};

function placeholderRoute(tab: Tab): RouteObject {
  const element = <PlaceholderPage title={tab.label} />;
  return tab.to === '/' ? { index: true, element } : { path: tab.to, element };
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    hydrateFallbackElement: <RouteFallback tabs />,
    children: [
      {
        // Erro de uma tela (pedaço que não veio) aparece no lugar dela, com as abas ainda na tela
        errorElement: <RouteError />,
        children: [
          // Cada aba aponta para a página dela; aba sem página ainda fica no placeholder.
          ...TABS.map((tab) => TAB_PAGES[tab.to] ?? placeholderRoute(tab)),
          ...roundsRoutes,
          ...votingRoutes,
          ...timesRoutes,
          ...historyRoutes,
          ...rankingRoutes,
          ...profileEditRoutes,
          ...rosterRoutes,
        ],
      },
    ],
  },
  ...startRoutes,
  {
    path: '/entrar',
    lazy: async () => ({
      Component: (await import('./pages/entrar-e-grupo/start-area')).SignInPage,
    }),
    hydrateFallbackElement: <RouteFallback />,
    errorElement: <RouteError />,
  },
  // Vitrine dos componentes de base, para comparar com a folha do DS (docs/design/folha).
  // Só em dev: o build de produção nem inclui o código dela.
  ...(import.meta.env.DEV
    ? [
        {
          path: '/dev/entrar',
          lazy: async () => ({
            Component: (await import('./pages/dev/dev-sign-in')).DevSignInPage,
          }),
        },
        {
          path: '/dev/componentes',
          lazy: async () => ({
            Component: (await import('./pages/dev/components-showcase')).ComponentsShowcasePage,
          }),
        },
      ]
    : []),
  { path: '*', element: <Navigate to="/" replace /> },
]);
