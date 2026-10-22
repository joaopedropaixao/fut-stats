import { describe, expect, it } from 'vitest';
import { roundScore } from './round-score';

describe('roundScore', () => {
  it('descarta a maior e a menor nota e faz a média do resto', () => {
    expect(roundScore([0, 7, 8, 9, 10])).toBe(8);
  });

  it('descarta só uma ocorrência da maior e da menor', () => {
    expect(roundScore([6, 6, 8, 8])).toBe(7);
  });

  it('arredonda para 1 casa decimal', () => {
    expect(roundScore([5, 7, 7.5, 8, 9])).toBe(7.5);
    expect(roundScore([6, 7, 7, 7.5, 10])).toBe(7.2);
    expect(roundScore([1, 7, 7.5, 10])).toBe(7.3);
  });

  it('com menos de 3 notas faz a média simples', () => {
    expect(roundScore([7])).toBe(7);
    expect(roundScore([6, 7.5])).toBe(6.8);
  });

  it('sem notas retorna null', () => {
    expect(roundScore([])).toBeNull();
  });

  it('aceita quantas notas descartar de cada lado e casas decimais', () => {
    expect(roundScore([0, 1, 5, 6, 10, 10], { trim: 2 })).toBe(5.5);
    expect(roundScore([6, 7, 7, 7.5, 10], { decimals: 2 })).toBe(7.17);
  });

  it('não descarta quando não sobra nota depois de aparar', () => {
    expect(roundScore([4, 6, 8, 10], { trim: 2 })).toBe(7);
  });

  it.each([[[7, 11]], [[7.3]], [[-1, 5, 6]], [[Number.NaN]]])(
    'lança erro com nota inválida %j',
    (ratings) => {
      expect(() => roundScore(ratings)).toThrow(RangeError);
    },
  );
});
