import type { ResultPlayer } from '@fut-stats/shared';
import { Avatar } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { formatRating } from '../../lib/rating-format';
import { YouTag } from '../lineup/you-tag';
import { statsText } from './result-text';

/**
 * Todos que jogaram, em ordem de nota (a ordem vem da API): posição da rodada, rosto com o anel do time, apelido,
 * nota e os gols e assistências quando tem. Os selos CRAQUE e PERNA DE PAU ficam na linha; a minha linha traz o
 * "VOCÊ"; quem ficou sem nota vem por último, com "SEM NOTA".
 */
export function ResultTable({
  players,
  myMembershipId,
}: {
  players: readonly ResultPlayer[];
  myMembershipId: string;
}) {
  return (
    <ul className="flex flex-col bg-surface shadow-card">
      {players.map((player) => {
        const mine = player.membershipId === myMembershipId;
        const stats = statsText(player);
        return (
          <li
            key={player.membershipId}
            className={cn(
              // Selos e lances ocupam uma linha própria (sob o rosto e o nome): o selo largo não esbarra na nota
              'grid grid-cols-[28px_48px_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2 min-[400px]:grid-cols-[28px_48px_minmax(0,1fr)_auto] px-3 py-2.5 shadow-[inset_0_2px_0_0_var(--color-border)] first:shadow-none',
              mine && 'bg-success/8',
            )}
          >
            <span className="col-start-1 row-start-1 flex justify-center text-text-muted">
              {player.rank !== null ? (
                <PixelDigits value={player.rank} scale={2} label={`${player.rank}º`} />
              ) : (
                <span aria-label="Sem posição" className="block h-0.5 w-3 bg-text-muted" />
              )}
            </span>
            <Avatar
              nickname={player.nickname}
              avatar={player.avatar}
              team={player.team === 'WHITE' ? 'white' : 'black'}
              size={40}
              gap="surface"
              className="col-start-2 row-span-2 row-start-1 m-1 min-[400px]:row-span-1"
            />
            <span className="col-start-3 row-start-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <PixelText>{player.nickname}</PixelText>
              {mine && <YouTag />}
            </span>
            <div className="col-start-3 row-start-2 flex justify-start min-[400px]:col-start-4 min-[400px]:row-start-1 min-[400px]:justify-end">
              {player.score !== null ? (
                <PixelDigits
                  value={formatRating(player.score)}
                  scale={3}
                  label={`Nota ${formatRating(player.score)}`}
                  className={player.isMvp ? 'text-gold' : 'text-text'}
                />
              ) : (
                <PixelText className="text-text-muted">Sem nota</PixelText>
              )}
            </div>
            {(player.isMvp || player.isFlop || stats) && (
              <div className="col-[2/-1] row-start-3 flex flex-col items-start gap-1.5 min-[400px]:row-start-2">
                {(player.isMvp || player.isFlop) && (
                  <span className="flex flex-wrap gap-1.5">
                    {player.isMvp && <Badge variant="craque" label="Craque" />}
                    {player.isFlop && <Badge variant="flop" label="Perna de pau" />}
                  </span>
                )}
                {stats && (
                  <PixelText wrap className="text-text-muted">
                    {stats}
                  </PixelText>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
