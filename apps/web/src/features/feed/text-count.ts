import { splitCharacters } from '@fut-stats/shared';

/**
 * Quantos caracteres visíveis o texto tem, com a contagem da regra do domínio (`splitCharacters`: emoji composto e
 * acento decomposto valem 1); a quebra de linha vale 1, inclusive `\r\n`. Só para o contador da tela: quem decide se
 * passou do limite é o schema do shared.
 */
export function countCharacters(text: string): number {
  return splitCharacters(text.normalize('NFC').replace(/\r?\n/g, '\n')).length;
}
