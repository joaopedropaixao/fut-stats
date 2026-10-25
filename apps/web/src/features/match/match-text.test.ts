import { describe, expect, it } from 'vitest';
import { goalsOfScore, resultAnnouncement } from './match-text';

describe('goalsOfScore', () => {
  it('mostra quantos gols têm autor perto do placar do time', () => {
    expect(goalsOfScore(2, 3)).toBe('2 de 3 gols');
    expect(goalsOfScore(0, 1)).toBe('0 de 1 gol');
  });

  it('sem placar lançado, só a contagem', () => {
    expect(goalsOfScore(1, undefined)).toBe('1 gol');
    expect(goalsOfScore(2, undefined)).toBe('2 gols');
  });
});

describe('resultAnnouncement', () => {
  it('começa pelo placar do time de quem vê', () => {
    expect(resultAnnouncement('WIN', { WHITE: 3, BLACK: 2 }, 'WHITE')).toBe('Você venceu 3 a 2');
    expect(resultAnnouncement('LOSS', { WHITE: 3, BLACK: 2 }, 'BLACK')).toBe('Você perdeu 2 a 3');
    expect(resultAnnouncement('DRAW', { WHITE: 2, BLACK: 2 }, 'WHITE')).toBe('Empate em 2 a 2');
  });
});
