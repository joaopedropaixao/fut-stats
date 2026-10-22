import { describe, expect, it } from 'vitest';
import { parseRatings, roundScore, type RoundScoreOptions } from './round-score';

/** Valida e calcula; falha o teste se as notas forem inválidas. */
function score(ratings: number[], options?: RoundScoreOptions) {
  const parsed = parseRatings(ratings);
  if (!parsed.ok) throw new Error(`notas inválidas no teste: ${JSON.stringify(parsed.errors)}`);
  return roundScore(parsed.value, options);
}

describe('parseRatings', () => {
  it('aceita notas válidas', () => {
    expect(parseRatings([0, 7.5, 10])).toEqual({ ok: true, value: [0, 7.5, 10] });
  });

  it('lista todas as notas inválidas, com posição, valor e motivo', () => {
    expect(parseRatings([7, 11, 7.3, Number.NaN])).toEqual({
      ok: false,
      errors: [
        { index: 1, value: 11, code: 'OUT_OF_RANGE' },
        { index: 2, value: 7.3, code: 'INVALID_STEP' },
        { index: 3, value: Number.NaN, code: 'NOT_A_NUMBER' },
      ],
    });
  });
});

describe('roundScore', () => {
  it('só aceita notas validadas por parseRatings', () => {
    // @ts-expect-error: array cru não tem o "carimbo" de ValidRatings
    roundScore([7, 8]);
  });

  it('descarta a maior e a menor nota e faz a média do resto', () => {
    expect(score([0, 7, 8, 9, 10])).toBe(8);
  });

  it('descarta só uma ocorrência da maior e da menor', () => {
    expect(score([6, 6, 8, 8])).toBe(7);
  });

  it('arredonda para 1 casa decimal', () => {
    expect(score([5, 7, 7.5, 8, 9])).toBe(7.5);
    expect(score([6, 7, 7, 7.5, 10])).toBe(7.2);
    expect(score([1, 7, 7.5, 10])).toBe(7.3);
  });

  it('com 3 notas ou menos faz a média simples', () => {
    expect(score([7])).toBe(7);
    expect(score([6, 7.5])).toBe(6.8);
    expect(score([0, 7, 8])).toBe(5);
  });

  it('a partir de 4 notas apara', () => {
    expect(score([0, 7, 8, 10])).toBe(7.5);
  });

  it('aceita a quantidade mínima de notas para aparar', () => {
    expect(score([0, 7, 8], { minRatingsToTrim: 3 })).toBe(7);
    expect(score([0, 7, 8, 10], { minRatingsToTrim: 5 })).toBe(6.3);
  });

  it('sem notas retorna null', () => {
    expect(score([])).toBeNull();
  });

  it('aceita quantas notas descartar de cada lado e casas decimais', () => {
    expect(score([0, 1, 5, 6, 10, 10], { trim: 2 })).toBe(5.5);
    expect(score([6, 7, 7, 7.5, 10], { decimals: 2 })).toBe(7.17);
  });

  it('não descarta quando não sobra nota depois de aparar', () => {
    expect(score([4, 6, 8, 10], { trim: 2 })).toBe(7);
  });
});
