import { describe, expect, it } from 'vitest';
import { hasSeenResult, markResultSeen } from './result-seen';

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

describe('card de resultado visto por rodada', () => {
  it('começa sem ter visto e lembra depois de marcar', () => {
    const storage = memory();
    expect(hasSeenResult('r1', storage)).toBe(false);
    markResultSeen('r1', storage);
    expect(hasSeenResult('r1', storage)).toBe(true);
  });

  it('é por rodada: outra rodada toca de novo', () => {
    const storage = memory();
    markResultSeen('r1', storage);
    expect(hasSeenResult('r2', storage)).toBe(false);
  });

  it('sem armazenamento não quebra: lê como não visto e marcar não faz nada', () => {
    expect(hasSeenResult('r1', broken)).toBe(false);
    expect(() => markResultSeen('r1', broken)).not.toThrow();
  });
});
