import { TEAM_LABELS } from '@fut-stats/shared';
import { Avatar } from '../../components/ui/avatar';
import { PixelText } from '../../components/ui/pixel-text';
import { pluralize } from '../../features/history/format';
import { playerSummary, type PlacedPlayer, type Team } from '../../features/history/match-view';

/** O campo 1-2-3-1 (assinatura 2 do DS), só para olhar: quem jogou onde e quantos gols fez. */
export function Pitch({ team, placed }: { team: Team; placed: readonly PlacedPlayer[] }) {
  return (
    <div className="relative h-120 overflow-hidden bg-linear-to-b from-[#1f5a33] to-field shadow-[inset_0_0_0_3px_#000,4px_4px_0_var(--color-shadow)]">
      <ChalkLines />
      <ul aria-label={`Titulares do ${TEAM_LABELS[team]}`} className="absolute inset-0">
        {placed.map(({ player, left, top }) => (
          <li
            key={player.membershipId}
            style={{ left, top }}
            className="absolute flex w-34 -translate-x-1/2 flex-col items-center gap-1.5"
          >
            <span className="sr-only">{playerSummary(player)}</span>
            <span aria-hidden className="flex flex-col items-center gap-1.5">
              <Avatar
                nickname={player.nickname}
                team={team === 'WHITE' ? 'white' : 'black'}
                size={40}
                goalkeeper={player.position === 'GOALKEEPER'}
              />
              <PixelText>{player.nickname}</PixelText>
              {player.goals > 0 && (
                <span className="-mt-1 bg-bg/80 px-1.5">
                  <PixelText>{pluralize(player.goals, 'gol', 'gols')}</PixelText>
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** As linhas de giz da folha: meio-campo no alto (arco) e a grande área com a pequena área embaixo. */
function ChalkLines() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 358 480"
      preserveAspectRatio="none"
      className="absolute inset-0 size-full"
      fill="none"
      stroke="rgb(255 255 255 / 30%)"
      strokeWidth="2"
    >
      <rect x="14" y="14" width="330" height="452" vectorEffect="non-scaling-stroke" />
      <path d="M119 14a60 60 0 0 0 120 0" vectorEffect="non-scaling-stroke" />
      <rect x="99" y="392" width="160" height="74" vectorEffect="non-scaling-stroke" />
      <rect x="139" y="438" width="80" height="28" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
