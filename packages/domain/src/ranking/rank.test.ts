import { describe, expect, it } from 'vitest';
import { rankByRating } from './rank';

describe('rankByRating', () => {
  it('maior nota é 1º', () => {
    const ranks = rankByRating([
      { id: 'a', rating: 6 },
      { id: 'b', rating: 8.5 },
      { id: 'c', rating: 7 },
    ]);
    expect([...ranks]).toEqual([
      ['b', 1],
      ['c', 2],
      ['a', 3],
    ]);
  });

  it('empate divide a posição e pula a seguinte (1, 2, 2, 4)', () => {
    const ranks = rankByRating([
      { id: 'a', rating: 8 },
      { id: 'b', rating: 7 },
      { id: 'c', rating: 7 },
      { id: 'd', rating: 6 },
    ]);
    expect(ranks.get('b')).toBe(2);
    expect(ranks.get('c')).toBe(2);
    expect(ranks.get('d')).toBe(4);
  });

  it('lista vazia devolve mapa vazio', () => {
    expect(rankByRating([]).size).toBe(0);
  });
});
