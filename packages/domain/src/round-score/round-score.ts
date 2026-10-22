import { isValidRating } from '../core';

export interface RoundScoreOptions {
  /** Quantas notas descartar de cada ponta (maiores e menores). */
  trim?: number;
  /** Casas decimais do resultado. */
  decimals?: number;
}

/**
 * Nota da rodada de um jogador: média aparada das notas recebidas.
 * Descarta as `trim` maiores e as `trim` menores; se não sobrar nota depois disso
 * (ex.: menos de 3 notas com trim 1), faz a média simples. Sem notas retorna null.
 */
export function roundScore(
  ratings: readonly number[],
  { trim = 1, decimals = 1 }: RoundScoreOptions = {},
): number | null {
  const invalid = ratings.find((r) => !isValidRating(r));
  if (invalid !== undefined) throw new RangeError(`Nota inválida: ${invalid}`);
  if (ratings.length === 0) return null;

  const sorted = [...ratings].sort((a, b) => a - b);
  const kept = sorted.length > trim * 2 ? sorted.slice(trim, sorted.length - trim) : sorted;
  const mean = kept.reduce((sum, r) => sum + r, 0) / kept.length;

  const factor = 10 ** decimals;
  return Math.round((mean + Number.EPSILON) * factor) / factor;
}
