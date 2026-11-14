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
