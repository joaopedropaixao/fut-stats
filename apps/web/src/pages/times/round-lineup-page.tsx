import { ROUND_STATUS_LABELS } from '@fut-stats/shared';
import { useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { PixelText } from '../../components/ui/pixel-text';
import { ErrorState, SkeletonList } from '../../components/ui/states';
import { ConfirmSheet } from '../../features/lineup/confirm-sheet';
import { formatRoundDate } from '../../features/lineup/format-round-date';
import { LineupBuilder } from '../../features/lineup/lineup-builder';
import { PublishedTeams } from '../../features/lineup/published-teams';
import {
  errorMessage,
  useLineup,
  useRoundDetail,
  useUnpublishLineup,
} from '../../features/lineup/queries';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { ApiError } from '../../lib/api';

/** /rodadas/:roundId/times: o admin monta Branco x Preto e publica. */
export function RoundLineupPage() {
  const { roundId = '' } = useParams();
  const { group } = useCurrentGroup();
  if (!group) return <SkeletonList rows={2} />;
  if (group.role !== 'ADMIN') return <Navigate to="/times" replace />;
  return <Content groupId={group.id} roundId={roundId} />;
}

function Content({ groupId, roundId }: { groupId: string; roundId: string }) {
  const round = useRoundDetail(groupId, roundId);
  const lineup = useLineup(groupId, roundId);
  const unpublish = useUnpublishLineup(groupId, roundId);
  const [undoing, setUndoing] = useState(false);

  const header = (
    <header className="flex flex-col gap-1">
      <PixelText as="h1" size={24} wrap>
        Montar times
      </PixelText>
      {round.data && (
        <>
          <PixelText className="text-text-muted">
            {formatRoundDate(round.data.scheduledAt)}
          </PixelText>
          {round.data.location && <p className="text-sm text-text-muted">{round.data.location}</p>}
        </>
      )}
      <title>Montar times · Fut Stats</title>
    </header>
  );

  if (round.isError || lineup.isError) {
    const notFound = [round.error, lineup.error].some(
      (e) => e instanceof ApiError && e.status === 404,
    );
    return (
      <>
        {header}
        <ErrorState
          title={notFound ? 'Rodada não encontrada' : 'Não deu para abrir os times'}
          message={
            notFound
              ? 'Essa rodada não existe neste grupo.'
              : 'Parece que a internet caiu ou o servidor está acordando. Tente de novo em instantes.'
          }
          onRetry={
            notFound
              ? undefined
              : () => {
                  void round.refetch();
                  void lineup.refetch();
                }
          }
          retrying={round.isFetching || lineup.isFetching}
        />
      </>
    );
  }
  if (!round.data || !lineup.data)
    return (
      <>
        {header}
        <SkeletonList rows={3} label="Carregando os times" />
      </>
    );

  if (!lineup.data.published) {
    return (
      <>
        {header}
        <LineupBuilder key="draft" groupId={groupId} roundId={roundId} lineup={lineup.data} />
      </>
    );
  }

  const canUnpublish = round.data.status === 'TEAMS_PUBLISHED';
  return (
    <>
      {header}
      <p className="text-sm text-text-muted">
        {canUnpublish
          ? 'Os times estão publicados e todo o grupo já vê. Para mexer, despublique antes.'
          : `A rodada está em "${ROUND_STATUS_LABELS[round.data.status]}": os times não mudam mais.`}
      </p>
      <PublishedTeams lineup={lineup.data} />
      {canUnpublish && (
        <Button
          variant="outline"
          size={48}
          label="Despublicar para refazer"
          block
          onClick={() => setUndoing(true)}
        />
      )}
      {undoing && (
        <ConfirmSheet
          title="Despublicar os times?"
          message="Os jogadores deixam de ver os times e você volta a montar o rascunho, que fica salvo."
          onClose={() => setUndoing(false)}
        >
          {unpublish.isError && (
            <ErrorState title="Não despublicou" message={errorMessage(unpublish.error)} />
          )}
          <Button
            variant="danger"
            icon="x"
            label="Despublicar"
            block
            loading={unpublish.isPending}
            onClick={() => unpublish.mutate(undefined, { onSuccess: () => setUndoing(false) })}
          />
          <Button variant="outline" label="Voltar" block onClick={() => setUndoing(false)} />
        </ConfirmSheet>
      )}
    </>
  );
}
