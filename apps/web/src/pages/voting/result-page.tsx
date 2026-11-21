import {
  cardTier,
  VOTING_END_REASON_LABELS,
  VOTING_ERROR_LABELS,
  type RoundResult,
} from '@fut-stats/shared';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/states';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { RoundHeading } from '../../features/lineup/round-heading';
import { Scoreboard } from '../../features/match/scoreboard';
import { RouteButton } from '../../features/rounds/route-button';
import { Button } from '../../components/ui/button';
import { buildDeck, type PackCard } from '../../features/pack/deck';
import { CraqueMoves, CraqueNumbers, PhraseBanner } from '../../features/pack/craque-extras';
import { flopPhrase } from '../../features/pack/impact-phrase';
import { useMatch } from '../../features/match/queries';
import { ShareButton } from '../../features/pack/share-button';
import { ApiError } from '../../lib/api';
import { CRAQUE_ROW, craqueColumn } from '../../features/voting/craque-stage-layout';
import { CraqueCard } from '../../features/voting/craque-card';
import { FlopCard } from '../../features/voting/flop-card';
import { MyScoreCard } from '../../features/voting/my-score-card';
import { useResult, useVoting } from '../../features/voting/queries';
import { hasOpenedResult, markResultOpened } from '../../features/voting/result-opened';
import { ResultTable } from '../../features/voting/result-table';

// O pacote (animação, cartas e sprites) sai em outro pedaço: só quem abre o resultado pela primeira vez baixa
const PackOpening = lazy(() => import('../../features/pack/pack-opening'));

/** /rodadas/:roundId/resultado: a carta do Craque, o Perna de Pau, a minha nota e a tabela da rodada. */
export function ResultPage() {
  const { roundId } = useParams();
  const { group } = useCurrentGroup();
  if (!group) return null;
  return <Content groupId={group.id} roundId={roundId} />;
}

function Content({ groupId, roundId }: { groupId: string; roundId: string | undefined }) {
  // Antes de pedir o resultado, olha o status da votação: rodada ainda aberta não pede (a API responderia 409 e o
  // console mostraria o erro). O 409 continua tratado como reserva, se o status mudar entre as duas chamadas.
  const voting = useVoting(groupId, roundId);
  const closed = voting.data?.status === 'CLOSED';
  const result = useResult(groupId, roundId, closed);
  const data = result.data;
  const round = data ?? voting.data;

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
        round={round && { number: round.number, scheduledAt: round.scheduledAt, location: null }}
      />
      {voting.isError && !voting.data ? (
        <Failure
          roundId={roundId}
          error={voting.error}
          onRetry={() => void voting.refetch()}
          retrying={voting.isFetching}
        />
      ) : !voting.data ? (
        <SkeletonList rows={4} label="Carregando o resultado" />
      ) : !closed ? (
        <NotReady roundId={voting.data.roundId} />
      ) : result.isError && !data ? (
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

function NotReady({ roundId }: { roundId: string }) {
  return (
    <div className="flex flex-col gap-3">
      <EmptyState
        title={VOTING_ERROR_LABELS.RESULT_NOT_READY}
        message="O resultado sai quando a votação fechar."
      />
      <RouteButton to={`/rodadas/${roundId}/votar`} label="Ir para a votação" block />
    </div>
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
  if (error instanceof ApiError && error.body?.code === 'RESULT_NOT_READY' && roundId) {
    return <NotReady roundId={roundId} />;
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

/**
 * O palco do Craque na página: holofote, gradiente e padrão pixel; a carta (com gols, assistências e a frase) em
 * foco, e embaixo os números dele e os lances dele na partida (`useMatch`, só leitura). Empate: as cartas lado a
 * lado e um painel por Craque.
 */
function CraqueStage({ result, cards }: { result: RoundResult; cards: PackCard[] }) {
  const { group } = useCurrentGroup();
  const match = useMatch(group?.id ?? '', group ? result.roundId : undefined);
  const tie = cards.length > 1;
  return (
    <div className="moment-frame craque-stage animate-moment-in flex flex-col items-center gap-8 px-4 py-8">
      <div className={CRAQUE_ROW}>
        {cards.map((card, i) => (
          <div key={card.player.membershipId} className={craqueColumn(tie)}>
            <CraqueCard
              player={card.player}
              tier={card.tier}
              roundNumber={result.number}
              special={card.you}
              stats
              delay={i * 160}
              enter
            />
            {card.phrase !== null && <PhraseBanner phrase={card.phrase} className="w-full" />}
            <ShareButton card={card} roundNumber={result.number} block className="w-full" />
          </div>
        ))}
      </div>
      {cards.map((card) => (
        <div key={card.player.membershipId} className="flex w-full flex-col items-center gap-5">
          {tie && (
            <PixelText
              wrap
              className="text-center text-gold"
            >{`Números de ${card.player.nickname}`}</PixelText>
          )}
          <CraqueNumbers player={card.player} />
          {match.data && <CraqueMoves events={match.data.events} player={card.player} />}
        </div>
      ))}
    </div>
  );
}

function Loaded({ result }: { result: RoundResult }) {
  const { roundId } = result;
  const myId = result.me.membershipId;
  const deck = buildDeck(result);
  const hasPack = deck.length > 0;
  // O pacote abre na primeira vez (por rodada e por jogador); depois o resultado abre direto
  const [view, setView] = useState<'pack' | 'page'>(() =>
    hasPack && !hasOpenedResult(roundId, myId) ? 'pack' : 'page',
  );
  const craqueTitle = useRef<HTMLHeadingElement>(null);
  const focusTitle = useRef(false);

  // "Já abri" é marcado no fim do pacote (ou no Pular). Sem pacote (ninguém votou), ao abrir a página
  const markOpened = useCallback(() => markResultOpened(roundId, myId), [roundId, myId]);
  useEffect(() => {
    if (!hasPack) markOpened();
  }, [hasPack, markOpened]);

  useEffect(() => {
    if (view === 'page' && focusTitle.current) {
      focusTitle.current = false;
      craqueTitle.current?.focus({ preventScroll: false });
    }
  }, [view]);

  const mine = result.me.played ? result.players.find((p) => p.membershipId === myId) : undefined;
  const mineCard: PackCard | null =
    mine && mine.score !== null
      ? {
          kind: 'mine',
          player: mine,
          score: mine.score,
          tier: cardTier(mine.score),
          you: true,
          rank: mine.rank,
          phrase: null,
        }
      : null;
  const nobodyVoted = result.votes.voted === 0;

  if (view === 'pack') {
    return (
      <div className="flex flex-col gap-6 pb-4">
        <Suspense fallback={<SkeletonList rows={4} label="Preparando o pacote" />}>
          <PackOpening
            result={result}
            onFinish={markOpened}
            onDone={() => {
              focusTitle.current = true;
              setView('page');
            }}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-4">
      {hasPack && (
        <Button
          label="Abrir o pacote de novo"
          icon="pack"
          variant="outline"
          size={48}
          block
          onClick={() => setView('pack')}
        />
      )}
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
              <h2 ref={craqueTitle} tabIndex={-1} className="outline-none">
                <PixelText size={24} wrap className="text-gold">
                  {result.mvps.length > 1 ? 'Craques da rodada' : 'Craque da rodada'}
                </PixelText>
              </h2>
              <CraqueStage result={result} cards={deck.filter((c) => c.kind === 'craque')} />
            </section>
          )}
          {result.flops.length > 0 && (
            <section aria-label="Perna de pau" className="flex flex-col gap-3">
              {result.flops.map((player, i) => (
                <FlopCard
                  key={player.membershipId}
                  player={player}
                  phrase={flopPhrase(result.roundId, player.membershipId)}
                  delay={200 + i * 160}
                />
              ))}
            </section>
          )}
          {mine && <MyScoreCard me={mine} card={mineCard} roundNumber={result.number} />}
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
