/** Nota no formato do app: sempre uma casa, com vírgula (7.5 → "7,5", 8 → "8,0"). Vira dígito pixel na tela. */
export function formatRating(rating: number): string {
  return rating.toFixed(1).replace('.', ',');
}
