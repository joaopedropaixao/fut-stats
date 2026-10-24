import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { AppShell } from './app/shell';
import { TABS } from './app/tabs';
import type { Tab } from './components/ui/tab-bar';
import { PlaceholderPage } from './pages/placeholder';
import { profileRoute, startRoutes } from './pages/entrar-e-grupo/routes';
import { HomePage } from './pages/rounds/home';
import { roundsRoutes } from './pages/rounds/routes';
import { SignInPage } from './pages/sign-in';

/** Página de cada aba (pela rota da aba). Cada tela nova entra com uma linha aqui. */
const TAB_PAGES: Partial<Record<string, RouteObject>> = {
  '/': { index: true, element: <HomePage /> },
  '/perfil': profileRoute,
};

function placeholderRoute(tab: Tab): RouteObject {
  const element = <PlaceholderPage title={tab.label} />;
  return tab.to === '/' ? { index: true, element } : { path: tab.to, element };
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      // Cada aba aponta para a página dela; aba sem página ainda fica no placeholder.
      ...TABS.map((tab) => TAB_PAGES[tab.to] ?? placeholderRoute(tab)),
      ...roundsRoutes,
    ],
  },
  ...startRoutes,
  { path: '/entrar', element: <SignInPage /> },
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
