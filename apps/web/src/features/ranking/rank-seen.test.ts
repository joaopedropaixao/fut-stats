import { describe, expect, it } from 'vitest';
import { hasSeenRanking, markRankingSeen } from './rank-seen';

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

describe('animação do ranking vista por jogador e por rodada', () => {
  it('começa sem ter visto e lembra depois de marcar', () => {
    const storage = memory();
    expect(hasSeenRanking('m1', 9, storage)).toBe(false);
    markRankingSeen('m1', 9, storage);
    expect(hasSeenRanking('m1', 9, storage)).toBe(true);
  });

  it('rodada nova (mais uma encerrada) toca de novo', () => {
    const storage = memory();
    markRankingSeen('m1', 9, storage);
    expect(hasSeenRanking('m1', 10, storage)).toBe(false);
  });

  it('é por jogador: no mesmo navegador, quem entra depois ainda vê a animação', () => {
    const storage = memory();
    markRankingSeen('admin', 9, storage);
    expect(hasSeenRanking('admin', 9, storage)).toBe(true);
    expect(hasSeenRanking('jota', 9, storage)).toBe(false);
  });

  it('sem armazenamento não quebra: lê como não visto e marcar não faz nada', () => {
    expect(hasSeenRanking('m1', 9, broken)).toBe(false);
    expect(() => markRankingSeen('m1', 9, broken)).not.toThrow();
  });
});
