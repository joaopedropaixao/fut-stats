import type { Position } from '../core';

/** Quantas posições secundárias um jogador pode ter. */
export const MAX_SECONDARY_POSITIONS = 2;

/** Por que a combinação de posição principal e secundárias é inválida. Textos em `packages/shared`. */
export const PLAYER_POSITIONS_ERRORS = [
  'SECONDARY_IS_PRIMARY',
  'DUPLICATE_SECONDARY',
  'GOALKEEPER_AS_SECONDARY',
  'GOALKEEPER_HAS_SECONDARY',
  'TOO_MANY_SECONDARIES',
] as const;

export type PlayerPositionsError = (typeof PLAYER_POSITIONS_ERRORS)[number];

export interface PlayerPositionsOptions {
  /** Padrão: `MAX_SECONDARY_POSITIONS`. */
  maxSecondaries?: number;
}

/**
 * A posição principal e as secundárias combinam? Lista todos os problemas, sem repetir código, na ordem de
 * `PLAYER_POSITIONS_ERRORS`; lista vazia = válida. Quem tem `GOALKEEPER` como principal não tem secundária,
 * e `GOALKEEPER` nunca é secundária (o seletor não põe goleiro na linha nem jogador de linha no gol).
 */
export function validatePlayerPositions(
  primary: Position,
  secondaries: readonly Position[],
  { maxSecondaries = MAX_SECONDARY_POSITIONS }: PlayerPositionsOptions = {},
): PlayerPositionsError[] {
  const found = new Set<PlayerPositionsError>();
  if (secondaries.includes(primary)) found.add('SECONDARY_IS_PRIMARY');
  if (new Set(secondaries).size !== secondaries.length) found.add('DUPLICATE_SECONDARY');
  if (secondaries.includes('GOALKEEPER')) found.add('GOALKEEPER_AS_SECONDARY');
  if (primary === 'GOALKEEPER' && secondaries.length > 0) found.add('GOALKEEPER_HAS_SECONDARY');
  if (secondaries.length > maxSecondaries) found.add('TOO_MANY_SECONDARIES');
  return PLAYER_POSITIONS_ERRORS.filter((error) => found.has(error));
}
