import { describe, expect, it } from 'vitest';
import { reactionAriaLabel, reactionShortName } from './reaction-label';

describe('nome do botão de reação (C36)', () => {
  it('diz o nome, quantas reações e se é a minha', () => {
    expect(reactionAriaLabel('CATFISH', 3, true)).toBe('Bagre, 3 reações, a sua');
    expect(reactionAriaLabel('POPCORN', 1, false)).toBe('Pipocou, 1 reação');
    expect(reactionAriaLabel('BALL', 0, false)).toBe('Bola, 0 reações');
  });
});

describe('nome curto embaixo do ícone', () => {
  it('o Cartão amarelo mostra só "Cartão"; os outros mostram o nome inteiro', () => {
    expect(reactionShortName('YELLOW_CARD')).toBe('Cartão');
    expect(reactionShortName('CATFISH')).toBe('Bagre');
    expect(reactionShortName('POPCORN')).toBe('Pipocou');
  });
  it('o aria-label do Cartão amarelo diz o nome inteiro', () => {
    expect(reactionAriaLabel('YELLOW_CARD', 2, true)).toBe('Cartão amarelo, 2 reações, a sua');
  });
});
