export type RotationPhase = 'COUNTDOWN' | 'PREPARE' | 'CHANGE' | 'FINISHED';

export const PREPARE_WINDOW_MS = 30_000;
export const CHANGE_WINDOW_MS = 10_000;

/** Estado visual do cronômetro; os limites e o plano da troca vêm do domain. */
export function rotationPhase({
  finished,
  nextInMs,
  turnIndex,
  elapsedInTurnMs,
}: {
  finished: boolean;
  nextInMs: number | null;
  turnIndex: number;
  elapsedInTurnMs: number;
}): RotationPhase {
  if (finished) return 'FINISHED';
  if (turnIndex > 0 && elapsedInTurnMs >= 0 && elapsedInTurnMs < CHANGE_WINDOW_MS) return 'CHANGE';
  if (nextInMs !== null && nextInMs <= PREPARE_WINDOW_MS) return 'PREPARE';
  return 'COUNTDOWN';
}

/** Diferença entre a hora informada pela API e o relógio local no instante da resposta. */
export function clockOffset(serverTime: string, localNowMs: number): number {
  const serverNowMs = Date.parse(serverTime);
  return Number.isFinite(serverNowMs) ? serverNowMs - localNowMs : 0;
}

export function synchronizedNow(localNowMs: number, offsetMs: number): number {
  return localNowMs + offsetMs;
}

export function rotationElapsedMs(startedAt: string, synchronizedNowMs: number): number {
  return Math.max(0, synchronizedNowMs - Date.parse(startedAt));
}
