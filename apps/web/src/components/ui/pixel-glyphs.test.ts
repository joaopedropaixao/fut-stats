import { describe, expect, it } from 'vitest';
import { isPixelText, pixelDigitsPath } from './pixel-glyphs';

describe('pixelDigitsPath', () => {
  it('desenha um dígito com a largura da grade (6)', () => {
    const { d, width } = pixelDigitsPath('1');
    expect(width).toBe(6);
    // linha 0 do "1" é "..##.." → um retângulo de 2 começando na coluna 2
    expect(d.startsWith('M2 0h2v1h-2z')).toBe(true);
  });

  it('separa os caracteres com 1 coluna vazia e todo algarismo tem a mesma largura', () => {
    expect(pixelDigitsPath('10').width).toBe(13);
    expect(pixelDigitsPath('88').width).toBe(pixelDigitsPath('11').width);
  });

  it('a vírgula é estreita (2 colunas)', () => {
    expect(pixelDigitsPath('8,4').width).toBe(6 + 1 + 2 + 1 + 6);
  });

  it('desloca o segundo caractere pela largura do primeiro + 1', () => {
    const { d } = pixelDigitsPath('11');
    expect(d).toContain('M9 0h2v1h-2z');
  });

  it('ignora caractere desconhecido em vez de quebrar', () => {
    expect(pixelDigitsPath('1a').width).toBe(pixelDigitsPath('1').width);
    expect(pixelDigitsPath('').width).toBe(1);
  });
});

describe('isPixelText', () => {
  it('aceita números, vírgula, placar e contagem', () => {
    expect(isPixelText('8,4')).toBe(true);
    expect(isPixelText('4×3')).toBe(true);
    expect(isPixelText('+9')).toBe(true);
    expect(isPixelText('12/14')).toBe(true);
  });

  it('recusa letras e ponto decimal', () => {
    expect(isPixelText('R12')).toBe(false);
    expect(isPixelText('8.4')).toBe(false);
  });
});
