import { ratingSchema } from '@fut-stats/shared';

/**
 * A régua da nota na tela: 0 a 10, de 0,5 em 0,5. Quem vale é o `ratingSchema` do contrato; estes números só
 * dizem onde desenhar a régua e quanto cada toque anda.
 */
export const SCALE_MIN = 0;
export const SCALE_MAX = 10;
export const SCALE_STEP = 0.5;

/** A nota mais próxima de uma posição na régua (0 = ponta esquerda, 1 = ponta direita), sempre válida. */
export function ratingAtRatio(ratio: number): number {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  const steps = Math.round((clamped * (SCALE_MAX - SCALE_MIN)) / SCALE_STEP);
  return SCALE_MIN + steps * SCALE_STEP;
}

/** Onde a nota fica na régua, de 0 a 1. */
export function ratioOfRating(value: number): number {
  return (value - SCALE_MIN) / (SCALE_MAX - SCALE_MIN);
}

/** A nota um passo acima ou abaixo; `null` no limite (o botão apaga). */
export function stepRating(value: number, direction: 1 | -1): number | null {
  const next = value + direction * SCALE_STEP;
  return ratingSchema.safeParse(next).success ? next : null;
}
