import type { ResultKind } from './history-text';

/** Cor do texto e da marca de cada resultado (claros o bastante para ler no fundo escuro). */
export const RESULT_TONE: Record<ResultKind, string> = {
  WIN: 'text-success',
  LOSS: 'text-[#f87171]',
  DRAW: 'text-gold',
  NONE: 'text-text-muted',
};
