import { Navigate, Outlet } from 'react-router';
import { QueryServerWait } from '../../app/server-wait';
import { SkeletonList } from '../../components/ui/states';
import { sessionQueryKey, useSession } from './use-session';

/**
 * Rotas de quem está logado, mas sem a moldura do app (sem abas): sem sessão, vai para /entrar. Enquanto o /me não
 * volta, a mesma espera do AppShell (esqueleto, "Servidor iniciando" e o erro com "Tentar de novo").
 */
export function RequireSession() {
  const session = useSession();
  if (session.data === null) return <Navigate to="/entrar" replace />;
  if (session.data === undefined) {
    return (
      <QueryServerWait
        query={session}
        queryKey={sessionQueryKey}
        skeleton={
          <div className="mx-auto w-full max-w-content px-4 pt-6">
            <SkeletonList rows={3} />
          </div>
        }
      />
    );
  }
  return <Outlet />;
}
