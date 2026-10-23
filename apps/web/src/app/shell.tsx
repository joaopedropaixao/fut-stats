import { Navigate, Outlet } from 'react-router';
import { ErrorState, SkeletonList } from '../components/ui/states';
import { TabBar } from '../components/ui/tab-bar';
import { useSession } from '../features/session/use-session';
import { TABS } from './tabs';

/** Moldura do app logado: conteúdo no meio e a barra de abas flutuando embaixo. Sem sessão, vai para /entrar. */
export function AppShell() {
  const session = useSession();

  if (session.isSuccess && session.data === null) return <Navigate to="/entrar" replace />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-content flex-col px-4 pt-6 pb-[calc(96px+env(safe-area-inset-bottom))]">
      <main className="flex flex-1 flex-col gap-6">
        {session.isPending && <SkeletonList rows={3} />}
        {session.isError && (
          <ErrorState
            title="Não deu para entrar no app"
            message="Parece que a internet caiu ou o servidor está acordando. Tente de novo em instantes."
            onRetry={() => void session.refetch()}
            retrying={session.isFetching}
          />
        )}
        {session.isSuccess && <Outlet />}
      </main>
      {session.isSuccess && (
        <div className="fixed inset-x-0 bottom-0 z-(--z-nav) px-2 pb-[max(8px,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-mobile">
            <TabBar tabs={TABS} />
          </div>
        </div>
      )}
    </div>
  );
}
