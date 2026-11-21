import type { CardTier, ResultPlayer } from '@fut-stats/shared';
import type { ReactNode } from 'react';
import { PlayerCard, type CardClues } from '../voting/player-card';

type SiblingProps = {
  player: ResultPlayer;
  tier: CardTier;
  you?: boolean;
  /** A frase do Perna de Pau (estável pela rodada e pelo jogador); sem ela, "Hoje não deu". */
  phrase?: string | null;
  delay?: number;
  hidden?: boolean;
  className?: string;
  children?: ReactNode;
};

/**
 * A carta do Perna de Pau no molde das cartas: cai com a moldura de madeira rachada e o pé torto no canto, com a
 * piada dele ("HOJE NÃO DEU"). Tom de zoeira, nunca de humilhação: a moldura é sempre madeira, para qualquer nota, e
 * a faixa da nota (normalmente bronze) vira o selo preso na madeira. O leitor de tela segue ouvindo a faixa por
 * escrito (`pack-text`); a moldura é decoração.
 */
export function FlopPackCard({
  player,
  tier,
  you,
  phrase,
  delay,
  hidden,
  className,
  children,
}: SiblingProps) {
  return (
    <PlayerCard
      player={player}
      tier={tier}
      score={player.score}
      kind="Perna de pau"
      note={phrase ?? 'Hoje não deu'}
      you={you}
      wood
      tilt="rotate-[5deg]"
      delay={delay}
      hidden={hidden}
      className={className}
      label={`Perna de pau: ${player.nickname}`}
    >
      {children}
    </PlayerCard>
  );
}

/** A sua carta: a sua nota, a sua posição e "Posição N", na faixa da nota. */
export function MinePackCard({
  player,
  tier,
  rank,
  delay,
  hidden,
  className,
  clues,
  children,
}: Omit<SiblingProps, 'you'> & { rank: number | null; clues?: CardClues }) {
  return (
    <PlayerCard
      player={player}
      tier={tier}
      score={player.score}
      kind="Sua carta"
      note={rank !== null ? `Posição ${rank}` : 'Sem posição'}
      you
      tilt="rotate-[-2deg]"
      clues={clues}
      delay={delay}
      hidden={hidden}
      className={className}
      label={`Sua carta: ${player.nickname}`}
    >
      {children}
    </PlayerCard>
  );
}
