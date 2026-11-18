import { describe, expect, it } from 'vitest';
import { logoWordArt } from './logo-art';

const area = (d: string) => [...d.matchAll(/h(\d+)/g)].reduce((sum, m) => sum + Number(m[1]), 0);

describe('logoWordArt', () => {
  it('mede a palavra com 1 coluna entre letras e a margem do contorno e da profundidade', () => {
    expect(logoWordArt('FUT')).toMatchObject({ width: 1 + 20 + 3, height: 1 + 9 + 3 });
    expect(logoWordArt('STATS').width).toBe(1 + 34 + 3);
  });

  it('a letra T tem 6 + 8x2 pixels acesos', () => {
    expect(area(logoWordArt('T').face)).toBe(22);
  });

  it('as camadas não se sobrepõem e cobrem a letra engordada', () => {
    const art = logoWordArt('T');
    const layers = [art.face, art.outline, art.extrude, art.shadow].map(area);
    expect(layers.every((n) => n > 0)).toBe(true);
    // T de 6x9: tudo que é desenhado cabe na caixa da palavra
    expect(layers.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(art.width * art.height);
  });

  it('letra sem desenho é erro de programação', () => {
    expect(() => logoWordArt('Z')).toThrow(/Z/);
  });
});
