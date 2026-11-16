let segmenter: Intl.Segmenter | null | undefined;

/**
 * Quantos caracteres visíveis o texto tem, como a regra do domínio conta (emoji composto e acento decomposto valem 1;
 * a quebra de linha vale 1). Só para o contador da tela: quem decide se passou do limite é o schema do shared.
 */
export function countCharacters(text: string): number {
  if (segmenter === undefined)
    segmenter =
      typeof Intl.Segmenter === 'function'
        ? new Intl.Segmenter('pt', { granularity: 'grapheme' })
        : null;
  const normalized = text.normalize('NFC').replace(/\r?\n/g, '\n');
  if (!segmenter) return [...normalized].length;
  return Array.from(segmenter.segment(normalized)).length;
}
