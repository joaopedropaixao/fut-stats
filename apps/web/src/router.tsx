import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from './app/shell';
import { TABS } from './app/tabs';
import { PlaceholderPage } from './pages/placeholder';
import { SignInPage } from './pages/sign-in';

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: TABS.map((tab) =>
      tab.to === '/'
        ? { index: true, element: <PlaceholderPage title={tab.label} /> }
        : { path: tab.to, element: <PlaceholderPage title={tab.label} /> },
    ),
  },
  { path: '/entrar', element: <SignInPage /> },
  // Vitrine dos componentes de base, para comparar com a folha do DS (docs/design/folha).
  // Só em dev: o build de produção nem inclui o código dela.
  ...(import.meta.env.DEV
    ? [
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
