const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'] as const;
const MONTHS = [
  'JAN',
  'FEV',
  'MAR',
  'ABR',
  'MAI',
  'JUN',
  'JUL',
  'AGO',
  'SET',
  'OUT',
  'NOV',
  'DEZ',
] as const;

/** "SÁB, 24 OUT": o dia da pelada, no fuso do aparelho. Data é a exceção da regra de não abreviar em pixel. */
export function formatMatchDay(iso: string): string {
  const date = new Date(iso);
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "9H" ou "20H30". */
export function formatMatchTime(iso: string): string {
  const date = new Date(iso);
  const minutes = date.getMinutes();
  return `${date.getHours()}H${minutes ? String(minutes).padStart(2, '0') : ''}`;
}

const MONTH_NAMES = [
  'JANEIRO',
  'FEVEREIRO',
  'MARÇO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
] as const;

/** "OUTUBRO 2026": cabeçalho de mês da lista. */
export function formatMonth(iso: string): string {
  const date = new Date(iso);
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/** Agrupa por mês (no fuso do aparelho), mantendo a ordem em que os itens chegaram. */
export function groupByMonth<T extends { scheduledAt: string }>(
  items: readonly T[],
): { month: string; items: T[] }[] {
  const groups: { month: string; items: T[] }[] = [];
  for (const item of items) {
    const month = formatMonth(item.scheduledAt);
    const last = groups[groups.length - 1];
    if (last?.month === month) last.items.push(item);
    else groups.push({ month, items: [item] });
  }
  return groups;
}

/** "1 GOL", "2 GOLS". */
export function pluralize(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
