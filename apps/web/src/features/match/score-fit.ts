/** Folga mínima entre os dois placares (px): os dígitos nunca se encostam. */
export const SCORE_MIN_GAP = 12;
/** Menor escala que ainda lê como dígito. */
const MIN_SCALE = 3;

/**
 * Maior escala inteira (dígito pixel nunca fracionado) em que os dois números cabem lado a lado na largura
 * `available`, com a folga mínima entre eles. Nunca passa de `base`: onde já cabia, o visual não muda.
 * `units` é a soma das larguras dos dois números em colunas de pixel (`pixelDigitsPath(...).width`).
 */
export function fitScale(base: number, units: number, available: number): number {
  if (units <= 0 || !Number.isFinite(available) || available <= 0) return base;
  const fit = Math.floor((available - SCORE_MIN_GAP) / units);
  return Math.max(MIN_SCALE, Math.min(base, fit));
}
