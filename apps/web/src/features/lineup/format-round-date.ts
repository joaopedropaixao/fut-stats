const formatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** "SÁB, 24 OUT · 9H" (e "20H30" quando tem minutos): data e hora são a exceção da abreviação em pixel. */
export function formatRoundDate(iso: string): string {
  const part = Object.fromEntries(
    formatter.formatToParts(new Date(iso)).map(({ type, value }) => [type, value.replace('.', '')]),
  );
  const minute = part.minute === '00' ? '' : part.minute;
  return `${part.weekday}, ${part.day} ${part.month} · ${part.hour}H${minute}`.toUpperCase();
}
