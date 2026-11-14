import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { RouteFallback } from './route-fallback';

// A barra de abas usa o estado de navegação do router, então o fallback precisa de um data router em volta
function render(element: ReactElement) {
  const router = createMemoryRouter([{ path: '/', element }]);
  return renderToString(<RouterProvider router={router} />);
}

describe('RouteFallback', () => {
  it('sem abas (entrar, convite e começar): só o esqueleto, sem a barra de abas', () => {
    const html = render(<RouteFallback />);
    expect(html).toContain('aria-label="Carregando"');
    expect(html).not.toContain('<nav');
    expect(html).not.toContain('href="/times"');
  });

  it('com abas (rotas do AppShell): o esqueleto vem com a barra de abas', () => {
    const html = render(<RouteFallback tabs />);
    expect(html).toContain('aria-label="Carregando"');
    expect(html).toContain('<nav');
    expect(html).toContain('href="/times"');
  });
});
