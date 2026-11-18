import type { CardTier, ResultPlayer } from '@fut-stats/shared';
import type { ReactNode } from 'react';
import { PlayerCard, type CardClues } from './player-card';

type CraqueCardProps = {
  player: ResultPlayer;
  roundNumber: number;
  /** A faixa pela nota (`cardTier`); sem ela, a carta é calculada pelo chamador. */
  tier: CardTier;
  /** Atraso da entrada em degraus (ms): a segunda carta de um empate entra depois da primeira. */
  delay?: number;
  /** Walkout: as pistas que já apareceram. Sem elas, a carta está pronta. */
  clues?: CardClues;
  /** O Craque sou eu: carta especial, o grande momento dobrado, com o selo VOCÊ. */
  special?: boolean;
  /** Mostra os gols e as assistências do Craque na carta. */
  stats?: boolean;
  /** Entra com a animação de grande momento (na página). */
  enter?: boolean;
  hidden?: boolean;
  className?: string;
  children?: ReactNode;
};

/**
 * A carta do Craque (folha: Carta/Craque), inclinada, na faixa da nota: a nota em dígitos pixel, a posição, o
 * bonequinho, o apelido, "CRAQUE" e a rodada. Estende a base comum das cartas (`PlayerCard`): faz o walkout do
 * pacote (pistas em degraus) e, sendo o Craque você, vira a carta especial com o selo "VOCÊ".
 */
export function CraqueCard({
  player,
  roundNumber,
  tier,
  delay = 0,
  clues,
  special,
  stats,
  enter,
  hidden,
  className,
  children,
}: CraqueCardProps) {
  return (
    <PlayerCard
      player={player}
      tier={tier}
      score={player.score}
      kind="Craque"
      note={`Rodada ${roundNumber}`}
      clues={clues}
      you={special}
      special={special}
      stats={stats ? { goals: player.goals, assists: player.assists } : undefined}
      delay={delay}
      enter={enter}
      hidden={hidden}
      className={className}
      label={`Craque da rodada ${roundNumber}: ${player.nickname}`}
    >
      {children}
    </PlayerCard>
  );
}
