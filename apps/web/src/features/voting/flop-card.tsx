import { cardTier, TEAM_LABELS, type ResultPlayer } from '@fut-stats/shared';
import type { CSSProperties } from 'react';
import { PixelBodyLarge } from '../../components/ui/pixel-body-large';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { formatRating } from '../../lib/rating-format';
import { EdgeCrack, FootSprite, TierSeal } from '../pack/flop-sprites';
import { TIER_LABELS } from '../pack/tier';

/**
 * O Perna de Pau na moldura de madeira rachada (a mesma da carta do pacote), com o pé torto no canto e a faixa da
 * nota como selo preso na madeira: o tom é de zoeira ("Hoje não deu"), nunca de humilhação. Grande momento como os
 * outros: contorno grosso, sombra dura e entrada em degraus. A moldura é decoração (`aria-hidden`); a faixa segue
 * escrita no card.
 */
export function FlopCard({
  player,
  phrase,
  delay = 0,
}: {
  player: ResultPlayer;
  /** A piada dele, estável pela rodada e pelo jogador (`flopPhrase`). */
  phrase: string;
  delay?: number;
}) {
  const tier = player.score !== null ? cardTier(player.score) : null;
  return (
    <article
      aria-label={`Perna de pau: ${player.nickname}`}
      data-tier={tier ?? undefined}
      data-wood
      style={{ '--moment-delay': `${delay}ms` } as CSSProperties}
      className="tier-vars wood-frame animate-moment-in relative p-3"
    >
      <div className="flex flex-wrap items-center justify-between min-[380px]:flex-nowrap gap-x-3 gap-y-2 bg-surface-raised p-3 pt-5 shadow-[inset_0_0_0_3px_var(--color-flop-edge)]">
        <div className="flex min-w-[220px] flex-1 items-center gap-3 min-[380px]:min-w-0">
          <span
            aria-hidden
            className="shrink-0 bg-flop/14 p-1.5 shadow-[inset_0_0_0_2px_var(--color-flop)]"
          >
            <PixelBodyLarge
              team={player.team === 'WHITE' ? 'white' : 'black'}
              avatar={player.avatar}
              scale={2}
            />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <PixelText className="text-flop">Perna de pau</PixelText>
            <PixelText wrap>{player.nickname}</PixelText>
            <PixelText className="text-text-muted">{TEAM_LABELS[player.team]}</PixelText>
            <PixelText wrap className="text-flop">
              {phrase}
            </PixelText>
          </div>
        </div>
        {player.score !== null && (
          <PixelDigits
            value={formatRating(player.score)}
            scale={4}
            label={`Nota ${formatRating(player.score)}`}
            className="ml-auto text-flop"
          />
        )}
      </div>
      {tier !== null && (
        <>
          {/* A faixa por escrito para o leitor de tela; o selo da madeira é só o desenho dela */}
          <span className="sr-only">{TIER_LABELS[tier]}</span>
          <TierSeal
            label={TIER_LABELS[tier]}
            className="absolute -top-2 right-5 origin-top-right -rotate-[4deg]"
          />
        </>
      )}
      <EdgeCrack height={12} scale={3} className="left-36" />
      <FootSprite className="pointer-events-none absolute -bottom-4 -left-3 h-11 w-12" />
    </article>
  );
}
