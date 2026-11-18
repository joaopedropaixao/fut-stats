import { useLocation, useNavigate, useParams } from 'react-router';
import { ErrorState, SkeletonList } from '../../components/ui/states';
import { PixelText } from '../../components/ui/pixel-text';
import { PlayerCard } from '../../features/group/player-card';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { usePlayerProfile } from '../../features/ranking/queries';
import { PlayerStats } from '../../features/ranking/player-stats';
import { RouteButton } from '../../features/rounds/route-button';
import { ApiError } from '../../lib/api';

/** /jogadores/:membershipId: a figurinha de um jogador do grupo, com as estatísticas e as últimas rodadas. Só leitura. */
export function PlayerPage() {
  const { membershipId } = useParams();
  const { group } = useCurrentGroup();
  if (!group) return null;
  return <Player groupId={group.id} myId={group.membershipId} membershipId={membershipId} />;
}

/** Voltar leva ao Ranking; vindo da lista, é um voltar de verdade (a aba escolhida continua na URL). */
function BackToRanking() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromRanking = (location.state as { fromRanking?: boolean } | null)?.fromRanking === true;
  return (
    <RouteButton
      to="/ranking"
      label="Ranking"
      icon="chevronLeft"
      variant="outline"
      size={44}
      className="self-start"
      onClick={(e) => {
        if (!fromRanking) return;
        e.preventDefault();
        void navigate(-1);
      }}
    />
  );
}

function Player({
  groupId,
  myId,
  membershipId,
}: {
  groupId: string;
  myId: string;
  membershipId: string | undefined;
}) {
  const profile = usePlayerProfile(groupId, membershipId);
  const data = profile.data;
  const notFound = profile.error instanceof ApiError && profile.error.status === 404;

  return (
    <>
      <title>{data ? `${data.nickname} · Fut Stats` : 'Jogador · Fut Stats'}</title>
      <BackToRanking />
      {!data && (
        <PixelText as="h1" size={24} wrap className="sr-only">
          Jogador
        </PixelText>
      )}
      {profile.isError && !data ? (
        notFound ? (
          <ErrorState
            title="Jogador não encontrado"
            message="Esse jogador não está neste grupo. Volte para o Ranking e escolha outro."
          />
        ) : (
          <ErrorState
            title="Não deu para abrir o jogador"
            message="Confira a internet e tente de novo."
            onRetry={() => void profile.refetch()}
            retrying={profile.isFetching}
          />
        )
      ) : !data ? (
        <SkeletonList rows={4} label="Carregando o jogador" />
      ) : (
        <>
          <PlayerCard
            nickname={data.nickname}
            avatar={data.avatar}
            position={data.primaryPosition}
            secondaryPositions={data.secondaryPositions}
            isAdmin={data.role === 'ADMIN'}
            mine={data.membershipId === myId}
            heading="h1"
            ranking={{ rank: data.rank, average: data.stats.average }}
          />
          <PlayerStats profile={data} />
        </>
      )}
    </>
  );
}
