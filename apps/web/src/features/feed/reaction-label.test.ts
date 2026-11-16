import { describe, expect, it } from 'vitest';
import { reactionAriaLabel } from './reaction-label';

describe('nome do botão de reação (C36)', () => {
  it('diz o nome, quantas reações e se é a minha', () => {
    expect(reactionAriaLabel('CATFISH', 3, true)).toBe('Bagre, 3 reações, a sua');
    expect(reactionAriaLabel('POPCORN', 1, false)).toBe('Pipocou, 1 reação');
    expect(reactionAriaLabel('BALL', 0, false)).toBe('Bola, 0 reações');
  });
});
