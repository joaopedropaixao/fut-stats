import { describe, expect, it } from 'vitest';
import { fitScale, SCORE_MIN_GAP } from './score-fit';

describe('fitScale (placar não passa da borda)', () => {
  it('onde já cabia, mantém a escala de sempre', () => {
    // 1 dígito de cada lado (6 colunas cada) a 12 = 144 px: cabe em qualquer largura de celular
    expect(fitScale(12, 12, 248)).toBe(12);
    expect(fitScale(12, 26, 358)).toBe(12); // 2 dígitos em 430 px
  });

  it('encolhe em degraus inteiros quando 2 dígitos não cabem (320 px)', () => {
    expect(fitScale(12, 26, 248)).toBe(9);
    expect(fitScale(12, 26, 303)).toBe(11); // 375 px
  });

  it('3 dígitos (base 8) também cabem em 320 px', () => {
    expect(fitScale(8, 40, 248)).toBe(5);
    expect(fitScale(8, 40, 346)).toBe(8);
  });

  it('o resultado sempre cabe com a folga, ou chega ao piso', () => {
    for (let available = 200; available <= 600; available += 7) {
      const s = fitScale(12, 26, available);
      expect(Number.isInteger(s)).toBe(true);
      expect(s === 3 || s * 26 + SCORE_MIN_GAP <= available).toBe(true);
    }
  });

  it('sem medida ainda (0, NaN), usa a base', () => {
    expect(fitScale(12, 26, 0)).toBe(12);
    expect(fitScale(12, 26, Number.NaN)).toBe(12);
  });
});
