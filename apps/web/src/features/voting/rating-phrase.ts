/**
 * A frase curta que acompanha a nota (texto de tela, não regra de negócio). As faixas são do spec da votação:
 * 0 a 3, 3,5 a 5, 5,5 a 6,5, 7 a 8, 8,5 a 9,5 e 10.
 */
const BANDS: readonly { upTo: number; phrase: string }[] = [
  { upTo: 3, phrase: 'Dia pra esquecer' },
  { upTo: 5, phrase: 'Ficou devendo' },
  { upTo: 6.5, phrase: 'Fez o seu' },
  { upTo: 8, phrase: 'Jogou muito' },
  { upTo: 9.5, phrase: 'Monstro' },
];

export function ratingPhrase(value: number): string {
  return BANDS.find((band) => value <= band.upTo)?.phrase ?? 'Lendário';
}
