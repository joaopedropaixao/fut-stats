import type { ResultPlayer } from '@fut-stats/shared';
import type { CSSProperties } from 'react';
import { PixelBodyLarge } from '../../components/ui/pixel-body-large';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { formatRating } from '../../lib/rating-format';

type CraqueCardProps = {
  player: ResultPlayer;
  roundNumber: number;
  /** Atraso da entrada em degraus (ms): a segunda carta de um empate entra depois da primeira. */
  delay?: number;
};

/** Estrela cheia do canto da carta (a mesma da folha, em tinta escura). */
function SolidStar() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden className="shrink-0 fill-on-accent">
      <path d="M12 2l3 6.9 7.5.7-5.7 5 1.7 7.4L12 18l-6.5 4 1.7-7.4-5.7-5 7.5-.7z" />
    </svg>
  );
}

/**
 * A carta do Craque (folha: Carta/Craque): ouro, só ela inclinada, com a nota em dígitos pixel, o bonequinho, o
 * apelido, "CRAQUE" e a rodada. Entra em degraus (320 ms); com "reduzir movimento", só um fade. É a peça que a
 * fatia `pacote-do-craque` vai revelar: componente isolado, sem depender da tela do resultado.
 */
export function CraqueCard({ player, roundNumber, delay = 0 }: CraqueCardProps) {
  return (
    <article
      aria-label={`Craque da rodada ${roundNumber}: ${player.nickname}`}
      style={
        {
          '--moment-delay': `${delay}ms`,
          backgroundImage:
            'linear-gradient(135deg, #F6D77A 0%, #E8A93A 30%, #FBE7A8 55%, #D4F0E6 78%, #E8A93A 100%)',
          boxShadow: '#000 0 0 0 3px inset, 6px 6px 0 0 #000',
        } as CSSProperties
      }
      className="animate-moment-in flex min-h-60 w-full max-w-44 -rotate-[4deg] flex-col justify-between p-3 text-on-accent"
    >
      <div className="flex items-start justify-between gap-2">
        {player.score !== null ? (
          <PixelDigits
            value={formatRating(player.score)}
            scale={4}
            label={`Nota ${formatRating(player.score)}`}
          />
        ) : (
          <span />
        )}
        <SolidStar />
      </div>
      <div aria-hidden className="flex justify-center">
        <PixelBodyLarge
          team={player.team === 'WHITE' ? 'white' : 'black'}
          avatar={player.avatar}
          scale={3}
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <PixelText wrap>{player.nickname}</PixelText>
        <PixelText>Craque</PixelText>
        <PixelText>{`Rodada ${roundNumber}`}</PixelText>
      </div>
    </article>
  );
}
