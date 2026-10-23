import type { Team } from '../core';
import type { MatchScore } from './match';

/** Resultado de uma partida: o time vencedor ou empate. */
export type MatchWinner = Team | 'DRAW';

/** Quem venceu pelo placar. Não há desempate: igualdade é empate. */
export function matchWinner(score: MatchScore): MatchWinner {
  if (score.WHITE === score.BLACK) return 'DRAW';
  return score.WHITE > score.BLACK ? 'WHITE' : 'BLACK';
}
