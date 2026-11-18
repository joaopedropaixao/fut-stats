import type { FeedAlert, PlayerAvatar } from '@fut-stats/shared';
import { Button } from '../../components/ui/button';
import { PixelText } from '../../components/ui/pixel-text';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/states';
import { AlertCard } from '../../features/feed/alert-card';
import { AlertLine } from '../../features/feed/alert-line';
import { splitAlerts } from '../../features/feed/alert-text';
import { PostCard } from '../../features/feed/post-card';
import { useAlerts, usePosts } from '../../features/feed/queries';
import { useFlashNotice } from '../../features/group/flash';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { DeviceLines } from '../../features/pwa/device-lines';
import { RouteButton } from '../../features/rounds/route-button';
import { hasOpenedResult } from '../../features/voting/result-opened';

type Me = { membershipId: string; avatar: PlayerAvatar };

/** Feed (aba `/`): os avisos do que está rolando e, embaixo, as resenhas dos admins. Sem grupo, o shell manda para /comecar. */
export function FeedPage() {
  const { group } = useCurrentGroup();
  if (!group) return null;
  return (
    <Feed
      groupId={group.id}
      isAdmin={group.role === 'ADMIN'}
      me={{ membershipId: group.membershipId, avatar: group.avatar }}
    />
  );
}

function Feed({ groupId, isAdmin, me }: { groupId: string; isAdmin: boolean; me: Me }) {
  // O aviso que veio da tela de escrever ("Resenha publicada") aparece aqui, uma vez
  const notice = useFlashNotice();
  return (
    <>
      <title>Feed · Fut Stats</title>
      <PixelText as="h1" size={24} wrap className="outline-none">
        Feed
      </PixelText>
      <Alerts groupId={groupId} isAdmin={isAdmin} me={me} />
      <RouteButton to="/rodadas" label="Todas as rodadas" variant="outline" size={48} block />
      <Posts groupId={groupId} isAdmin={isAdmin} notify={notice.show} />
      {notice.node}
    </>
  );
}

/**
 * O aviso grande e as linhas. A API manda o resultado dentro dos 7 dias; o "já abri o pacote" é por aparelho: o
 * resultado aberto vira linha e o aviso seguinte sobe para o card grande.
 */
function Alerts({ groupId, isAdmin, me }: { groupId: string; isAdmin: boolean; me: Me }) {
  const alerts = useAlerts(groupId);

  if (alerts.isError)
    return (
      <ErrorState
        title="Não deu para carregar os avisos"
        message="Confira a internet e tente de novo."
        onRetry={() => void alerts.refetch()}
        retrying={alerts.isFetching}
      />
    );
  if (!alerts.data) return <SkeletonList rows={3} label="Carregando os avisos" />;

  const opened = (a: FeedAlert) =>
    a.type === 'RESULT' && hasOpenedResult(a.roundId, me.membershipId);
  const { big, lines, empty } = splitAlerts(alerts.data, opened);

  return (
    <div className="flex flex-col gap-4">
      {/* Sem aviso grande (nada, ou só resultados já abertos): o vazio, com as linhas que sobraram abaixo */}
      {empty && (
        <>
          <EmptyState
            title="Nenhuma rodada marcada"
            message={
              isAdmin
                ? 'Marque o dia e o local para o grupo confirmar presença.'
                : 'Quando o admin marcar a próxima, ela aparece aqui.'
            }
          />
          {isAdmin && <RouteButton to="/rodadas/nova" label="Criar rodada" icon="plus" block />}
        </>
      )}
      {big && (
        <AlertCard key={`${big.type}:${big.roundId}`} groupId={groupId} alert={big} me={me} />
      )}
      {lines.length > 0 && (
        <ul aria-label="Outros avisos" className="flex flex-col gap-3">
          {lines.map((alert, i) => (
            <li key={alert.type}>
              <AlertLine alert={alert} resultOpened={opened(alert)} index={i + 1} />
            </li>
          ))}
        </ul>
      )}
      {/* Do aparelho, não da pelada: sempre depois dos avisos de rodada e fora da prioridade deles */}
      <DeviceLines firstIndex={lines.length + 1} />
    </div>
  );
}

function Posts({
  groupId,
  isAdmin,
  notify,
}: {
  groupId: string;
  isAdmin: boolean;
  notify: ReturnType<typeof useFlashNotice>['show'];
}) {
  const posts = usePosts(groupId);
  const items = posts.data?.pages.flatMap((page) => page.items) ?? [];
  // Sem resenha, a tecla "Nova resenha" fica no vazio, no lugar da do cabeçalho
  const empty = posts.data !== undefined && items.length === 0;

  return (
    <section aria-labelledby="resenhas" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PixelText as="h2" id="resenhas" size={24}>
          Resenhas
        </PixelText>
        {isAdmin && !empty && (
          <RouteButton
            to="/resenhas/nova"
            label="Nova resenha"
            icon="plus"
            variant="outline"
            size={44}
          />
        )}
      </div>
      {posts.isError && !posts.data ? (
        <ErrorState
          title="Não deu para carregar as resenhas"
          message="Confira a internet e tente de novo."
          onRetry={() => void posts.refetch()}
          retrying={posts.isFetching}
        />
      ) : !posts.data ? (
        <SkeletonList rows={2} label="Carregando as resenhas" />
      ) : items.length === 0 ? (
        <div className="flex flex-col gap-4">
          <EmptyState
            title="Nenhuma resenha ainda"
            message={
              isAdmin
                ? 'Conte como foi a última pelada.'
                : 'Quando um admin escrever, a resenha aparece aqui.'
            }
          />
          {isAdmin && (
            <RouteButton
              to="/resenhas/nova"
              label="Nova resenha"
              icon="plus"
              variant="outline"
              size={48}
              block
            />
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-6">
            {items.map((post, i) => (
              <PostCard key={post.id} groupId={groupId} post={post} index={i} notify={notify} />
            ))}
          </div>
          {posts.isFetchNextPageError && (
            <ErrorState
              title="Não deu para carregar mais"
              message="Confira a internet e tente de novo."
              onRetry={() => void posts.fetchNextPage()}
              retrying={posts.isFetchingNextPage}
            />
          )}
          {posts.hasNextPage && (
            <Button
              label="Carregar mais"
              variant="outline"
              size={48}
              block
              loading={posts.isFetchingNextPage}
              onClick={() => void posts.fetchNextPage()}
            />
          )}
        </>
      )}
    </section>
  );
}
