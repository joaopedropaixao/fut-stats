import type { RouteObject } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { lazyLoaders } from './preload';

describe('lazyLoaders', () => {
  it('junta o lazy de cada rota, também nas filhas, e ignora quem não tem lazy', () => {
    const a = vi.fn(async () => ({}));
    const b = vi.fn(async () => ({}));
    const routes: RouteObject[] = [
      { path: '/', lazy: a },
      { path: 'sem-lazy', element: null },
      { children: [{ path: 'filha', lazy: b }] },
    ];
    expect(lazyLoaders(routes)).toEqual([a, b]);
  });

  it('lista vazia não tem o que carregar', () => {
    expect(lazyLoaders([])).toEqual([]);
  });
});
