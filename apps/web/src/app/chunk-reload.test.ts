import { describe, expect, it, vi } from 'vitest';
import { clearReloadMark, isChunkLoadError, reloadOnce } from './chunk-reload';

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe('isChunkLoadError', () => {
  it('reconhece a falha de import dinâmico dos três navegadores', () => {
    expect(
      isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /a.js')),
    ).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
  });

  it('não confunde com erro de código nem com valor que não é erro', () => {
    expect(isChunkLoadError(new Error('x is not a function'))).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError({ status: 404 })).toBe(false);
  });
});

describe('reloadOnce', () => {
  it('C10: recarrega na primeira falha e não recarrega de novo (sem laço)', () => {
    const storage = fakeStorage();
    const reload = vi.fn();
    expect(reloadOnce(reload, storage)).toBe(true);
    expect(reloadOnce(reload, storage)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('C10: a marca limpa quando a navegação dá certo e a próxima falha recarrega de novo', () => {
    const storage = fakeStorage();
    const reload = vi.fn();
    reloadOnce(reload, storage);
    clearReloadMark(storage);
    expect(reloadOnce(reload, storage)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('C10: sem storage disponível, não recarrega (evita laço)', () => {
    const reload = vi.fn();
    expect(reloadOnce(reload, null)).toBe(false);
    expect(
      reloadOnce(reload, {
        getItem: () => {
          throw new Error('bloqueado');
        },
        setItem: () => undefined,
        removeItem: () => undefined,
      }),
    ).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
