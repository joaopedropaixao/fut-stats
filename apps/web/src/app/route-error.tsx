import { useEffect } from 'react';
import { useRouteError } from 'react-router';
import { ErrorState, SkeletonList } from '../components/ui/states';
import { isChunkLoadError, isReloading, reloadOnce } from './chunk-reload';
import { ErrorScreen } from './error-screen';
import { reportError } from './monitoring';

/**
 * Erro de rota.
 * - Pedaço que sumiu (deploy novo com a aba aberta): recarrega uma vez e abre a tela; se falhar de novo, mostra o
 *   erro com "Tentar de novo" (que recarrega sem apagar a marca, então nunca vira laço). Não vai para o Sentry.
 * - Qualquer outro erro: a tela de erro geral, e o erro vai para o Sentry. Por padrão ocupa a janela inteira (rotas
 *   fora do AppShell); com `embedded` (rotas dentro do AppShell) fica no lugar da tela, com as abas embaixo.
 */
export function RouteError({ embedded = false }: { embedded?: boolean }) {
  const error = useRouteError();
  const missingChunk = isChunkLoadError(error);
  // Fica `true` enquanto a página está sendo recarregada (primeira falha)
  const reloading = missingChunk && (isReloading() || reloadOnce());

  useEffect(() => {
    if (missingChunk) return;
    console.error(error);
    reportError(error, { source: 'route' });
  }, [error, missingChunk]);

  if (reloading) return <SkeletonList rows={3} />;

  if (!missingChunk) return <ErrorScreen embedded={embedded} />;

  return (
    <ErrorState
      title="Não deu para abrir esta tela"
      message="O app foi atualizado ou a internet caiu. Tente de novo em instantes."
      onRetry={() => window.location.reload()}
    />
  );
}
