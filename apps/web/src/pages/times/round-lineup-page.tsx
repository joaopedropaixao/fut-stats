import { ROUND_STATUS_LABELS, type Lineup, type RoundDetail } from '@fut-stats/shared';
import { useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { ErrorState, SkeletonList } from '../../components/ui/states';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { ConfirmSheet } from '../../features/lineup/confirm-sheet';
import { LineupBuilder } from '../../features/lineup/lineup-builder';
import { NoGroup } from '../../features/lineup/no-group';
import { PublishedTeams } from '../../features/lineup/published-teams';
import {
  errorMessage,
  useLineup,
  useRoundDetail,
  useUnpublishLineup,
} from '../../features/lineup/queries';
import { RoundHeading } from '../../features/lineup/round-heading';
import { ApiError } from '../../lib/api';

/** /rodadas/:roundId/times: o admin monta Branco x Preto e publica. */
export function RoundLineupPage() {
  const { roundId = '' } = useParams();
  // O AppShell só mostra a tela com a sessão carregada: sem grupo aqui é estar fora de qualquer pelada
  const { group } = useCurrentGroup();
  if (!group) {
    return (
      <>
        <RoundHeading title="Montar times" />
        <NoGroup />
      </>
    );
  }
  if (group.role !== 'ADMIN') return <Navigate to="/times" replace />;
  return <Content groupId={group.id} roundId={roundId} />;
}

function Content({ groupId, roundId }: { groupId: string; roundId: string }) {
  const round = useRoundDetail(groupId, roundId);
  const lineup = useLineup(groupId, roundId);
  const heading = <RoundHeading title="Montar times" round={round.data} />;

  if (round.isError || lineup.isError) {
    const notFound = [round.error, lineup.error].some(
      (e) => e instanceof ApiError && e.status === 404,
    );
    return (
      <>
        {heading}
        <ErrorState
          title={notFound ? 'Rodada não encontrada' : 'Não deu para abrir os times'}
          message={
            notFound
              ? 'Essa rodada não existe neste grupo. Confira o link ou volte para a aba Times.'
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
        {heading}
        <SkeletonList rows={3} label="Carregando os times" />
      </>
    );

  return (
    <>
      {heading}
      {lineup.data.published ? (
        <Published groupId={groupId} roundId={roundId} round={round.data} lineup={lineup.data} />
      ) : (
        <LineupBuilder groupId={groupId} roundId={roundId} lineup={lineup.data} />
      )}
    </>
  );
}

function Published({
  groupId,
  roundId,
  round,
  lineup,
}: {
  groupId: string;
  roundId: string;
  round: RoundDetail;
  lineup: Lineup;
}) {
  const unpublish = useUnpublishLineup(groupId, roundId);
  const [undoing, setUndoing] = useState(false);
  const canUnpublish = round.status === 'TEAMS_PUBLISHED';

  return (
    <>
      <div className="flex gap-3 bg-surface p-4 shadow-card" role="status">
        <span
          aria-hidden
          className={
            canUnpublish
              ? 'inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-[#04210f]'
              : 'inline-flex size-6 shrink-0 items-center justify-center text-text-muted'
          }
        >
          <Icon
            name={canUnpublish ? 'check' : 'lock'}
            size={canUnpublish ? 14 : 18}
            strokeWidth={3}
          />
        </span>
        <div className="flex flex-col gap-1">
          <PixelText>{canUnpublish ? 'Times publicados' : 'Times fechados'}</PixelText>
          <p className="text-sm text-text-muted">
            {canUnpublish
              ? 'Todo o grupo já vê Branco x Preto. Para mexer, despublique antes.'
              : `A rodada está em "${ROUND_STATUS_LABELS[round.status]}": os times não mudam mais.`}
          </p>
        </div>
      </div>
      <PublishedTeams lineup={lineup} />
      {canUnpublish && (
        <Button
          variant="outline"
          size={52}
          icon="redo"
          label="Despublicar para refazer"
          block
          onClick={() => {
            unpublish.reset();
            setUndoing(true);
          }}
        />
      )}
      {undoing && (
        <ConfirmSheet
          title="Despublicar os times?"
          message="O grupo deixa de ver os times e você volta a montar. O que já está escalado continua salvo."
          notice={
            unpublish.isError && (
              <ErrorState title="Não despublicou" message={errorMessage(unpublish.error)} />
            )
          }
          onClose={() => setUndoing(false)}
        >
          <Button variant="outline" size={52} label="Voltar" onClick={() => setUndoing(false)} />
          <Button
            variant="danger"
            size={52}
            icon="x"
            label="Despublicar"
            loading={unpublish.isPending}
            onClick={() => unpublish.mutate(undefined, { onSuccess: () => setUndoing(false) })}
          />
        </ConfirmSheet>
      )}
    </>
  );
}
