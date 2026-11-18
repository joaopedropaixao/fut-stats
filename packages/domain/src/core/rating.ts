/** Nota de 0 a 10, de 0,5 em 0,5. */
export const RATING_MIN = 0;
export const RATING_MAX = 10;
export const RATING_STEP = 0.5;

/** Por que uma nota é inválida. Textos de UI em `packages/shared` (`RATING_ERROR_LABELS`). */
export const RATING_ERRORS = ['NOT_A_NUMBER', 'OUT_OF_RANGE', 'INVALID_STEP'] as const;

export type RatingError = (typeof RATING_ERRORS)[number];

/** Devolve o motivo de a nota ser inválida, ou null se ela for válida. */
export function validateRating(value: number): RatingError | null {
  if (!Number.isFinite(value)) return 'NOT_A_NUMBER';
  if (value < RATING_MIN || value > RATING_MAX) return 'OUT_OF_RANGE';
  if (!Number.isInteger(value / RATING_STEP)) return 'INVALID_STEP';
  return null;
}

export function isValidRating(value: number): boolean {
  return validateRating(value) === null;
}
