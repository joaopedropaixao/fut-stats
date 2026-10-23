import { Link, useParams } from 'react-router';
import type { HistoryDetail, HistoryPlayer, HistoryTeam } from '@fut-stats/shared';
import { Avatar } from '../../components/ui/avatar';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/states';
import { ApiError } from '../../lib/api';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { pluralize } from '../../features/history/format';
import { useHistoryDetail } from '../../features/history/queries';
import { Scoreboard } from './scoreboard';

const POSITION_LABEL: Record<HistoryPlayer['position'], string> = {
  GOALKEEPER: 'GOLEIRO',
  DEFENDER: 'ZAGUEIRO',
  WINGER: 'ALA',
  MIDFIELDER: 'MEIA',
  FORWARD: 'ATACANTE',
};

function BackLink() {
  return (
    <Link to="/historico" className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start pr-3">
      <Icon name="chevronLeft" size={20} strokeWidth={2.4} />
      <PixelText>HISTÓRICO</PixelText>
    </Link>
  );
}

function PlayerRow({ player, side }: { player: HistoryPlayer; side: 'white' | 'black' }) {
  return (
    <li className="flex min-h-14 items-center gap-3 px-4 py-2">
      <Avatar
        nickname={player.nickname}
        team={side}
        size={32}
        goalkeeper={player.position === 'GOALKEEPER'}
        gap="surface"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <PixelText>{player.nickname}</PixelText>
        <PixelText className="text-text-muted">{POSITION_LABEL[player.position]}</PixelText>
      </div>
    </li>
  );
}

function TeamCard({
  title,
  side,
  team,
}: {
  title: string;
  side: 'white' | 'black';
  team: HistoryTeam;
}) {
  const empty = team.starters.length === 0 && team.reserves.length === 0;
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <PixelText as="h2" size={16}>
        {title}
      </PixelText>
      {empty ? (
        <p className="bg-surface p-4 text-sm text-text-muted shadow-card">Time não registrado.</p>
      ) : (
        <ul className="divide-y-2 divide-border bg-surface shadow-card">
          {team.starters.map((p) => (
            <PlayerRow key={p.membershipId} player={p} side={side} />
          ))}
          {team.reserves.length > 0 && (
            <li className="px-4 py-2">
              <PixelText className="text-text-muted">RESERVAS</PixelText>
            </li>
          )}
          {team.reserves.map((p) => (
            <PlayerRow key={p.membershipId} player={p} side={side} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Quem fez gol ou assistência, com o time ao lado do nome escrito (cor não é o único sinal). */
function Highlights({ match }: { match: HistoryDetail }) {
  const rows = (['WHITE', 'BLACK'] as const).flatMap((side) =>
    [...match.teams[side].starters, ...match.teams[side].reserves]
      .filter((p) => p.goals > 0 || p.assists > 0)
      .map((player) => ({ side, player })),
  );
  rows.sort((a, b) => b.player.goals - a.player.goals || b.player.assists - a.player.assists);

  return (
    <section aria-label="Lances" className="flex flex-col gap-2">
      <PixelText as="h2" size={16}>
        Lances
      </PixelText>
      {rows.length === 0 ? (
        <p className="bg-surface p-4 text-sm text-text-muted shadow-card">
          Nenhum lance registrado.
        </p>
      ) : (
        <ul className="divide-y-2 divide-border bg-surface shadow-card">
          {rows.map(({ side, player }) => (
            <li key={player.membershipId} className="flex min-h-14 items-center gap-3 px-4 py-2">
              <Avatar
                nickname={player.nickname}
                team={side === 'WHITE' ? 'white' : 'black'}
                size={32}
                gap="surface"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <PixelText>{player.nickname}</PixelText>
                <PixelText className="text-text-muted">
                  {side === 'WHITE' ? 'BRANCO' : 'PRETO'}
                </PixelText>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                {player.goals > 0 && (
                  <PixelText>{pluralize(player.goals, 'GOL', 'GOLS')}</PixelText>
                )}
                {player.assists > 0 && (
                  <PixelText className="text-text-muted">
                    {pluralize(player.assists, 'ASSISTÊNCIA', 'ASSISTÊNCIAS')}
                  </PixelText>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MatchPage() {
  const { roundId } = useParams();
  const { group, isPending: sessionPending } = useCurrentGroup();
  const match = useHistoryDetail(group?.id, roundId);
  const notFound = match.error instanceof ApiError && match.error.status === 404;

  return (
    <>
      <title>Partida · Fut Stats</title>
      <BackLink />
      <PixelText as="h1" size={24} wrap className="outline-none">
        Partida
      </PixelText>

      {(sessionPending || match.isPending) && !match.isError && <SkeletonList rows={4} />}
      {notFound && (
        <EmptyState
          title="Partida não encontrada"
          message="Ela não existe ou ainda não foi jogada."
        />
      )}
      {match.isError && !notFound && (
        <ErrorState
          title="Não deu para abrir a partida"
          message="Parece que a internet caiu ou o servidor está acordando. Tente de novo em instantes."
          onRetry={() => void match.refetch()}
          retrying={match.isFetching}
        />
      )}
      {match.data && (
        <>
          <Scoreboard match={match.data} />
          <Highlights match={match.data} />
          <TeamCard title="BRANCO" side="white" team={match.data.teams.WHITE} />
          <TeamCard title="PRETO" side="black" team={match.data.teams.BLACK} />
        </>
      )}
    </>
  );
}
