import { describe, expect, it } from 'vitest';
import { podiumLabel, podiumTier } from './podium';

describe('pódio do ranking', () => {
  it('1º ouro, 2º prata, 3º bronze; o resto e quem está fora do ranking, nenhum', () => {
    expect(podiumTier(1)).toBe('gold');
    expect(podiumTier(2)).toBe('silver');
    expect(podiumTier(3)).toBe('bronze');
    expect(podiumTier(4)).toBeNull();
    expect(podiumTier(13)).toBeNull();
    expect(podiumTier(null)).toBeNull();
  });
  it('o nome para leitor de tela diz o lugar e a medalha', () => {
    expect(podiumLabel(1)).toBe('1º lugar, ouro');
    expect(podiumLabel(2)).toBe('2º lugar, prata');
    expect(podiumLabel(3)).toBe('3º lugar, bronze');
    expect(podiumLabel(4)).toBeNull();
  });
});
