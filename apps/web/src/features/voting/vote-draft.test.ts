import { describe, expect, it } from 'vitest';
import { clearDraft, loadDraft, saveDraft } from './vote-draft';
import { flowReducer, initFlow } from './vote-flow';

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const broken = {
  getItem: () => {
    throw new Error('bloqueado');
  },
  setItem: () => {
    throw new Error('cheio');
  },
  removeItem: () => {
    throw new Error('bloqueado');
  },
};

const IDS = ['a', 'b', 'c'];

describe('rascunho do voto no aparelho', () => {
  it('volta no jogador em que parou, com as notas já dadas', () => {
    const storage = memory();
    const state = [
      { type: 'rate', targetId: 'a', value: 7 },
      { type: 'next' },
      { type: 'rate', targetId: 'b', value: 4.5 },
      { type: 'next' },
    ].reduce((s, a) => flowReducer(s, a as Parameters<typeof flowReducer>[1]), initFlow(IDS));
    saveDraft('r1', 'm1', state, storage);
    const restored = loadDraft('r1', 'm1', IDS, storage);
    expect(restored).toMatchObject({ step: 'rate', index: 2, ratings: { a: 7, b: 4.5 } });
  });

  it('é por rodada e por jogador', () => {
    const storage = memory();
    saveDraft('r1', 'm1', initFlow(IDS), storage);
    expect(loadDraft('r2', 'm1', IDS, storage)).toBeNull();
    expect(loadDraft('r1', 'm2', IDS, storage)).toBeNull();
  });

  it('descartar apaga o rascunho', () => {
    const storage = memory();
    saveDraft('r1', 'm1', initFlow(IDS), storage);
    clearDraft('r1', 'm1', storage);
    expect(loadDraft('r1', 'm1', IDS, storage)).toBeNull();
  });

  it('confere com quem joga hoje: nota de quem saiu e valor inválido caem fora', () => {
    const storage = memory();
    storage.setItem(
      'fut-stats:voto-rascunho:r1:m1',
      JSON.stringify({
        step: 'review',
        index: 9,
        ratings: { a: 7, b: 7.3, gone: 5, c: 11 },
        mvpId: 'gone',
        flopId: null,
        backToReview: false,
      }),
    );
    const restored = loadDraft('r1', 'm1', IDS, storage)!;
    expect(restored.ratings).toEqual({ a: 7 });
    // faltam notas: recua para o passo das notas, no primeiro jogador sem nota
    expect(restored).toMatchObject({ step: 'rate', index: 1, mvpId: null });
  });

  it('rascunho ilegível ou sem armazenamento vira "sem rascunho", sem quebrar', () => {
    const storage = memory();
    storage.setItem('fut-stats:voto-rascunho:r1:m1', '{ não é json');
    expect(loadDraft('r1', 'm1', IDS, storage)).toBeNull();
    expect(loadDraft('r1', 'm1', IDS, broken)).toBeNull();
    expect(() => saveDraft('r1', 'm1', initFlow(IDS), broken)).not.toThrow();
    expect(() => clearDraft('r1', 'm1', broken)).not.toThrow();
  });
});
