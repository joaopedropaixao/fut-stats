import { cardTier, TEAM_LABELS, type ResultPlayer } from '@fut-stats/shared';
import type { CSSProperties } from 'react';
import { Badge } from '../../components/ui/badge';
import { PixelBodyLarge } from '../../components/ui/pixel-body-large';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { formatRating } from '../../lib/rating-format';
import { TIER_LABELS } from '../pack/tier';

/**
 * O Perna de Pau em madeira (`--color-flop`), com selo e ícone e sem brilho: o tom é de zoeira ("Hoje não deu"),
 * nunca de humilhação. Grande momento como os outros: contorno grosso, sombra dura e entrada em degraus.
 */
export function FlopCard({ player, delay = 0 }: { player: ResultPlayer; delay?: number }) {
  return (
    <article
      aria-label={`Perna de pau: ${player.nickname}`}
      style={{ '--moment-delay': `${delay}ms`, borderColor: 'var(--color-flop)' } as CSSProperties}
      className="moment-frame animate-moment-in flex items-center gap-4 bg-surface-raised p-4"
    >
      <span
        aria-hidden
        className="shrink-0 bg-flop/14 p-2 shadow-[inset_0_0_0_2px_var(--color-flop)]"
      >
        <PixelBodyLarge
          team={player.team === 'WHITE' ? 'white' : 'black'}
          avatar={player.avatar}
          scale={2}
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Badge variant="flop" label="Perna de pau" className="self-start" />
        <PixelText wrap>{player.nickname}</PixelText>
        <PixelText className="text-text-muted">{TEAM_LABELS[player.team]}</PixelText>
        <PixelText wrap className="text-flop">
          Hoje não deu
        </PixelText>
      </div>
      {player.score !== null && (
        <div className="flex flex-col items-end gap-1.5">
          <PixelDigits
            value={formatRating(player.score)}
            scale={4}
            label={`Nota ${formatRating(player.score)}`}
            className="text-flop"
          />
          <PixelText className="text-text-muted">{TIER_LABELS[cardTier(player.score)]}</PixelText>
        </div>
      )}
    </article>
  );
}
