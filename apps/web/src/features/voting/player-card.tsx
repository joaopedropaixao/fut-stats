import { POSITION_LABELS, TEAM_LABELS, type CardTier, type ResultPlayer } from '@fut-stats/shared';
import type { CSSProperties, ReactNode } from 'react';
import { PixelBodyLarge } from '../../components/ui/pixel-body-large';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { formatRating } from '../../lib/rating-format';
import { CrackSprite, EdgeCrack, FootSprite, TierSeal } from '../pack/flop-sprites';
import { TIER_LABELS } from '../pack/tier';

/** As pistas do walkout: o que da carta já apareceu. Sem pistas, a carta está pronta (tudo à mostra). */
export type CardClues = {
  team: boolean;
  position: boolean;
  /** A nota que aparece agora (um degrau do walkout); `null` ainda não começou. */
  rating: number | null;
  face: boolean;
};

/** Os números do jogador na partida, na carta (gols e assistências; gol contra não entra). */
export type CardStats = { goals: number; assists: number };

export type PlayerCardProps = {
  player: ResultPlayer;
  tier: CardTier;
  /** A nota que a carta mostra (no walkout, o degrau). */
  score: number | null;
  /** O tipo da carta, escrito: "Craque", "Perna de pau", "Sua carta". */
  kind: string;
  /** A segunda linha de texto da base ("Rodada 12", "Hoje não deu", "Posição 3"). */
  note: string;
  clues?: CardClues;
  /** Carta de quem vê: selo VOCÊ. */
  you?: boolean;
  /** O grande momento dobrado (o Craque sendo você): moldura dupla. */
  special?: boolean;
  /** Gols e assistências na partida: duas etiquetas ao lado do bonequinho (a carta do Craque). */
  stats?: CardStats;
  /**
   * Moldura de madeira rachada com o pé torto no canto (o Perna de Pau): sempre madeira, para qualquer nota. A
   * faixa da nota vira o selo "BRONZE" / "PRATA" / "OURO" preso na madeira.
   */
  wood?: boolean;
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

/**
 * O selo "VOCÊ" da carta: fundo escuro, letras claras, contorno grosso e sombra dura, para não camuflar no branco
 * do time nem nas faixas bronze, prata e ouro. Texto e forma cheia, nunca só cor.
 */
function YouStamp() {
  return (
    <span className="inline-flex h-6 items-center border-[3px] border-text bg-team-black px-1 text-text shadow-[3px_3px_0_0_#000]">
      <PixelText>Você</PixelText>
    </span>
  );
}

/** "2 gols", "1 gol", "1 assist.": a etiqueta escura de um número da carta. */
function StatChip({ label }: { label: string }) {
  return (
    <span className="inline-flex h-6 items-center self-start bg-(--card-ink) px-2 text-team-white">
      <PixelText>{label}</PixelText>
    </span>
  );
}

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

/**
 * A base das três cartas (Craque, Perna de Pau e a sua), no molde da folha (Carta/Craque): moldura e fundo da
 * faixa pela nota (bronze, prata, ouro), tira do time, nota em dígitos pixel, posição, bonequinho e nomes.
 * Com `clues`, a carta faz o walkout: apagada, acende a cor do time, depois a posição, a nota e só então o rosto.
 * Com `wood` (o Perna de Pau), a moldura é de madeira rachada, com o pé torto no canto e a faixa como selo.
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
  wood,
  stats,
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
    : wood
      ? '#000 0 0 0 3px inset, 4px 4px 0 0 #000'
      : '#000 0 0 0 3px inset, 6px 6px 0 0 #000';
  // Na moldura de madeira o miolo é uma caixa própria: as seções (menos a tira do time) ganham o recuo dele
  const pad = wood ? 'px-3' : undefined;
  const sections = (
    <>
      {/* Tira do time: acende primeiro, na cor do time */}
      <div
        className={cn(
          'flex items-center justify-between',
          wood
            ? 'h-[30px] shrink-0 px-3'
            : cn('-mx-3 h-9', you ? 'px-3' : 'px-4', special && 'mt-2', !special && 'mt-[3px]'),
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
            <YouStamp />
          </span>
        )}
      </div>
      <div className={cn('flex flex-col gap-1', pad)}>
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
          {/* Na madeira a faixa vira o selo preso na moldura (mais abaixo) */}
          {!wood && (
            <div className={cn('flex flex-col items-end gap-1', !showFace && 'invisible')}>
              <SolidStar />
              <PixelText className="text-(--card-ink-2)">{TIER_LABELS[tier]}</PixelText>
            </div>
          )}
        </div>
        <PixelText className={cn('text-(--card-ink-2)', !showPosition && 'invisible')}>
          {POSITION_LABELS[player.position]}
        </PixelText>
      </div>
      <div
        className={cn(
          'relative flex items-center',
          stats ? 'justify-between' : 'justify-center',
          pad,
        )}
      >
        {stats && (
          <div className={cn('flex flex-col gap-1.5', !showFace && 'invisible')}>
            <StatChip label={`${stats.goals} ${stats.goals === 1 ? 'gol' : 'gols'}`} />
            <StatChip label={`${stats.assists} assist.`} />
          </div>
        )}
        <span aria-hidden className="flex">
          <PixelBodyLarge
            team={white ? 'white' : 'black'}
            avatar={player.avatar}
            scale={3}
            className={showFace ? undefined : 'opacity-35 [filter:brightness(0)]'}
          />
        </span>
      </div>
      <div className={cn('flex flex-col gap-0.5', !showFace && 'invisible', pad)}>
        <PixelText wrap className="text-(--card-ink)">
          {player.nickname}
        </PixelText>
        <PixelText wrap className="text-(--card-ink-2)">
          {kind}
        </PixelText>
        <PixelText wrap className={wood ? 'text-flop-ink' : 'text-(--card-ink-2)'}>
          {note}
        </PixelText>
      </div>
    </>
  );
  return (
    <article
      aria-label={hidden ? undefined : label}
      aria-hidden={hidden || undefined}
      data-tier={showFace ? tier : undefined}
      data-wood={wood || undefined}
      data-card={kind}
      style={{ '--moment-delay': `${delay}ms`, boxShadow: ring } as CSSProperties}
      className={cn(
        'card-frame relative flex max-w-full flex-col justify-between gap-2',
        // A madeira é mais larga (como no desenho, 240 px): a moldura come o miolo e a frase do Perna de Pau precisa de espaço
        wood ? 'min-h-80 w-60 p-4' : 'min-h-72 w-48 overflow-hidden p-3 pt-0',
        tilt,
        enter && 'animate-moment-in',
        className,
      )}
    >
      {wood ? (
        <div className="flop-face flex flex-1 flex-col justify-between gap-2 pb-3">{sections}</div>
      ) : (
        sections
      )}
      {wood && showFace && (
        <>
          {/* Rachaduras da madeira, o pé torto no canto de baixo e o selo da faixa, preso por um prego */}
          {/* Só a ponta na madeira de cima (16 px): a rachadura inteira passava por cima do texto da tira do time */}
          <EdgeCrack height={16} scale={4} className="left-24" />
          <CrackSprite className="pointer-events-none absolute top-[150px] right-0 h-11 w-12" />
          <FootSprite className="pointer-events-none absolute -right-[18px] -bottom-[18px] h-[55px] w-[60px] origin-top-left rotate-[12deg]" />
          <TierSeal
            label={TIER_LABELS[tier]}
            className={cn(
              'absolute -right-[10px] origin-top-left rotate-[6deg]',
              you ? 'top-[52px]' : 'top-10',
            )}
          />
        </>
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
