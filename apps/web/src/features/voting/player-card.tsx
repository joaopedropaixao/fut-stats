import { POSITION_LABELS, TEAM_LABELS, type CardTier, type ResultPlayer } from '@fut-stats/shared';
import type { CSSProperties, ReactNode } from 'react';
import { PixelBodyLarge } from '../../components/ui/pixel-body-large';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { formatRating } from '../../lib/rating-format';
import { YouTag } from '../lineup/you-tag';
import { TIER_LABELS } from '../pack/tier';

/** As pistas do walkout: o que da carta já apareceu. Sem pistas, a carta está pronta (tudo à mostra). */
export type CardClues = {
  team: boolean;
  position: boolean;
  /** A nota que aparece agora (um degrau do walkout); `null` ainda não começou. */
  rating: number | null;
  face: boolean;
};

export type PlayerCardProps = {
  player: ResultPlayer;
  tier: CardTier;
  /** A nota que a carta mostra (no walkout, o degrau). */
  score: number | null;
  /** O tipo da carta, escrito: "Craque", "Perna de pau", "Sua carta". */
  kind: string;
  /** A segunda linha de texto da base ("Rodada 12", "Hoje não deu", "#3 na rodada"). */
  note: string;
  clues?: CardClues;
  /** Carta de quem vê: selo VOCÊ. */
  you?: boolean;
  /** O grande momento dobrado (o Craque sendo você): moldura dupla. */
  special?: boolean;
  /** Fenda pixel e tom de zoeira (Perna de Pau). */
  cracked?: boolean;
  /** Inclinação: cada carta tem a sua. */
  tilt?: string;
  /** Atraso da entrada em degraus (ms). */
  delay?: number;
  /** Entra com animação (a página); no pacote quem anima é o quadro. */
  enter?: boolean;
  label?: string;
  hidden?: boolean;
  className?: string;
  /** Camadas por cima (flash, brilho holográfico). */
  children?: ReactNode;
};

/** A estrela cheia do canto da carta, na tinta da faixa. */
function SolidStar() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden
      className="shrink-0 fill-(--card-ink)"
    >
      <path d="M12 2l3 6.9 7.5.7-5.7 5 1.7 7.4L12 18l-6.5 4 1.7-7.4-5.7-5 7.5-.7z" />
    </svg>
  );
}

/** A fenda pixel da carta rachada: um zigue-zague de degraus de 1 px na grade 48 x 70, de ponta a ponta no meio. */
const CRACK_PATH = Array.from({ length: 12 }, (_, i) => {
  const y = 31 + [0, 1, 0, 2, 1, 3, 2, 3, 1, 2, 0, 1][i]!;
  return `M${i * 4} ${y}h4.5v1h-4.5z`;
}).join('');

/**
 * A base das três cartas (Craque, Perna de Pau e a sua), no molde da folha (Carta/Craque): moldura e fundo da
 * faixa pela nota (bronze, prata, ouro), tira do time, nota em dígitos pixel, posição, bonequinho e nomes.
 * Com `clues`, a carta faz o walkout: apagada, acende a cor do time, depois a posição, a nota e só então o rosto.
 */
export function PlayerCard({
  player,
  tier,
  score,
  kind,
  note,
  clues,
  you,
  special,
  cracked,
  tilt = '-rotate-[4deg]',
  delay = 0,
  enter,
  label,
  hidden,
  className,
  children,
}: PlayerCardProps) {
  const showTeam = clues?.team ?? true;
  const showPosition = clues?.position ?? true;
  const showFace = clues?.face ?? true;
  const shown = clues ? clues.rating : score;
  const white = player.team === 'WHITE';
  const ring = special
    ? '#000 0 0 0 3px inset, #f3ead3 0 0 0 6px inset, 6px 6px 0 0 #000'
    : '#000 0 0 0 3px inset, 6px 6px 0 0 #000';
  return (
    <article
      aria-label={hidden ? undefined : label}
      aria-hidden={hidden || undefined}
      data-tier={showFace ? tier : undefined}
      data-card={kind}
      style={{ '--moment-delay': `${delay}ms`, boxShadow: ring } as CSSProperties}
      className={cn(
        'card-frame relative flex min-h-72 w-48 max-w-full flex-col justify-between gap-2 overflow-hidden p-3 pt-0',
        tilt,
        enter && 'animate-moment-in',
        className,
      )}
    >
      {/* Tira do time: acende primeiro, na cor do time */}
      <div
        className={cn(
          '-mx-3 flex h-9 items-center justify-between px-4',
          special && 'mt-2',
          !special && 'mt-[3px]',
          showTeam
            ? white
              ? 'bg-team-white text-team-black shadow-[inset_0_-3px_0_0_#000]'
              : 'bg-team-black text-team-white shadow-[inset_0_-3px_0_0_rgb(255_255_255/35%)]'
            : 'bg-track text-transparent',
        )}
      >
        <PixelText className={showTeam ? undefined : 'invisible'}>
          {TEAM_LABELS[player.team]}
        </PixelText>
        {you && (
          <span className={showFace ? undefined : 'invisible'}>
            <YouTag />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          {shown !== null ? (
            <span
              key={formatRating(shown)}
              className={cn('inline-flex origin-bottom-left', clues && 'animate-digit-bump')}
              style={{ '--bump-scale': 1.18 } as CSSProperties}
            >
              <PixelDigits
                value={formatRating(shown)}
                scale={4}
                label={`Nota ${formatRating(shown)}`}
              />
            </span>
          ) : (
            <PixelDigits value="0,0" scale={4} decorative className="invisible" />
          )}
          <div className={cn('flex flex-col items-end gap-1', !showFace && 'invisible')}>
            <SolidStar />
            <PixelText className="text-(--card-ink-2)">{TIER_LABELS[tier]}</PixelText>
          </div>
        </div>
        <PixelText className={cn('text-(--card-ink-2)', !showPosition && 'invisible')}>
          {POSITION_LABELS[player.position]}
        </PixelText>
      </div>
      <div aria-hidden className="relative flex justify-center">
        <PixelBodyLarge
          team={white ? 'white' : 'black'}
          avatar={player.avatar}
          scale={3}
          className={showFace ? undefined : 'opacity-35 [filter:brightness(0)]'}
        />
      </div>
      <div className={cn('flex flex-col gap-0.5', !showFace && 'invisible')}>
        <PixelText wrap className="text-(--card-ink)">
          {player.nickname}
        </PixelText>
        <PixelText wrap className="text-(--card-ink-2)">
          {kind}
        </PixelText>
        <PixelText wrap className="text-(--card-ink-2)">
          {note}
        </PixelText>
      </div>
      {cracked && showFace && (
        <svg
          aria-hidden
          viewBox="0 0 48 70"
          shapeRendering="crispEdges"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <path d={CRACK_PATH} fill="#130a03" />
        </svg>
      )}
      {special && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[6px] border-[3px] border-team-black"
        />
      )}
      {children}
    </article>
  );
}
