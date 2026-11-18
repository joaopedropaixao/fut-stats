import { PLAYER_POSITIONS_ERROR_LABELS } from '@fut-stats/shared';
import type { Position } from './position-picker';

/**
 * Até quantas posições secundárias o jogador marca. O número é regra do domain (`MAX_SECONDARY_POSITIONS`),
 * que o contrato ainda não exporta para o web: este é o espelho. Quem decide de verdade é a API (400 com o texto
 * do shared); aqui só evita o pedido que ela recusaria.
 */
export const MAX_SECONDARY_POSITIONS = 2;

export type PositionsError = keyof typeof PLAYER_POSITIONS_ERROR_LABELS;

export function positionsErrorText(error: PositionsError): string {
  return PLAYER_POSITIONS_ERROR_LABELS[error];
}

/** Trocou a principal: ela deixa de ser secundária, e o goleiro joga só no gol (sem secundárias). */
export function secondariesAfterPrimary(
  primary: Position,
  secondaries: readonly Position[],
): Position[] {
  if (primary === 'GOALKEEPER') return [];
  return secondaries.filter((position) => position !== primary);
}

/**
 * Marcou ou desmarcou uma secundária. A terceira não marca: devolve a lista como está e o erro `TOO_MANY_SECONDARIES`.
 * Principal e goleiro nunca entram como secundária.
 */
export function toggleSecondary(
  secondaries: readonly Position[],
  position: Position,
  primary: Position,
): { secondaries: Position[]; error: PositionsError | null } {
  if (position === primary || position === 'GOALKEEPER') {
    return { secondaries: [...secondaries], error: null };
  }
  if (secondaries.includes(position)) {
    return { secondaries: secondaries.filter((p) => p !== position), error: null };
  }
  if (secondaries.length >= MAX_SECONDARY_POSITIONS) {
    return { secondaries: [...secondaries], error: 'TOO_MANY_SECONDARIES' };
  }
  return { secondaries: [...secondaries, position], error: null };
}
