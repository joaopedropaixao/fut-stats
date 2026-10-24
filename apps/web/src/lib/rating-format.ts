/** Nota no formato do app, com vírgula e sem casa à toa: 7.5 → "7,5", 8 → "8" (vira dígito pixel na tela). */
export function formatRating(rating: number): string {
  return String(Math.round(rating * 10) / 10).replace('.', ',');
}
