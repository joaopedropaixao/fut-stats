import { describe, expect, it } from 'vitest';
import { hasSeenVs, markVsSeen } from './vs-seen';

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

const broken = {
  getItem: () => {
    throw new Error('bloqueado');
  },
  setItem: () => {
    throw new Error('cheio');
  },
};

describe('VS visto por rodada', () => {
  it('começa sem ter visto e lembra depois de marcar', () => {
    const storage = memory();
    expect(hasSeenVs('r1', storage)).toBe(false);
    markVsSeen('r1', storage);
    expect(hasSeenVs('r1', storage)).toBe(true);
  });

  it('é por rodada: outra rodada toca de novo', () => {
    const storage = memory();
    markVsSeen('r1', storage);
    expect(hasSeenVs('r2', storage)).toBe(false);
  });

  it('sem armazenamento não quebra: lê como não visto e marcar não faz nada', () => {
    expect(hasSeenVs('r1', broken)).toBe(false);
    expect(() => markVsSeen('r1', broken)).not.toThrow();
  });
});
