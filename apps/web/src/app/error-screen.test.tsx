import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './error-boundary';
import { ErrorScreen } from './error-screen';

vi.mock('./monitoring', () => ({ reportError: vi.fn() }));
const { reportError } = await import('./monitoring');

describe('ErrorScreen', () => {
  it('C17: título pixel, texto e a tecla Recarregar', () => {
    const html = renderToString(<ErrorScreen />);
    expect(html).toContain('Deu ruim aqui');
    expect(html).toContain('Já avisamos quem cuida do app. Tente recarregar.');
    expect(html).toContain('Recarregar');
    expect(html).toContain('<h1');
    expect(html).toContain('min-h-dvh');
    // a tecla tem 56 px de altura, acima dos 44 px de toque
    expect(html).toContain('min-h-14');
  });

  it('dentro do AppShell (embedded) é só o card, sem segunda janela inteira', () => {
    const html = renderToString(<ErrorScreen embedded />);
    expect(html).toContain('Recarregar');
    expect(html).not.toContain('min-h-dvh');
    expect(html).not.toContain('<main');
  });
});

describe('ErrorBoundary', () => {
  it('mostra a tela de erro geral e repassa o erro ao monitoramento', () => {
    expect(ErrorBoundary.getDerivedStateFromError()).toEqual({ failed: true });

    const boundary = new ErrorBoundary({ children: 'filho' });
    const error = new Error('quebrou');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    boundary.componentDidCatch(error);
    spy.mockRestore();
    expect(reportError).toHaveBeenCalledWith(error, { source: 'boundary' });

    boundary.state = { failed: true };
    expect(renderToString(<>{boundary.render()}</>)).toContain('Deu ruim aqui');
    boundary.state = { failed: false };
    expect(boundary.render()).toBe('filho');
  });
});
