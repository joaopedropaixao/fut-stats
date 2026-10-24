export interface NextRoundOptions {
  /** De quantos em quantos dias o grupo joga. Padrão: 7 (toda semana). */
  intervalDays?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Sugestão de data para a rodada nova: o mesmo dia da semana e horário da última rodada do grupo, na
 * primeira data depois dela que ainda não passou. O grupo costuma ter dia e hora fixos, mas pode mudar:
 * mudou uma vez, a sugestão seguinte acompanha a última. Sem rodada anterior, `null`. `now` vem de fora.
 */
export function suggestNextRoundDate(
  last: Date | null,
  now: Date,
  options: NextRoundOptions = {},
): Date | null {
  if (!last) return null;
  const step = (options.intervalDays ?? 7) * DAY_MS;
  let next = last.getTime() + step;
  if (next <= now.getTime()) next += Math.ceil((now.getTime() - next) / step) * step;
  if (next <= now.getTime()) next += step;
  return new Date(next);
}
