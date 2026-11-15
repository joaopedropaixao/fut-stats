import { VOTING_END_REASON_LABELS, VOTING_ERROR_LABELS, type RoundResult } from '@fut-stats/shared';
import { useEffect } from 'react';
import { useParams } from 'react-router';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/states';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { RoundHeading } from '../../features/lineup/round-heading';
import { Scoreboard } from '../../features/match/scoreboard';
import { RouteButton } from '../../features/rounds/route-button';
import { ApiError } from '../../lib/api';
import { CraqueCard } from '../../features/voting/craque-card';
import { FlopCard } from '../../features/voting/flop-card';
import { MyScoreCard } from '../../features/voting/my-score-card';
import { useResult } from '../../features/voting/queries';
import { markResultOpened } from '../../features/voting/result-opened';
import { ResultTable } from '../../features/voting/result-table';

/** /rodadas/:roundId/resultado: a carta do Craque, o Perna de Pau, a minha nota e a tabela da rodada. */
export function ResultPage() {
  const { roundId } = useParams();
  const { group } = useCurrentGroup();
  if (!group) return null;
  return <Content groupId={group.id} roundId={roundId} />;
}

function Content({ groupId, roundId }: { groupId: string; roundId: string | undefined }) {
  const result = useResult(groupId, roundId);
  const data = result.data;

  return (
    <>
      <RouteButton
        to="/"
        label="Início"
        icon="chevronLeft"
        variant="outline"
        size={44}
        className="self-start"
      />
      <RoundHeading
        title="Resultado"
        round={data && { number: data.number, scheduledAt: data.scheduledAt, location: null }}
      />
      {result.isError && !data ? (
        <Failure
          roundId={roundId}
          error={result.error}
          onRetry={() => void result.refetch()}
          retrying={result.isFetching}
        />
      ) : !data ? (
        <SkeletonList rows={4} label="Carregando o resultado" />
      ) : (
        <Loaded result={data} />
      )}
    </>
  );
}

function Failure({
  roundId,
  error,
  onRetry,
  retrying,
}: {
  roundId: string | undefined;
  error: Error | null;
  onRetry: () => void;
  retrying: boolean;
}) {
  if (error instanceof ApiError && error.status === 404) {
    return (
      <ErrorState
        title="Rodada não encontrada"
        message="Essa rodada não existe neste grupo. Confira o link ou volte para o início."
      />
    );
  }
  if (error instanceof ApiError && error.body?.code === 'RESULT_NOT_READY') {
    return (
      <div className="flex flex-col gap-3">
        <EmptyState
          title={VOTING_ERROR_LABELS.RESULT_NOT_READY}
          message="O resultado sai quando a votação fechar."
        />
        {roundId && (
          <RouteButton to={`/rodadas/${roundId}/votar`} label="Ir para a votação" block />
        )}
      </div>
    );
  }
  return (
    <ErrorState
      title="Não deu para abrir o resultado"
      message="Confira a internet e tente de novo."
      onRetry={onRetry}
      retrying={retrying}
    />
  );
}

function Loaded({ result }: { result: RoundResult }) {
  const { roundId } = result;
  const myId = result.me.membershipId;
  // Abriu o resultado: o card do início vira uma linha simples neste aparelho
  useEffect(() => markResultOpened(roundId, myId), [roundId, myId]);

  const mine = result.me.played ? result.players.find((p) => p.membershipId === myId) : undefined;
  const nobodyVoted = result.votes.voted === 0;

  return (
    <div className="flex flex-col gap-6 pb-4">
      <Scoreboard status="CLOSED" score={result.score} winner={result.winner} />
      {nobodyVoted ? (
        <EmptyState
          title="Ninguém votou"
          message="Ninguém votou nesta rodada. Sem notas e sem prêmios."
        />
      ) : (
        <>
          {result.mvps.length > 0 && (
            <section aria-label="Craque" className="flex flex-col gap-3">
              <PixelText as="h2" size={24} wrap className="text-gold">
                {result.mvps.length > 1 ? 'Craques da rodada' : 'Craque da rodada'}
              </PixelText>
              <div
                className="flex flex-col items-center gap-6 bg-track px-4 py-8 shadow-[inset_0_0_0_3px_var(--color-border-strong)] min-[360px]:flex-row min-[360px]:justify-center min-[360px]:gap-5"
                style={{
                  backgroundImage:
                    'radial-gradient(220px 180px at 50% 50%, rgb(232 169 58 / 30%) 0, transparent 180px)',
                }}
              >
                {result.mvps.map((player, i) => (
                  <CraqueCard
                    key={player.membershipId}
                    player={player}
                    roundNumber={result.number}
                    delay={i * 160}
                  />
                ))}
              </div>
            </section>
          )}
          {result.flops.length > 0 && (
            <section aria-label="Perna de pau" className="flex flex-col gap-3">
              {result.flops.map((player, i) => (
                <FlopCard key={player.membershipId} player={player} delay={200 + i * 160} />
              ))}
            </section>
          )}
          {mine && <MyScoreCard me={mine} />}
          <section aria-label="Notas da rodada" className="flex flex-col gap-3">
            <PixelText as="h2">{`Notas · ${result.votes.voted} de ${result.votes.total} votaram`}</PixelText>
            <ResultTable players={result.players} myMembershipId={myId} />
          </section>
          <p className="flex items-center gap-2 text-sm text-text-muted">
            <Icon name="lock" size={14} className="shrink-0" />
            {VOTING_END_REASON_LABELS[result.closeReason]}. Os votos são anônimos: só a média
            aparece.
          </p>
        </>
      )}
      <RouteButton to="/historico" label="Ver o Histórico" variant="outline" size={48} block />
    </div>
  );
}
