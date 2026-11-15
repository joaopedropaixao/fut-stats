import { formatRoundTime, formatRoundWeekday } from '../../lib/round-format';

/**
 * Prazo da votação na tela. O relógio do aparelho pode estar errado: a API manda `serverTime` e o prazo é
 * sempre contado no relógio dela (`clockOffset`).
 */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Quanto o relógio da API está à frente do aparelho (ms), medido na hora em que a resposta chegou. */
export function clockOffset(serverTime: string, receivedAt: number): number {
  return Date.parse(serverTime) - receivedAt;
}

/** Quanto falta para o prazo (ms), no relógio da API; `null` sem prazo. */
export function remainingMs(
  deadline: string | null,
  offset: number,
  now: number = Date.now(),
): number | null {
  return deadline === null ? null : Date.parse(deadline) - (now + offset);
}

/** "Fecha em 5 h" (da hora cheia para baixo), "Fecha em 42 min" na última hora, "Prazo acabando" no fim. */
export function closesInLabel(ms: number): string {
  if (ms <= 0) return 'Prazo acabando';
  if (ms < HOUR) return `Fecha em ${Math.max(1, Math.ceil(ms / MINUTE))} min`;
  return `Fecha em ${Math.floor(ms / HOUR)} h`;
}

/** Horas e minutos para a contagem, sempre com dois dígitos ("02", "14"). */
export function countdownParts(ms: number): { hours: string; minutes: string } {
  const total = Math.max(0, Math.floor(ms / MINUTE));
  const two = (n: number) => String(n).padStart(2, '0');
  return { hours: two(Math.floor(total / 60)), minutes: two(total % 60) };
}

/** "sáb às 21h": o dia real do prazo (nunca um dia fixo), em minúsculas para entrar na frase. */
export function formatDeadlineAt(deadline: string | Date): string {
  return `${formatRoundWeekday(deadline).toLowerCase()} às ${formatRoundTime(deadline).toLowerCase()}`;
}
