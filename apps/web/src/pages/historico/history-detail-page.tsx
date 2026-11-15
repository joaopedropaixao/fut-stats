import {
  isMatchFinished,
  type MatchScore,
  type MatchView,
  type PlayerAvatar,
} from '@fut-stats/shared';
import { useState } from 'react';
import { useParams } from 'react-router';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/states';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { ResultBanner } from '../../features/history/result-banner';
import type { TeamKey } from '../../features/lineup/lineup-draft';
import { PublishedTeams } from '../../features/lineup/published-teams';
import { useLineup } from '../../features/lineup/queries';
import { RoundHeading } from '../../features/lineup/round-heading';
import { EventList } from '../../features/match/event-list';
import { useMatch } from '../../features/match/queries';
import { Scoreboard } from '../../features/match/scoreboard';
import { RouteButton } from '../../features/rounds/route-button';
import { useRound } from '../../features/rounds/queries';
import { ApiError } from '../../lib/api';
import { DEFAULT_AVATAR } from '../../lib/avatar';

/** /historico/:roundId: a partida que terminou, só para ver (placar, o meu resultado, os times e os lances). */
export function HistoryDetailPage() {
  const { roundId } = useParams();
  const { group } = useCurrentGroup();
  if (!group) return null;
  return <Content groupId={group.id} roundId={roundId} avatar={group.avatar ?? DEFAULT_AVATAR} />;
}

function Content({
  groupId,
  roundId,
  avatar,
}: {
  groupId: string;
  roundId: string | undefined;
  avatar: PlayerAvatar;
}) {
  const match = useMatch(groupId, roundId);
  // O local da partida só vem no detalhe da rodada (a visão do jogo não traz)
  const round = useRound(groupId, roundId);
  const view = match.data;
  const finished = view !== undefined && isMatchFinished(view.status) && view.score !== null;

  return (
    <>
      <RouteButton
        to="/historico"
        label="Histórico"
        icon="chevronLeft"
        variant="outline"
        size={44}
        className="self-start"
      />
      <RoundHeading
        title="Partida"
        round={view && { ...view, location: round.data?.location ?? null }}
      />
      {match.isError ? (
        match.error instanceof ApiError && match.error.status === 404 ? (
          <ErrorState
            title="Partida não encontrada"
            message="Essa partida não existe neste grupo. Confira o link ou volte para o Histórico."
          />
        ) : (
          <ErrorState
            title="Não deu para abrir a partida"
            message="Confira a internet e tente de novo."
            onRetry={() => void match.refetch()}
            retrying={match.isFetching}
          />
        )
      ) : !view ? (
        <SkeletonList rows={3} label="Carregando a partida" />
      ) : !finished ? (
        <div className="flex flex-col gap-3">
          <EmptyState
            title="Essa partida ainda não terminou"
            message="Quando o jogo acabar, o placar aparece aqui no Histórico."
          />
          <RouteButton
            to={`/rodadas/${view.roundId}`}
            label="Ver a rodada"
            variant="outline"
            size={48}
            block
          />
        </div>
      ) : (
        <Finished groupId={groupId} view={view} score={view.score!} avatar={avatar} />
      )}
    </>
  );
}

/** A partida pronta: placar, o meu resultado, os times (campo e reservas) e os lances do time escolhido. */
function Finished({
  groupId,
  view,
  score,
  avatar,
}: {
  groupId: string;
  view: MatchView;
  score: MatchScore;
  avatar: PlayerAvatar;
}) {
  const lineup = useLineup(groupId, view.roundId);
  const { team: myTeam, result } = view.me;
  // O resultado vem da API; aqui só se monta o par que a faixa recebe
  const me = myTeam && result ? { team: myTeam, result } : null;
  // O seletor abre no meu time (quem não jogou, no Branco) e a lista de lances segue o time escolhido
  const [chosen, setChosen] = useState<TeamKey | null>(null);
  const team = chosen ?? myTeam ?? 'WHITE';

  return (
    <div className="flex flex-col gap-6 pb-4">
      <Scoreboard status={view.status} score={score} />
      <ResultBanner me={me} score={score} avatar={avatar} />
      {view.status === 'POST_MATCH' && (
        <RouteButton
          to={`/rodadas/${view.roundId}/jogo`}
          label="Ir para a Resenha"
          variant="outline"
          size={48}
          block
        />
      )}
      {lineup.isError ? (
        <ErrorState
          title="Não deu para carregar os times"
          message="Confira a internet e tente de novo."
          onRetry={() => void lineup.refetch()}
          retrying={lineup.isFetching}
        />
      ) : !lineup.data ? (
        <SkeletonList rows={3} label="Carregando os times" />
      ) : (
        <PublishedTeams
          lineup={lineup.data}
          myMembershipId={view.me.membershipId}
          team={team}
          onTeamChange={setChosen}
          hideYouBanner
        />
      )}
      <EventList view={view} only={lineup.data ? team : undefined} />
    </div>
  );
}
