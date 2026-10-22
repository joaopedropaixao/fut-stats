import { describe, expect, it } from 'vitest';
import { cartolaPoints, type CartolaScouts } from './points';

/** Jogador de linha que jogou, perdeu e não fez nada além da nota. */
function scouts(overrides: Partial<CartolaScouts> = {}): CartolaScouts {
  return {
    played: true,
    goals: 0,
    assists: 0,
    result: 'LOSS',
    mvp: false,
    bolaMurcha: false,
    playedAsGoalkeeper: false,
    goalsConceded: 0,
    ...overrides,
  };
}

describe('cartolaPoints', () => {
  it('jogador sem scouts pontua só a nota da rodada', () => {
    expect(cartolaPoints(scouts(), 6.5)).toBe(6.5);
  });

  it('soma gols, assistências, vitória e MVP', () => {
    const s = scouts({ goals: 2, assists: 1, result: 'WIN', mvp: true });
    // 7 + 2×3 + 1×2 + 1 + 3
    expect(cartolaPoints(s, 7)).toBe(19);
  });

  it('empate não vale ponto de vitória', () => {
    expect(cartolaPoints(scouts({ result: 'DRAW' }), 6)).toBe(6);
  });

  it('desconta a Bola Murcha', () => {
    expect(cartolaPoints(scouts({ bolaMurcha: true }), 4)).toBe(2);
  });

  it('goleiro sem sofrer gol ganha bônus', () => {
    expect(cartolaPoints(scouts({ playedAsGoalkeeper: true }), 7)).toBe(9);
  });

  it('goleiro perde 0,5 por gol sofrido e não ganha o bônus', () => {
    expect(cartolaPoints(scouts({ playedAsGoalkeeper: true, goalsConceded: 3 }), 7)).toBe(5.5);
  });

  it('gols sofridos não contam para quem jogou na linha', () => {
    expect(cartolaPoints(scouts({ goalsConceded: 3 }), 7)).toBe(7);
  });

  it('capitão multiplica o total por 1,5', () => {
    expect(cartolaPoints(scouts({ goals: 1 }), 7, { captain: true })).toBe(15);
  });

  it('capitão também multiplica pontuação negativa', () => {
    expect(cartolaPoints(scouts({ bolaMurcha: true }), 0, { captain: true })).toBe(-3);
  });

  it('arredonda para 2 casas', () => {
    expect(
      cartolaPoints(scouts({ playedAsGoalkeeper: true, goalsConceded: 1 }), 6.5, { captain: true }),
    ).toBe(9);
    expect(cartolaPoints(scouts(), 5.5, { captain: true })).toBe(8.25);
  });

  it('escalado que faltou faz 0, mesmo sendo capitão', () => {
    const absent = scouts({ played: false, goals: 2, mvp: true });
    expect(cartolaPoints(absent, 8, { captain: true })).toBe(0);
  });

  it('aceita pesos customizados', () => {
    const s = scouts({ goals: 1, result: 'DRAW' });
    expect(cartolaPoints(s, 6, { config: { goal: 5, draw: 0.5 } })).toBe(11.5);
  });

  it('rejeita nota inválida', () => {
    expect(() => cartolaPoints(scouts(), 11)).toThrow(RangeError);
    expect(() => cartolaPoints(scouts(), 6.3)).toThrow(RangeError);
  });

  it('rejeita contagens negativas ou fracionadas', () => {
    expect(() => cartolaPoints(scouts({ goals: -1 }), 6)).toThrow(RangeError);
    expect(() => cartolaPoints(scouts({ assists: 1.5 }), 6)).toThrow(RangeError);
  });
});
