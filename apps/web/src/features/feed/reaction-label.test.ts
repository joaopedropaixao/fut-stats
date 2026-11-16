import { describe, expect, it } from 'vitest';
import { reactionAriaLabel } from './reaction-label';

describe('nome do botão de reação (C36)', () => {
  it('diz o nome, quantas reações e se é a minha', () => {
    expect(reactionAriaLabel('FIRE', 3, true)).toBe('Fogo, 3 reações, a sua');
    expect(reactionAriaLabel('FLOP', 1, false)).toBe('Perna de pau, 1 reação');
    expect(reactionAriaLabel('BALL', 0, false)).toBe('Bola, 0 reações');
  });
});
