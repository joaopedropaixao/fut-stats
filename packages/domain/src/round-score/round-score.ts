import { validateRating, type RatingError, type Result } from '../core';

declare const validRatings: unique symbol;

/** Notas que já passaram por `parseRatings`. Só ela cria esse tipo. */
export type ValidRatings = readonly number[] & { readonly [validRatings]: true };

/** Uma nota inválida: posição na lista, valor recebido e motivo. */
export interface RatingIssue {
  index: number;
  value: number;
  code: RatingError;
}

/** Valida as notas recebidas por um jogador; devolve todas as inválidas, se houver. */
export function parseRatings(ratings: readonly number[]): Result<ValidRatings, RatingIssue> {
  const errors: RatingIssue[] = [];
  ratings.forEach((value, index) => {
    const code = validateRating(value);
    if (code) errors.push({ index, value, code });
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: ratings as ValidRatings };
}

export interface RoundScoreOptions {
  /** Quantas notas descartar de cada ponta (maiores e menores). */
  trim?: number;
  /** Abaixo disso não apara: com poucas notas, aparar deixaria uma ou duas pessoas decidindo a nota. */
  minRatingsToTrim?: number;
  /** Casas decimais do resultado. */
  decimals?: number;
}

/**
 * Nota da rodada de um jogador: média aparada das notas recebidas.
 * Com pelo menos `minRatingsToTrim` notas, descarta as `trim` maiores e as `trim` menores;
 * com menos (ou se não sobrar nota depois de aparar), faz a média simples. Sem notas retorna null.
 */
export function roundScore(
  ratings: ValidRatings,
  { trim = 1, minRatingsToTrim = 4, decimals = 1 }: RoundScoreOptions = {},
): number | null {
  if (ratings.length === 0) return null;

  const sorted = [...ratings].sort((a, b) => a - b);
  const shouldTrim = sorted.length >= minRatingsToTrim && sorted.length > trim * 2;
  const kept = shouldTrim ? sorted.slice(trim, sorted.length - trim) : sorted;
  const mean = kept.reduce((sum, r) => sum + r, 0) / kept.length;

  const factor = 10 ** decimals;
  return Math.round((mean + Number.EPSILON) * factor) / factor;
}
