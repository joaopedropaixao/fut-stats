import { useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  POSITION_LABELS,
  TEAM_LABELS,
  type HistoryDetail,
  type HistoryPlayer,
} from '@fut-stats/shared';
import { Avatar } from '../../components/ui/avatar';
import { Icon } from '../../components/ui/icons';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/states';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { pluralize } from '../../features/history/format';
import { useHistoryDetail } from '../../features/history/queries';
import { placeOnPitch, type Team } from '../../features/history/match-view';
import { Pitch } from './pitch';
import { Scoreboard } from './scoreboard';

const avatarTeam = (team: Team) => (team === 'WHITE' ? 'white' : 'black');

/** Linha de jogador: avatar com o anel do time, apelido em pixel, detalhe em Inter e os gols à direita. */
function PlayerRow({
  player,
  team,
  detail,
  first,
}: {
  player: HistoryPlayer;
  team: Team;
  detail: string;
  first: boolean;
}) {
  return (
    <li
      className={cn(
        'flex min-h-16 items-center gap-3 px-4 py-3',
        !first && 'shadow-[inset_0_2px_0_0_var(--color-border)]',
      )}
    >
      <Avatar
        nickname={player.nickname}
        team={avatarTeam(team)}
        size={40}
        goalkeeper={player.position === 'GOALKEEPER'}
        gap="surface"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <PixelText>{player.nickname}</PixelText>
        <p className="text-caption text-text-muted">{detail}</p>
      </div>
      {player.goals > 0 && (
        <span className="flex w-16 shrink-0 flex-col items-end gap-1">
          <span className="sr-only">{pluralize(player.goals, 'gol', 'gols')}</span>
          <PixelDigits value={player.goals} scale={3} decorative />
          <span aria-hidden>
            <PixelText className="text-text-muted">{player.goals === 1 ? 'Gol' : 'Gols'}</PixelText>
          </span>
        </span>
      )}
    </li>
  );
}

function assistsText(player: HistoryPlayer): string | null {
  return player.assists > 0 ? pluralize(player.assists, 'assistência', 'assistências') : null;
}

/** Quem fez gol ou deu assistência, artilheiro primeiro. O time vem escrito (cor não é o único sinal). */
function Highlights({ match }: { match: HistoryDetail }) {
  const rows = (['WHITE', 'BLACK'] as const).flatMap((team) =>
    [...match.teams[team].starters, ...match.teams[team].reserves]
      .filter((p) => p.goals > 0 || p.assists > 0)
      .map((player) => ({ team, player })),
  );
  rows.sort(
    (a, b) =>
      b.player.goals - a.player.goals ||
      b.player.assists - a.player.assists ||
      a.player.nickname.localeCompare(b.player.nickname),
  );

  const totalGoals = match.score ? match.score.WHITE + match.score.BLACK : null;
  const emptyMessage =
    totalGoals === null
      ? 'Os gols aparecem aqui quando o placar for lançado.'
      : totalGoals === 0
        ? 'Ninguém balançou a rede nesta partida.'
        : 'O placar foi lançado sem os autores dos gols.';

  return (
    <section aria-label="Lances" className="flex flex-col gap-2">
      <PixelText as="h2" className="text-text-muted">
        Lances
      </PixelText>
      {rows.length === 0 ? (
        <p className="bg-surface px-4 py-4 text-sm text-text-muted shadow-card">{emptyMessage}</p>
      ) : (
        <ul className="bg-surface shadow-card">
          {rows.map(({ team, player }, i) => (
            <PlayerRow
              key={player.membershipId}
              player={player}
              team={team}
              first={i === 0}
              detail={[TEAM_LABELS[team], assistsText(player)].filter(Boolean).join(' · ')}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Branco | Preto, como o segmentado de time da folha: o lado ativo ganha a cor do time. */
function TeamSwitch({ value, onChange }: { value: Team; onChange: (team: Team) => void }) {
  return (
    <div role="group" aria-label="Time" className="flex gap-1 bg-surface p-1 shadow-card">
      {(['WHITE', 'BLACK'] as const).map((team) => {
        const active = team === value;
        return (
          <button
            key={team}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(team)}
            className={cn(
              'flex h-11 flex-1 items-center justify-center transition-colors duration-(--duration-fast)',
              !active && 'text-text-muted hover:bg-highlight',
              active && team === 'WHITE' && 'bg-team-white text-team-black',
              active &&
                team === 'BLACK' &&
                'bg-team-black text-team-white shadow-[inset_0_0_0_2px_rgb(255_255_255/35%)]',
            )}
          >
            <PixelText>{TEAM_LABELS[team]}</PixelText>
          </button>
        );
      })}
    </div>
  );
}

/** Os dois times: campo 1-2-3-1 do time escolhido e o banco embaixo. */
function Lineups({ match }: { match: HistoryDetail }) {
  const [team, setTeam] = useState<Team>(match.winner === 'BLACK' ? 'BLACK' : 'WHITE');
  const { starters, reserves } = match.teams[team];
  const { leftover } = placeOnPitch(starters);
  const bench = [...leftover, ...reserves];
  const noLineup =
    match.teams.WHITE.starters.length === 0 && match.teams.BLACK.starters.length === 0;

  return (
    <section aria-label="Times" className="flex flex-col gap-2">
      <PixelText as="h2" className="text-text-muted">
        Times
      </PixelText>
      {noLineup ? (
        <p className="bg-surface px-4 py-4 text-sm text-text-muted shadow-card">
          Os times desta partida não foram registrados.
        </p>
      ) : (
        <>
          <TeamSwitch value={team} onChange={setTeam} />
          <Pitch team={team} starters={starters} />
          {bench.length > 0 && (
            <div className="mt-2 flex flex-col bg-surface shadow-card">
              <PixelText as="h3" className="px-4 pt-3 pb-1 text-text-muted">
                Banco
              </PixelText>
              <ul>
                {bench.map((player, i) => (
                  <PlayerRow
                    key={player.membershipId}
                    player={player}
                    team={team}
                    first={i === 0}
                    detail={[POSITION_LABELS[player.position], assistsText(player)]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function MatchSkeleton() {
  return (
    <div role="status" aria-label="Carregando a partida" className="flex flex-col gap-6">
      <div className="h-58 bg-surface-3 shadow-card" />
      <SkeletonList rows={3} label="Carregando os lances" />
    </div>
  );
}

export function MatchPage() {
  const { roundId } = useParams();
  const { group, isPending: sessionPending } = useCurrentGroup();
  const match = useHistoryDetail(group?.id, roundId);
  const notFound = match.error instanceof ApiError && match.error.status === 404;
  // O TanStack volta para "pending" ao tentar de novo sem dado: o erro fica na tela até a resposta chegar
  const failed = !match.data && match.errorUpdateCount > 0 && !notFound;

  return (
    <>
      <title>Partida · Fut Stats</title>
      <header className="-ml-3 flex items-center gap-1">
        <Link
          to="/historico"
          aria-label="Voltar para o histórico"
          className="inline-flex size-11 shrink-0 items-center justify-center hover:bg-highlight"
        >
          <Icon name="chevronLeft" size={24} strokeWidth={2.4} />
        </Link>
        <PixelText as="h1" size={24} className="outline-none">
          Partida
        </PixelText>
      </header>

      {!sessionPending && !group && (
        <EmptyState
          title="Nenhum grupo ainda"
          message="Entre numa pelada pelo convite para ver as partidas."
        />
      )}
      {(sessionPending || (group && !match.data && !failed && !notFound)) && <MatchSkeleton />}
      {notFound && (
        <EmptyState
          title="Partida não encontrada"
          message="Ela não é deste grupo ou ainda não foi jogada."
        />
      )}
      {failed && (
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
          <Lineups key={match.data.roundId} match={match.data} />
        </>
      )}
    </>
  );
}
