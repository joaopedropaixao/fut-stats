import { describe, expect, it } from 'vitest';
import { cardTier, DEFAULT_CARD_TIER_CUTS } from './card-tier';

describe('cardTier', () => {
  it('D1: o padrão corta a prata em 6 e o ouro em 8', () => {
    expect(DEFAULT_CARD_TIER_CUTS).toEqual({ silver: 6, gold: 8 });
  });

  it('D1: 5,9 é bronze', () => {
    expect(cardTier(5.9)).toBe('bronze');
  });

  it('D1: 6,0 é prata', () => {
    expect(cardTier(6.0)).toBe('silver');
  });

  it('D1: 7,9 é prata', () => {
    expect(cardTier(7.9)).toBe('silver');
  });

  it('D1: 8,0 é ouro', () => {
    expect(cardTier(8.0)).toBe('gold');
  });

  it('D1: os extremos da escala: 1 é bronze e 10 é ouro', () => {
    expect(cardTier(1)).toBe('bronze');
    expect(cardTier(10)).toBe('gold');
  });

  it('D1: notas com uma casa em cima do corte caem na faixa de cima', () => {
    expect(cardTier(6)).toBe('silver');
    expect(cardTier(8)).toBe('gold');
    expect(cardTier(6.1)).toBe('silver');
    expect(cardTier(8.1)).toBe('gold');
  });

  it('D1: cortes customizados por config', () => {
    const cuts = { silver: 5, gold: 9 };
    expect(cardTier(4.9, cuts)).toBe('bronze');
    expect(cardTier(5, cuts)).toBe('silver');
    expect(cardTier(8.9, cuts)).toBe('silver');
    expect(cardTier(9, cuts)).toBe('gold');
    // com o corte padrão, as mesmas notas caem em outras faixas
    expect(cardTier(5)).toBe('bronze');
    expect(cardTier(8.9)).toBe('gold');
  });
});
