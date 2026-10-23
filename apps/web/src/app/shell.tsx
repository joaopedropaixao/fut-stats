import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { ErrorState, SkeletonList } from '../components/ui/states';
import { TabBar } from '../components/ui/tab-bar';
import { peekPendingDestination } from '../features/group/invite-code';
import { useSession } from '../features/session/use-session';
import { TABS } from './tabs';

/** Moldura do app logado: conteúdo no meio e a barra de abas flutuando embaixo. Sem sessão, vai para /entrar. */
export function AppShell() {
  const session = useSession();
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const firstRender = useRef(true);

  // Trocou de aba: o foco vai para o título da tela, para o leitor de tela anunciar onde a pessoa está
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const heading = mainRef.current?.querySelector('h1');
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus();
  }, [pathname]);

  if (session.data === null) return <Navigate to="/entrar" replace />;

  // Voltou do Google com um convite guardado: retoma o convite
  const pending = session.data ? peekPendingDestination() : null;
  if (pending) return <Navigate to={pending} replace />;
  // Logado e sem pelada: o início é criar uma ou entrar por convite
  if (session.data && session.data.groups.length === 0) return <Navigate to="/comecar" replace />;

  // Com sessão em cache, um erro numa atualização em segundo plano não derruba a tela
  const ready = session.data !== undefined;
  // Depois de falhar uma vez, o erro fica na tela durante o "Tentar de novo" (o TanStack volta o status
  // para pending ao refazer uma consulta sem dado; trocar pelo esqueleto tiraria o foco do botão)
  const failed = session.errorUpdateCount > 0;

  return (
    <div className="mx-auto flex min-h-dvh max-w-content flex-col px-4 pt-6 pb-[calc(96px+env(safe-area-inset-bottom))]">
      <main ref={mainRef} className="flex flex-1 flex-col gap-6">
        {!ready && !failed && <SkeletonList rows={3} />}
        {!ready && failed && (
          <ErrorState
            title="Não deu para abrir o app"
            message="Parece que a internet caiu ou o servidor está acordando. Tente de novo em instantes."
            onRetry={() => void session.refetch()}
            retrying={session.isFetching}
          />
        )}
        {ready && <Outlet />}
      </main>
      {ready && (
        <div className="fixed inset-x-0 bottom-0 z-(--z-nav) px-2 pb-[max(8px,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-mobile">
            <TabBar tabs={TABS} />
          </div>
        </div>
      )}
    </div>
  );
}
