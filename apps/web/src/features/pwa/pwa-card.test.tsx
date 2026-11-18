import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Switch } from '../../components/ui/switch';
import { PwaCard } from './pwa-card';

describe('PwaCard (C22, C26, C39): grande momento', () => {
  const html = renderToString(
    <PwaCard title="Avisos" mark={<span>marca</span>} delay={120}>
      <p>corpo</p>
    </PwaCard>,
  );

  it('contorno grosso, sombra dura e entrada animada, escalonada pelo atraso', () => {
    expect(html).toContain('moment-frame');
    expect(html).toContain('animate-moment-in');
    expect(html).toContain('--moment-delay:120ms');
  });

  it('o título é um h2 que nomeia a seção, e o ouro e o amarelo não entram na moldura', () => {
    expect(html).toMatch(/<section aria-labelledby="([^"]+)"/);
    expect(html).toContain('<h2');
    expect(html).not.toContain('bg-accent');
    expect(html).not.toContain('gold');
  });
});

describe('Switch carregando (C39)', () => {
  const render = (loading: boolean) =>
    renderToString(
      <Switch
        label="Avisos neste celular"
        checked={false}
        onCheckedChange={() => {}}
        loading={loading}
      />,
    );

  it('trava o toque, avisa o leitor de tela e mostra a rodinha', () => {
    const html = render(true);
    expect(html).toContain('aria-busy="true"');
    expect(html).toMatch(/<button[^>]*disabled/);
    expect(html).toContain('animate-spin');
  });

  it('com o rótulo de espera, escreve "Ligando…" no lugar de "Desligado"', () => {
    const html = renderToString(
      <Switch
        label="Avisos neste celular"
        checked={false}
        onCheckedChange={() => {}}
        loading
        loadingLabel="Ligando…"
      />,
    );
    expect(html).toContain('Ligando…');
    expect(html).not.toContain('Desligado');
    expect(html).toContain('animate-spin');
  });

  it('o rótulo de espera só vale carregando: parado volta ao estado escrito', () => {
    const html = renderToString(
      <Switch
        label="Avisos neste celular"
        checked={false}
        onCheckedChange={() => {}}
        loadingLabel="Ligando…"
      />,
    );
    expect(html).toContain('Desligado');
    expect(html).not.toContain('Ligando…');
  });

  it('parado: sem rodinha e com a área de 80 x 48', () => {
    const html = render(false);
    expect(html).not.toContain('animate-spin');
    expect(html).toContain('h-12 w-20');
  });
});
