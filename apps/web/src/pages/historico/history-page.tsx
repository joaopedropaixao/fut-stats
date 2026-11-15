import { INVALID_CURSOR_LABEL, type PlayerAvatar } from '@fut-stats/shared';
import { Button } from '../../components/ui/button';
import { PixelText } from '../../components/ui/pixel-text';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/states';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { MatchCard } from '../../features/history/match-card';
import { useHistory } from '../../features/history/queries';
import { ApiError } from '../../lib/api';
import { DEFAULT_AVATAR } from '../../lib/avatar';

/** /historico: as partidas que já terminaram, da mais recente para a mais antiga, 20 por vez. */
export function HistoryPage() {
  const { group } = useCurrentGroup();
  if (!group) return null;
  return <History groupId={group.id} avatar={group.avatar ?? DEFAULT_AVATAR} />;
}

function History({ groupId, avatar }: { groupId: string; avatar: PlayerAvatar }) {
  const history = useHistory(groupId);
  const items = history.data?.pages.flatMap((page) => page.items);
  // Erro ao pedir a próxima página não derruba as que já estão na tela
  const nextFailed = history.isFetchNextPageError;

  return (
    <>
      <title>Histórico · Fut Stats</title>
      <PixelText as="h1" size={24} wrap className="outline-none">
        Histórico
      </PixelText>
      {history.isError && !items ? (
        <ErrorState
          title="Não deu para carregar o histórico"
          message="Confira a internet e tente de novo."
          onRetry={() => void history.refetch()}
          retrying={history.isFetching}
        />
      ) : !items ? (
        <SkeletonList rows={4} label="Carregando o histórico" />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nenhuma partida ainda"
          message="Quando a primeira pelada terminar, o placar aparece aqui."
        />
      ) : (
        <>
          <ul className="flex flex-col gap-6">
            {items.map((item, index) => (
              <li key={item.roundId}>
                <MatchCard item={item} avatar={avatar} index={index} />
              </li>
            ))}
          </ul>
          {nextFailed && (
            <ErrorState
              title="Não deu para carregar mais"
              message={
                history.error instanceof ApiError && history.error.body?.code === 'INVALID_CURSOR'
                  ? INVALID_CURSOR_LABEL
                  : 'Confira a internet e tente de novo.'
              }
              onRetry={() => void history.fetchNextPage()}
              retrying={history.isFetchingNextPage}
            />
          )}
          {history.hasNextPage && !nextFailed && (
            <Button
              label="Carregar mais"
              variant="outline"
              size={52}
              block
              loading={history.isFetchingNextPage}
              onClick={() => void history.fetchNextPage()}
            />
          )}
        </>
      )}
    </>
  );
}
