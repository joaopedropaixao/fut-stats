/** Quantos números aparecem, no máximo, na contagem em degraus (o resto é amostrado, para a animação durar cerca de 1 s). */
export const MAX_REVEAL_STEPS = 6;
/** Tempo de cada degrau. */
export const REVEAL_STEP_MS = 120;

/**
 * Os números que a posição mostra, da antiga para a nova: 11 → 10 → 9. Se o salto for grande, mostra alguns pelo
 * caminho (sempre começando na antiga e terminando na nova). É só a contagem da animação, não regra de ranking.
 */
export function rankSteps(from: number, to: number, max: number = MAX_REVEAL_STEPS): number[] {
  const span = Math.abs(from - to) + 1;
  const direction = to >= from ? 1 : -1;
  if (span <= max) return Array.from({ length: span }, (_, i) => from + direction * i);
  return Array.from(
    { length: max },
    (_, i) => from + direction * Math.round((i * (span - 1)) / (max - 1)),
  );
}

export type RevealPlan = { steps: number[]; kind: 'up' | 'down' };

/**
 * O que fazer ao abrir o ranking. Só anima quem tem posição e tendência diferente de zero (subiu ou desceu) e ainda
 * não viu a animação desta rodada. A posição antiga é `rank + trend` (a API manda `trend` como + subiu, − desceu).
 * Com "reduzir movimento" mostra direto o final, mas marca como visto.
 */
export function planReveal(input: {
  rank: number | null;
  trend: number | null;
  seen: boolean;
  reducedMotion: boolean;
}): { plan: RevealPlan | null; shouldMark: boolean } {
  const { rank, trend, seen, reducedMotion } = input;
  if (rank === null || trend === null || trend === 0 || seen)
    return { plan: null, shouldMark: false };
  if (reducedMotion) return { plan: null, shouldMark: true };
  return {
    plan: { steps: rankSteps(Math.max(1, rank + trend), rank), kind: trend > 0 ? 'up' : 'down' },
    shouldMark: true,
  };
}
