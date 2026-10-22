/** Nota de 0 a 10, de 0,5 em 0,5. */
export const RATING_MIN = 0;
export const RATING_MAX = 10;
export const RATING_STEP = 0.5;

export function isValidRating(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= RATING_MIN &&
    value <= RATING_MAX &&
    Number.isInteger(value / RATING_STEP)
  );
}
