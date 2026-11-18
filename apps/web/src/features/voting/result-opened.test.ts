import { describe, expect, it } from 'vitest';
import { hasOpenedResult, markResultOpened } from './result-opened';

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

describe('resultado aberto por rodada e por jogador', () => {
  it('começa sem ter aberto e lembra depois de marcar', () => {
    const storage = memory();
    expect(hasOpenedResult('r1', 'm1', storage)).toBe(false);
    markResultOpened('r1', 'm1', storage);
    expect(hasOpenedResult('r1', 'm1', storage)).toBe(true);
  });

  it('é por rodada: outra rodada continua em destaque', () => {
    const storage = memory();
    markResultOpened('r1', 'm1', storage);
    expect(hasOpenedResult('r2', 'm1', storage)).toBe(false);
  });

  it('é por jogador: o mesmo aparelho serve a mais de um', () => {
    const storage = memory();
    markResultOpened('r1', 'm1', storage);
    expect(hasOpenedResult('r1', 'm2', storage)).toBe(false);
  });

  it('sem armazenamento, nada quebra: lê como não aberto', () => {
    expect(() => markResultOpened('r1', 'm1', broken)).not.toThrow();
    expect(hasOpenedResult('r1', 'm1', broken)).toBe(false);
  });
});
