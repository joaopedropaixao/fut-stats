import { describe, expect, it } from 'vitest';
import { planReveal, rankSteps } from './rank-reveal';

describe('rankSteps', () => {
  it('sobe em degraus: 11 → 10 → 9', () => {
    expect(rankSteps(11, 9)).toEqual([11, 10, 9]);
  });
  it('desce em degraus: 3 → 4', () => {
    expect(rankSteps(3, 4)).toEqual([3, 4]);
  });
  it('salto grande é amostrado, sempre da antiga para a nova', () => {
    const steps = rankSteps(20, 2);
    expect(steps).toHaveLength(6);
    expect(steps[0]).toBe(20);
    expect(steps.at(-1)).toBe(2);
    expect([...steps].sort((a, b) => b - a)).toEqual(steps);
  });
});

describe('planReveal', () => {
  const base = { seen: false, reducedMotion: false };
  it('subiu 2: a antiga é rank + trend (9º com +2 veio do 11º) e comemora', () => {
    const { plan, shouldMark } = planReveal({ ...base, rank: 9, trend: 2 });
    expect(plan).toEqual({ steps: [11, 10, 9], kind: 'up' });
    expect(shouldMark).toBe(true);
  });
  it('desceu 1: a antiga é rank + trend (4º com −1 veio do 3º)', () => {
    expect(planReveal({ ...base, rank: 4, trend: -1 }).plan).toEqual({
      steps: [3, 4],
      kind: 'down',
    });
  });
  it('manteve, sem comparação ou fora do ranking: nada, e nada para marcar', () => {
    for (const input of [
      { rank: 5, trend: 0 },
      { rank: 5, trend: null },
      { rank: null, trend: 2 },
    ]) {
      expect(planReveal({ ...base, ...input })).toEqual({ plan: null, shouldMark: false });
    }
  });
  it('já visto nesta rodada: nada', () => {
    expect(planReveal({ seen: true, reducedMotion: false, rank: 9, trend: 2 })).toEqual({
      plan: null,
      shouldMark: false,
    });
  });
  it('reduzir movimento: mostra direto o final, mas marca como visto', () => {
    expect(planReveal({ seen: false, reducedMotion: true, rank: 9, trend: 2 })).toEqual({
      plan: null,
      shouldMark: true,
    });
  });
});
