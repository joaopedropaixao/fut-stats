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

type DateInput = Date | string;

function toDate(value: DateInput): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

/** "SÁB, 24 OUT": dia da semana, dia e mês no fuso do aparelho (o número vira dígito pixel na tela). */
export function formatRoundDay(value: DateInput): string {
  const date = toDate(value);
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "9H" na hora cheia, "9H30" nas outras. */
export function formatRoundTime(value: DateInput): string {
  const date = toDate(value);
  const minutes = date.getMinutes();
  return minutes === 0
    ? `${date.getHours()}H`
    : `${date.getHours()}H${String(minutes).padStart(2, '0')}`;
}

/** O formato do app para data e hora da rodada: "SÁB, 24 OUT · 9H". */
export function formatRoundWhen(value: DateInput): string {
  return `${formatRoundDay(value)} · ${formatRoundTime(value)}`;
}

/** Quando alguém respondeu, curto para a lista: a hora se foi hoje ("14H32"), "ONTEM" ou o dia ("QUA"). */
export function formatRespondedAt(value: DateInput, now: Date = new Date()): string {
  const date = toDate(value);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return formatRoundTime(date);
  if (days === 1) return 'ONTEM';
  return WEEKDAYS[date.getDay()]!;
}
