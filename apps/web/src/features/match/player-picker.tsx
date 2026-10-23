import { POSITION_LABELS, TEAM_LABELS, type MatchPlayer } from '@fut-stats/shared';
import { Avatar } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { PixelText } from '../../components/ui/pixel-text';

type PlayerPickerProps = {
  players: MatchPlayer[];
  onPick: (player: MatchPlayer) => void;
};

/** Quem jogou, por time: um toque escolhe o jogador do lance. */
export function PlayerPicker({ players, onPick }: PlayerPickerProps) {
  return (
    <div className="flex flex-col gap-4 pt-1">
      {(['WHITE', 'BLACK'] as const).map((team) => (
        <div key={team} role="group" aria-label={TEAM_LABELS[team]} className="flex flex-col gap-2">
          <Badge
            variant={team === 'WHITE' ? 'white' : 'black'}
            label={TEAM_LABELS[team]}
            className="self-start"
          />
          <ul className="flex flex-col bg-surface shadow-card">
            {players
              .filter((player) => player.team === team)
              .map((player, i) => (
                <li key={player.membershipId}>
                  <button
                    type="button"
                    onClick={() => onPick(player)}
                    className={`flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-highlight ${
                      i > 0 ? 'shadow-[inset_0_2px_0_0_var(--color-border)]' : ''
                    }`}
                  >
                    <Avatar
                      nickname={player.nickname}
                      team={team === 'WHITE' ? 'white' : 'black'}
                      size={32}
                      goalkeeper={player.position === 'GOALKEEPER' && !player.isReserve}
                      gap="surface"
                    />
                    <PixelText className="flex-1">{player.nickname}</PixelText>
                    <span className="text-sm text-text-muted">
                      {player.isReserve ? 'Reserva' : POSITION_LABELS[player.position]}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
