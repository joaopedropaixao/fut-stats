import { describe, expect, it } from 'vitest';
import { priceVariation } from './price';

describe('priceVariation (defaults: k=0,5 · fator=0,3 · ±10% · mínimo C$ 3)', () => {
  it('mantém o preço quando pontua exatamente o esperado', () => {
    expect(priceVariation(14, 7)).toEqual({ expected: 7, variation: 0, newPrice: 14 });
  });

  it('valoriza quando pontua acima do esperado', () => {
    // (9 − 7) × 0,3 = 0,6
    expect(priceVariation(14, 9)).toEqual({ expected: 7, variation: 0.6, newPrice: 14.6 });
  });

  it('desvaloriza quando pontua abaixo do esperado', () => {
    // (5 − 7) × 0,3 = −0,6
    expect(priceVariation(14, 5)).toEqual({ expected: 7, variation: -0.6, newPrice: 13.4 });
  });

  it('jogador que faltou (pontos null) mantém o preço', () => {
    expect(priceVariation(14, null)).toEqual({ expected: 7, variation: 0, newPrice: 14 });
  });

  it('limita a alta a +10% do preço', () => {
    // (20 − 7) × 0,3 = 3,9 → limitado a 1,4
    expect(priceVariation(14, 20)).toEqual({ expected: 7, variation: 1.4, newPrice: 15.4 });
  });

  it('limita a queda a −10% do preço', () => {
    // (0 − 7) × 0,3 = −2,1 → limitado a −1,4
    expect(priceVariation(14, 0).newPrice).toBe(12.6);
  });

  it('nunca deixa o preço abaixo do mínimo, e a variação reflete isso', () => {
    expect(priceVariation(3.2, 0)).toEqual({ expected: 1.6, variation: -0.2, newPrice: 3 });
    expect(priceVariation(3, 0).newPrice).toBe(3);
  });

  it('arredonda o preço para 2 casas', () => {
    // (7,3 − 5) × 0,3 = 0,69
    expect(priceVariation(10, 7.3).newPrice).toBe(10.69);
    expect(priceVariation(10.01, 5.01).newPrice).toBe(10.01);
  });

  it('aceita config parcial sobre os defaults', () => {
    // esperado 10 × 1 = 10; (13 − 10) × 1 = 3, limite 50%
    expect(priceVariation(10, 13, { k: 1, factor: 1, maxChangeRatio: 0.5 }).newPrice).toBe(13);
  });
});
