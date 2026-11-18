import type { Position } from './position';

/** O que as regras de domínio precisam saber de um jogador (sem dados de banco). */
export interface Player {
  id: string;
  primaryPosition: Position;
  /** Usadas quando falta gente na posição principal. */
  secondaryPositions: readonly Position[];
  /** Nota de referência (média recente ou nota inicial do admin). */
  rating: number;
}
