import { describe, expect, it } from 'vitest';
import { countCharacters } from './text-count';

describe('contador de caracteres (C38, C40)', () => {
  it('conta caractere visível, não unidade de texto', () => {
    expect(countCharacters('Fogo')).toBe(4);
    expect(countCharacters('é')).toBe(1); // acento decomposto vira um só
    expect(countCharacters('👨‍👩‍👧')).toBe(1); // emoji composto conta 1
  });

  it('quebra de linha vale um, inclusive no formato do Windows', () => {
    expect(countCharacters('a\nb')).toBe(3);
    expect(countCharacters('a\r\nb')).toBe(3);
  });

  it('vazio é zero', () => {
    expect(countCharacters('')).toBe(0);
  });
});
