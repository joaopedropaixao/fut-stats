import { describe, expect, it } from 'vitest';
import {
  cartolaPoints,
  parseCartolaScouts,
  type CartolaRating,
  type CartolaScouts,
  type ValidCartolaScouts,
} from './points';

/** Jogador de linha que jogou, perdeu e não fez nada além da nota. */
function raw(overrides: Partial<CartolaScouts> = {}): CartolaScouts {
  return {
    played: true,
    goals: 0,
    assists: 0,
    result: 'LOSS',
    mvp: false,
    flop: false,
    playedAsGoalkeeper: false,
    goalsConceded: 0,
    ...overrides,
  };
}

function valid(overrides: Partial<CartolaScouts> = {}): ValidCartolaScouts {
  const parsed = parseCartolaScouts(raw(overrides));
  if (!parsed.ok) throw new Error('scouts de teste inválidos');
  return parsed.value;
}

/** Nota da rodada com nota de referência qualquer (só usada quando a da rodada é null). */
function rating(round: number | null, reference = 6): CartolaRating {
  return { round, reference };
}

describe('parseCartolaScouts', () => {
  it('aceita scouts válidos', () => {
    expect(parseCartolaScouts(raw({ goals: 2, goalsConceded: 3 })).ok).toBe(true);
  });

  it('lista todas as contagens negativas, fracionadas ou não numéricas', () => {
    const result = parseCartolaScouts(raw({ goals: -1, assists: 1.5, goalsConceded: Number.NaN }));
    expect(result).toEqual({
      ok: false,
      errors: [
        { field: 'goals', value: -1, code: 'INVALID_COUNT' },
        { field: 'assists', value: 1.5, code: 'INVALID_COUNT' },
        { field: 'goalsConceded', value: Number.NaN, code: 'INVALID_COUNT' },
      ],
    });
  });
});

describe('cartolaPoints', () => {
  it('jogador sem scouts pontua só a nota da rodada', () => {
    expect(cartolaPoints(valid(), rating(6.5))).toBe(6.5);
  });

  it('aceita a nota da rodada com 1 casa decimal (saída do roundScore)', () => {
    expect(cartolaPoints(valid(), rating(7.3))).toBe(7.3);
  });

  it('sem nota na rodada, usa a nota de referência do jogador', () => {
    expect(cartolaPoints(valid({ goals: 1 }), rating(null, 6.5))).toBe(9.5);
  });

  it('soma gols, assistências, vitória e Craque', () => {
    const s = valid({ goals: 2, assists: 1, result: 'WIN', mvp: true });
    // 7 + 2×3 + 1×2 + 1 + 3
    expect(cartolaPoints(s, rating(7))).toBe(19);
  });

  it('empate não vale ponto de vitória', () => {
    expect(cartolaPoints(valid({ result: 'DRAW' }), rating(6))).toBe(6);
  });

  it('desconta o Perna de Pau', () => {
    expect(cartolaPoints(valid({ flop: true }), rating(4))).toBe(2);
  });

  it('goleiro sem sofrer gol ganha bônus', () => {
    expect(cartolaPoints(valid({ playedAsGoalkeeper: true }), rating(7))).toBe(9);
  });

  it('goleiro perde 0,5 por gol sofrido e não ganha o bônus', () => {
    expect(cartolaPoints(valid({ playedAsGoalkeeper: true, goalsConceded: 3 }), rating(7))).toBe(
      5.5,
    );
  });

  it('gols sofridos não contam para quem jogou na linha', () => {
    expect(cartolaPoints(valid({ goalsConceded: 3 }), rating(7))).toBe(7);
  });

  it('capitão multiplica o total por 1,5', () => {
    expect(cartolaPoints(valid({ goals: 1 }), rating(7), { captain: true })).toBe(15);
  });

  it('capitão também multiplica pontuação negativa', () => {
    expect(cartolaPoints(valid({ flop: true }), rating(0), { captain: true })).toBe(-3);
  });

  it('arredonda para 2 casas', () => {
    expect(cartolaPoints(valid(), rating(5.5), { captain: true })).toBe(8.25);
    expect(cartolaPoints(valid(), rating(7.3), { captain: true })).toBe(10.95);
  });

  it('escalado que faltou faz 0, mesmo sendo capitão', () => {
    const absent = valid({ played: false, goals: 2, mvp: true });
    expect(cartolaPoints(absent, rating(8), { captain: true })).toBe(0);
  });

  it('aceita pesos customizados sobre os defaults', () => {
    const s = valid({ goals: 1, result: 'DRAW' });
    expect(cartolaPoints(s, rating(6), { config: { goal: 5, draw: 0.5 } })).toBe(11.5);
  });
});
