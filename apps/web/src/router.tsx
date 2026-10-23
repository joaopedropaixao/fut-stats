import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from './app/shell';
import { TABS } from './app/tabs';
import { ComponentsShowcasePage } from './pages/dev/components-showcase';
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
  // Vitrine dos componentes de base, para comparar com a folha do DS (docs/design/folha)
  { path: '/dev/componentes', element: <ComponentsShowcasePage /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
