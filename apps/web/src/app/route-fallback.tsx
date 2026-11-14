import { SkeletonList } from '../components/ui/states';
import { ShellFrame } from './shell';

/**
 * Esqueleto da primeira carga (o pedaço da tela ainda vem da rede).
 * Com `tabs` (as rotas do AppShell): dentro da moldura do app, com a barra de abas.
 * Sem `tabs` (entrar, convite e começar, que não têm abas): só o esqueleto, no mesmo espaçamento do RequireSession.
 */
export function RouteFallback({ tabs = false }: { tabs?: boolean }) {
  if (tabs) {
    return (
      <ShellFrame showTabs>
        <SkeletonList rows={3} />
      </ShellFrame>
    );
  }
  return (
    <div className="mx-auto w-full max-w-content px-4 pt-6">
      <SkeletonList rows={3} />
    </div>
  );
}
