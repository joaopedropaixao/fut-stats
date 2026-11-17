import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ResultAlert } from './result-alert';

const render = (hasPack?: boolean) =>
  renderToString(
    <MemoryRouter>
      <ResultAlert roundId="r8" number={8} hasPack={hasPack} />
    </MemoryRouter>,
  );

describe('aviso grande do resultado (ouro de identidade e tecla amarela)', () => {
  const html = render(false);

  it('a identidade é o ouro: moldura, faixa do cabeçalho e rótulo da rodada', () => {
    expect(html).toContain('Rodada 8');
    expect(html).toContain('border-color:var(--color-gold)');
    expect(html).toContain('bg-gold/14');
    expect(html).toContain('text-gold');
  });

  it('a tecla é a amarela e o ouro não vai nela', () => {
    expect(html).toContain('Ver resultado');
    expect(html).toContain('bg-accent');
    expect(html.match(/<a [^>]*bg-accent[^>]*>/)?.[0]).not.toContain('gold');
  });

  it('mantém o padrão de grande momento: contorno grosso, sombra dura e entrada animada', () => {
    expect(html).toContain('moment-frame');
    expect(html).toContain('animate-moment-in');
    expect(html).toContain('5px 5px 0 var(--color-shadow)');
  });
});

describe('aviso grande do resultado com o `hasPack` do aviso (C42)', () => {
  it('com pacote: miniatura do pacote e "Abrir pacote", sem buscar o resultado', () => {
    const html = render(true);
    expect(html).toContain('Abrir pacote');
    expect(html).toContain('animate-pack-wobble');
    expect(html).toContain('Quem foi o craque?');
    expect(html).toContain('href="/rodadas/r8/resultado"');
  });

  it('sem pacote: ícone e "Ver resultado"', () => {
    const html = render(false);
    expect(html).toContain('Ver resultado');
    expect(html).not.toContain('animate-pack-wobble');
  });

  it('aviso sem o campo (API antiga): não promete pacote', () => {
    expect(render(undefined)).toContain('Ver resultado');
  });
});
