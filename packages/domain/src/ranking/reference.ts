/** Quantas notas de rodada formam a nota de referência. */
export const DEFAULT_REFERENCE_WINDOW = 5;

export interface ReferenceRatingOptions {
  window?: number;
}

/**
 * Nota de referência de um jogador (o `Player.rating` do seletor, do card de equilíbrio e da lista de presença):
 * média das `window` últimas notas de rodada, com a nota inicial do admin completando as que faltam. Sem nota
 * é a inicial; com `window` ou mais, a inicial não pesa mais. `roundScores` vem da mais antiga para a mais
 * recente. Resultado com 2 casas, meio para cima.
 */
export function referenceRating(
  initialRating: number,
  roundScores: readonly number[],
  { window = DEFAULT_REFERENCE_WINDOW }: ReferenceRatingOptions = {},
): number {
  const size =
    Number.isFinite(window) && window >= 1 ? Math.floor(window) : DEFAULT_REFERENCE_WINDOW;
  const recent = roundScores.slice(-size);
  const total =
    recent.reduce((sum, score) => sum + score, 0) + (size - recent.length) * initialRating;
  return Math.round((total / size + Number.EPSILON) * 100) / 100;
}
