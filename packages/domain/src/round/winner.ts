import type { Team } from '../core';
import type { MatchScore } from './match';
import type { RoundStatus } from './status';

/** Resultado de uma partida: o time vencedor ou empate. */
export type MatchWinner = Team | 'DRAW';

/** Status em que a partida já começou: a rodada entra no histórico. */
export const PLAYED_ROUND_STATUSES = [
  'IN_PROGRESS',
  'VOTING',
  'CLOSED',
] as const satisfies readonly RoundStatus[];

/** A partida já começou (em jogo, votação ou encerrada). Placar no banco antes disso não conta. */
export function isRoundPlayed(status: RoundStatus): boolean {
  return (PLAYED_ROUND_STATUSES as readonly RoundStatus[]).includes(status);
}

/** Quem venceu pelo placar. Não há desempate: igualdade é empate. */
export function matchWinner(score: MatchScore): MatchWinner {
  if (score.WHITE === score.BLACK) return 'DRAW';
  return score.WHITE > score.BLACK ? 'WHITE' : 'BLACK';
}

/**
 * Resultado da rodada: só depois do jogo (votação ou encerrada) e com placar lançado.
 * Em jogo o placar é parcial, então ainda não há vencedor.
 */
export function roundResult(status: RoundStatus, score: MatchScore | null): MatchWinner | null {
  if (!score || status === 'IN_PROGRESS' || !isRoundPlayed(status)) return null;
  return matchWinner(score);
}
