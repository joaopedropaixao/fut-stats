import { formatRoundDay, formatRoundTime } from '../../lib/round-format';

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Quando a resenha ou o comentário saiu: "HOJE, 21H", "ONTEM, 21H" e, antes disso, a data no formato do app
 * ("SÁB, 17 OUT"). Dias pelo calendário do aparelho (não por 24 h corridas). Sem dia da semana fixo: ele sai da data.
 */
export function postWhen(value: string | Date, now: Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (sameDay(date, now)) return `HOJE, ${formatRoundTime(date)}`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(date, yesterday)) return `ONTEM, ${formatRoundTime(date)}`;
  return formatRoundDay(date);
}
