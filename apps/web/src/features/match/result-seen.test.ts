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

describe('card de resultado visto por rodada e por jogador', () => {
  it('começa sem ter visto e lembra depois de marcar', () => {
    const storage = memory();
    expect(hasSeenResult('r1', 'm1', storage)).toBe(false);
    markResultSeen('r1', 'm1', storage);
    expect(hasSeenResult('r1', 'm1', storage)).toBe(true);
  });

  it('é por rodada: outra rodada toca de novo', () => {
    const storage = memory();
    markResultSeen('r1', 'm1', storage);
    expect(hasSeenResult('r2', 'm1', storage)).toBe(false);
  });

  it('é por jogador: no mesmo navegador, quem entra depois ainda vê o card (bug do YOU LOSE)', () => {
    const storage = memory();
    markResultSeen('r1', 'admin', storage);
    expect(hasSeenResult('r1', 'admin', storage)).toBe(true);
    expect(hasSeenResult('r1', 'jota', storage)).toBe(false);
    markResultSeen('r1', 'jota', storage);
    expect(hasSeenResult('r1', 'jota', storage)).toBe(true);
  });

  it('sem armazenamento não quebra: lê como não visto e marcar não faz nada', () => {
    expect(hasSeenResult('r1', 'm1', broken)).toBe(false);
    expect(() => markResultSeen('r1', 'm1', broken)).not.toThrow();
  });
});
