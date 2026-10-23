import { POSITION_LABELS, TEAM_LABELS, type Lineup, type LineupPlayer } from '@fut-stats/shared';
import { Avatar } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { PixelText } from '../../components/ui/pixel-text';
import type { TeamKey } from './lineup-draft';

/** Os dois times publicados, um card por time: figurinhas com o anel do time. */
export function PublishedTeams({ lineup }: { lineup: Lineup }) {
  return (
    <div className="flex flex-col gap-4">
      {(['WHITE', 'BLACK'] as const).map((team) => (
        <TeamCard key={team} team={team} lineup={lineup} />
      ))}
    </div>
  );
}

function TeamCard({ team, lineup }: { team: TeamKey; lineup: Lineup }) {
  const { starters, reserves } = lineup.teams[team];
  return (
    <section
      aria-label={`Time ${TEAM_LABELS[team]}`}
      className="flex flex-col gap-3 bg-surface p-4 shadow-card"
    >
      <Badge
        label={TEAM_LABELS[team]}
        variant={team === 'WHITE' ? 'white' : 'black'}
        className="self-start"
      />
      <ul className="flex flex-col gap-3">
        {starters.map((p) => (
          <PlayerRow key={p.membershipId} player={p} team={team} />
        ))}
      </ul>
      {reserves.length > 0 && (
        <div className="flex flex-col gap-3">
          <PixelText className="text-text-muted">Reservas</PixelText>
          <ul className="flex flex-col gap-3">
            {reserves.map((p) => (
              <PlayerRow key={p.membershipId} player={p} team={team} reserve />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function PlayerRow({
  player,
  team,
  reserve,
}: {
  player: LineupPlayer;
  team: TeamKey;
  reserve?: boolean;
}) {
  return (
    <li className="flex items-center gap-3">
      <Avatar
        nickname={player.nickname}
        team={team === 'WHITE' ? 'white' : 'black'}
        size={40}
        gap="surface"
        goalkeeper={player.position === 'GOALKEEPER'}
      />
      <div className="flex flex-col">
        <PixelText>{player.nickname}</PixelText>
        {!reserve && (
          <span className="text-caption text-text-muted">{POSITION_LABELS[player.position]}</span>
        )}
      </div>
    </li>
  );
}
