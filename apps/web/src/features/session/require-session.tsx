import { Navigate, Outlet } from 'react-router';
import { ErrorState, SkeletonList } from '../../components/ui/states';
import { useSession } from './use-session';

/** Rotas de quem está logado, mas sem a moldura do app (sem abas): sem sessão, vai para /entrar. */
export function RequireSession() {
  const session = useSession();
  if (session.data === null) return <Navigate to="/entrar" replace />;
  if (session.data === undefined) {
    return (
      <div className="mx-auto w-full max-w-content px-4 pt-6">
        {session.errorUpdateCount > 0 ? (
          <ErrorState
            title="Não deu para abrir o app"
            message="Parece que a internet caiu ou o servidor está acordando. Tente de novo em instantes."
            onRetry={() => void session.refetch()}
            retrying={session.isFetching}
          />
        ) : (
          <SkeletonList rows={3} />
        )}
      </div>
    );
  }
  return <Outlet />;
}
