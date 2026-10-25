import { ROUND_STATUS_LABELS, type RoundDetail } from '@fut-stats/shared';
import { useParams } from 'react-router';
import { Badge } from '../../components/ui/badge';
import { ErrorState, SkeletonList } from '../../components/ui/states';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { AttendanceLists } from '../../features/rounds/attendance-lists';
import { MyPresence } from '../../features/rounds/my-presence';
import { useRound } from '../../features/rounds/queries';
import { RoundWhen } from '../../features/rounds/round-when';
import { RouteButton } from '../../features/rounds/route-button';
import { usePresence } from '../../features/rounds/use-presence';
import { ApiError } from '../../lib/api';
import { PixelText } from '../../components/ui/pixel-text';

/** Detalhe da rodada: presença, as três listas e o caminho para times e jogo conforme o status. */
export function RoundDetailPage() {
  const { group } = useCurrentGroup();
  const { roundId } = useParams();
  if (!group) return null;
  return <Detail groupId={group.id} isAdmin={group.role === 'ADMIN'} roundId={roundId} />;
}

function Detail({
  groupId,
  isAdmin,
  roundId,
}: {
  groupId: string;
  isAdmin: boolean;
  roundId: string | undefined;
}) {
  const round = useRound(groupId, roundId);

  return (
    <>
      <title>Rodada · Fut Stats</title>
      <RouteButton
        to="/rodadas"
        label="Rodadas"
        icon="chevronLeft"
        variant="outline"
        size={44}
        className="self-start"
      />
      {round.isError ? (
        round.error instanceof ApiError && round.error.status === 404 ? (
          <ErrorState
            title="Rodada não encontrada"
            message="Ela pode ter sido apagada pelo admin."
          />
        ) : (
          <ErrorState
            title="Não deu para carregar a rodada"
            message="Confira a internet e tente de novo."
            onRetry={() => void round.refetch()}
            retrying={round.isFetching}
          />
        )
      ) : !round.data ? (
        <SkeletonList rows={4} label="Carregando a rodada" />
      ) : (
        <Loaded groupId={groupId} isAdmin={isAdmin} round={round.data} />
      )}
    </>
  );
}

/** Para onde seguir depois da presença, conforme o status (as telas são de outras entregas). */
function nextStep(round: RoundDetail, isAdmin: boolean): { to: string; label: string } | null {
  switch (round.status) {
    case 'SCHEDULED':
      return isAdmin ? { to: `/rodadas/${round.id}/times`, label: 'Montar times' } : null;
    case 'TEAMS_PUBLISHED':
      return isAdmin
        ? { to: `/rodadas/${round.id}/jogo`, label: 'Ir para o jogo' }
        : { to: `/rodadas/${round.id}/times`, label: 'Ver times' };
    case 'IN_PROGRESS':
      return { to: `/rodadas/${round.id}/jogo`, label: 'Ir para o jogo' };
    case 'POST_MATCH':
      return { to: `/rodadas/${round.id}/jogo`, label: 'Ir para a Resenha' };
    case 'VOTING':
    case 'CLOSED':
      return { to: `/rodadas/${round.id}/jogo`, label: 'Ver o jogo' };
  }
}

function Loaded({
  groupId,
  isAdmin,
  round,
}: {
  groupId: string;
  isAdmin: boolean;
  round: RoundDetail;
}) {
  const presence = usePresence(groupId, round);
  const step = nextStep(round, isAdmin);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <RoundWhen
          as="h1"
          number={round.number}
          scheduledAt={round.scheduledAt}
          location={round.location}
        />
        <div className="flex items-center gap-2">
          <Badge label={ROUND_STATUS_LABELS[round.status]} />
          <PixelText className="text-text-muted">{`${round.confirmedCount} vão`}</PixelText>
        </div>
      </div>

      <div className="bg-surface-raised p-5 shadow-card">
        <MyPresence
          round={round}
          onChange={(confirmed) => presence.setAttendance(round.myMembershipId, confirmed)}
        />
      </div>

      {step && <RouteButton to={step.to} label={step.label} block />}
      {round.permissions.edit && (
        <RouteButton
          to={`/rodadas/${round.id}/editar`}
          label="Editar rodada"
          icon="pencil"
          variant="outline"
          size={48}
          block
        />
      )}

      <AttendanceLists
        round={round}
        onSet={(membershipId, confirmed, nickname) =>
          presence.setAttendance(membershipId, confirmed, nickname)
        }
      />
      {presence.notice}
    </div>
  );
}
