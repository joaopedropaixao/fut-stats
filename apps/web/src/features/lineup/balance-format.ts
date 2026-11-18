/** Nota com uma casa e vírgula ("7,4"). */
export function formatAverage(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

/** Quanto da barra é do Branco (0 a 100); sem médias, metade. */
export function whiteShare(white: number | null, black: number | null): number {
  if (white === null || black === null || white + black <= 0) return 50;
  return (white / (white + black)) * 100;
}
