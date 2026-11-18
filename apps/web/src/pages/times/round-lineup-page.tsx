import { type Lineup } from '@fut-stats/shared';
import { useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { Sheet } from '../../components/ui/sheet';
import { ErrorState, SkeletonList } from '../../components/ui/states';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { LineupBuilder } from '../../features/lineup/lineup-builder';
import { PublishedTeams } from '../../features/lineup/published-teams';
import { useLineup, useUnpublishLineup } from '../../features/lineup/queries';
import { RoundHeading } from '../../features/lineup/round-heading';
import { useRound } from '../../features/rounds/queries';
import { RouteButton } from '../../features/rounds/route-button';
import { ApiError, apiErrorMessage } from '../../lib/api';

/** /rodadas/:roundId/times: o admin monta Branco x Preto e publica. Jogador vai para a aba Times. */
export function RoundLineupPage() {
  const { roundId } = useParams();
  const { group } = useCurrentGroup();
  if (!group) return null;
  if (group.role !== 'ADMIN') return <Navigate to="/times" replace />;
  return <Content groupId={group.id} roundId={roundId} />;
}

function Content({ groupId, roundId }: { groupId: string; roundId: string | undefined }) {
  const round = useRound(groupId, roundId);
  const lineup = useLineup(groupId, roundId);
  const error = round.error ?? lineup.error;

  return (
    <>
      <RouteButton
        to={roundId ? `/rodadas/${roundId}` : '/rodadas'}
        label="Rodada"
        icon="chevronLeft"
        variant="outline"
        size={44}
        className="self-start"
      />
      <RoundHeading title="Montar times" round={round.data} />
      {round.isError || lineup.isError ? (
        error instanceof ApiError && error.status === 404 ? (
          <ErrorState
            title="Rodada não encontrada"
            message="Essa rodada não existe neste grupo. Confira o link ou volte para as rodadas."
          />
        ) : (
          <ErrorState
            title="Não deu para abrir os times"
            message="Confira a internet e tente de novo."
            onRetry={() => {
              void round.refetch();
              void lineup.refetch();
            }}
            retrying={round.isFetching || lineup.isFetching}
          />
        )
      ) : !round.data || !lineup.data ? (
        <SkeletonList rows={3} label="Carregando os times" />
      ) : lineup.data.permissions.edit ? (
        <LineupBuilder groupId={groupId} roundId={round.data.id} lineup={lineup.data} />
      ) : (
        <Published groupId={groupId} roundId={round.data.id} lineup={lineup.data} />
      )}
    </>
  );
}

function Published({
  groupId,
  roundId,
  lineup,
}: {
  groupId: string;
  roundId: string;
  lineup: Lineup;
}) {
  const unpublish = useUnpublishLineup(groupId, roundId);
  const [undoing, setUndoing] = useState(false);
  const canUnpublish = lineup.permissions.unpublish;

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
              : 'A rodada já passou da etapa dos times: eles não mudam mais.'}
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
        <Sheet
          title="Despublicar os times?"
          onClose={() => setUndoing(false)}
          actions={
            <>
              <Button
                variant="outline"
                size={52}
                label="Voltar"
                className="flex-1"
                onClick={() => setUndoing(false)}
              />
              <Button
                variant="danger"
                size={52}
                icon="x"
                label="Despublicar"
                className="flex-1"
                loading={unpublish.isPending}
                onClick={() => unpublish.mutate(undefined, { onSuccess: () => setUndoing(false) })}
              />
            </>
          }
        >
          <p>
            O grupo deixa de ver os times e você volta a montar. O que já está escalado continua
            salvo.
          </p>
          {unpublish.isError && (
            <div className="pt-3">
              <ErrorState
                title="Não despublicou"
                message={apiErrorMessage(unpublish.error, 'Falha de conexão. Tente de novo.')}
              />
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}
