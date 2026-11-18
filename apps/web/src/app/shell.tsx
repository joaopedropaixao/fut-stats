import { useEffect, useRef, type ReactNode, type Ref } from 'react';
import { Navigate, Outlet, useLocation, useNavigation } from 'react-router';
import { ErrorState, SkeletonList } from '../components/ui/states';
import { TabBar } from '../components/ui/tab-bar';
import { peekPendingDestination } from '../features/group/invite-code';
import { LiveRoundsMount } from '../features/live/live-rounds-mount';
import { useSession } from '../features/session/use-session';
import { TABS } from './tabs';
import { useDelayedFlag } from './use-delayed-flag';

/** Se o pedaço da tela demorar mais que isso, a tela anterior sai e entra o esqueleto. */
const SLOW_NAVIGATION_MS = 300;

/** Moldura do app logado: conteúdo no meio e a barra de abas flutuando embaixo. Sem sessão, vai para /entrar. */
export function AppShell() {
  const session = useSession();
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const isMatchRoute = /^\/rodadas\/[^/]+\/jogo$/.test(pathname);
  const firstRender = useRef(true);
  // Trocou de tela e o pedaço dela ainda está vindo: a tela anterior fica; passou de 300 ms, entra o esqueleto
  const loadingScreen = useDelayedFlag(useNavigation().state === 'loading', SLOW_NAVIGATION_MS);

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
    <ShellFrame mainRef={mainRef} showTabs={ready} isMatchRoute={isMatchRoute}>
      {!ready && !failed && <SkeletonList rows={3} />}
      {!ready && failed && (
        <ErrorState
          title="Não deu para abrir o app"
          message="Parece que a internet caiu ou o servidor está acordando. Tente de novo em instantes."
          onRetry={() => void session.refetch()}
          retrying={session.isFetching}
        />
      )}
      {ready && (loadingScreen ? <SkeletonList rows={3} /> : <Outlet />)}
      {ready && <LiveRoundsMount />}
    </ShellFrame>
  );
}

/** A moldura do app logado: conteúdo no meio e, quando `showTabs`, a barra de abas flutuando embaixo. */
export function ShellFrame({
  children,
  mainRef,
  showTabs,
  isMatchRoute = false,
}: {
  children: ReactNode;
  mainRef?: Ref<HTMLElement>;
  showTabs: boolean;
  isMatchRoute?: boolean;
}) {
  return (
    <div
      className={`mx-auto flex max-w-content flex-col px-4 pt-6 ${
        isMatchRoute
          ? 'h-dvh overflow-hidden pb-[calc(76px+env(safe-area-inset-bottom))]'
          : 'min-h-dvh pb-[calc(96px+env(safe-area-inset-bottom))]'
      }`}
    >
      <main
        ref={mainRef}
        className={`flex flex-1 flex-col gap-6 ${
          isMatchRoute ? 'min-h-0 overflow-y-auto overscroll-contain pb-4' : ''
        }`}
      >
        {children}
      </main>
      {showTabs && (
        <div className="fixed inset-x-0 bottom-0 z-(--z-nav) px-2 pb-[max(8px,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-mobile">
            <TabBar tabs={TABS} />
          </div>
        </div>
      )}
    </div>
  );
}
