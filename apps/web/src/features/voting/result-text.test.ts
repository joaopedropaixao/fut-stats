import { describe, expect, it } from 'vitest';
import { statsText } from './result-text';

describe('o que o jogador fez na rodada', () => {
  it('gols e assistências, no singular e no plural', () => {
    expect(statsText({ goals: 2, assists: 1, ownGoals: 0 })).toBe('2 gols · 1 ast');
    expect(statsText({ goals: 1, assists: 0, ownGoals: 0 })).toBe('1 gol');
  });

  it('gol contra aparece escrito', () => {
    expect(statsText({ goals: 0, assists: 0, ownGoals: 1 })).toBe('1 gol contra');
    expect(statsText({ goals: 1, assists: 0, ownGoals: 2 })).toBe('1 gol · 2 gols contra');
  });

  it('sem nada, vazio', () => {
    expect(statsText({ goals: 0, assists: 0, ownGoals: 0 })).toBe('');
  });
});
