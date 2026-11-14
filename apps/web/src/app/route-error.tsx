import { useEffect } from 'react';
import { useRouteError } from 'react-router';
import { ErrorState, SkeletonList } from '../components/ui/states';
import { isChunkLoadError, isReloading, reloadOnce } from './chunk-reload';

/**
 * Erro de rota. Pedaço que sumiu (deploy novo com a aba aberta): recarrega uma vez e abre a tela; se falhar de
 * novo, mostra o erro com "Tentar de novo" (que recarrega sem apagar a marca, então nunca vira laço).
 */
export function RouteError() {
  const error = useRouteError();
  const missingChunk = isChunkLoadError(error);
  // Fica `true` enquanto a página está sendo recarregada (primeira falha)
  const reloading = missingChunk && (isReloading() || reloadOnce());

  useEffect(() => {
    if (!missingChunk) console.error(error);
  }, [error, missingChunk]);

  if (reloading) return <SkeletonList rows={3} />;

  return (
    <ErrorState
      title="Não deu para abrir esta tela"
      message={
        missingChunk
          ? 'O app foi atualizado ou a internet caiu. Tente de novo em instantes.'
          : 'Algo deu errado por aqui. Tente de novo em instantes.'
      }
      onRetry={() => window.location.reload()}
    />
  );
}
