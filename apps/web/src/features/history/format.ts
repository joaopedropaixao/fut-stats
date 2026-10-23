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

/** Placar no padrão do app: "4×3". */
export function formatScore(score: { white: number; black: number }): string {
  return `${score.white}×${score.black}`;
}

/** "1 GOL", "2 GOLS". */
export function pluralize(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
