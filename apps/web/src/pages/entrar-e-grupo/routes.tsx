import type { RouteObject } from 'react-router';
import { RequireSession } from '../../features/session/require-session';
import { InvitePage } from './invite-page';
import { ProfilePage } from './profile-page';
import { StartPage } from './start-page';

/** /comecar fica fora da moldura com abas (quem não tem grupo ainda não tem o que navegar). */
export const startRoutes: RouteObject[] = [
  { path: '/convite/:code', element: <InvitePage /> },
  { element: <RequireSession />, children: [{ path: '/comecar', element: <StartPage /> }] },
];

/** /perfil entra dentro do shell, na aba Perfil. */
export const profileRoute: RouteObject = { path: '/perfil', element: <ProfilePage /> };
