import { describe, expect, it } from 'vitest';
import { DEFAULT_REFERENCE_WINDOW, referenceRating } from './reference';

describe('referenceRating', () => {
  it('C8: sem nota, é a inicial', () => {
    expect(referenceRating(6, [])).toBe(6);
  });

  it('C8: 1 nota (8) com inicial 6: 6,4', () => {
    expect(referenceRating(6, [8])).toBe(6.4);
  });

  it('C8: 2 notas (8 e 9) com inicial 6: 7,0', () => {
    expect(referenceRating(6, [8, 9])).toBe(7);
  });

  it('C8: com cinco notas, a média delas; a inicial não pesa mais', () => {
    expect(referenceRating(6, [8, 9, 7, 7.5, 6.5])).toBe(7.6);
    expect(referenceRating(10, [8, 9, 7, 7.5, 6.5])).toBe(7.6);
  });

  it('C8: com sete notas, a média das cinco últimas (a lista vem da mais antiga para a mais recente)', () => {
    expect(referenceRating(6, [1, 2, 8, 9, 7, 7.5, 6.5])).toBe(7.6);
  });

  it('C8: arredonda em 2 casas, meio para cima', () => {
    // 21,5 / 3 = 7,1666...
    expect(referenceRating(6, [7.5, 7, 7], { window: 3 })).toBe(7.17);
    // 28,5 / 4 = 7,125
    expect(referenceRating(6, [7, 7, 7, 7.5], { window: 4 })).toBe(7.13);
    // (7 + 4 * 6) / 5 = 6,2
    expect(referenceRating(6, [7])).toBe(6.2);
  });

  it('C9: janela 3 por config usa 3', () => {
    // 3 últimas: 9, 7,5, 6,5 = 23 / 3 = 7,67
    expect(referenceRating(6, [1, 9, 7.5, 6.5], { window: 3 })).toBe(7.67);
    // com 1 nota, a inicial completa as 2 que faltam: (8 + 12) / 3 = 6,67
    expect(referenceRating(6, [8], { window: 3 })).toBe(6.67);
  });

  it('C9: o padrão da janela é 5', () => {
    expect(DEFAULT_REFERENCE_WINDOW).toBe(5);
    expect(referenceRating(6, [8], { window: DEFAULT_REFERENCE_WINDOW })).toBe(
      referenceRating(6, [8]),
    );
  });

  it('C9: janela inválida não lança e cai no padrão', () => {
    expect(referenceRating(6, [8], { window: 0 })).toBe(6.4);
    expect(referenceRating(6, [8], { window: Number.NaN })).toBe(6.4);
  });
});
