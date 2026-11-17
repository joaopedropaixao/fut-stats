import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ResultAlert } from './result-alert';

describe('aviso grande do resultado (C27, ouro de identidade e tecla amarela)', () => {
  const html = renderToString(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ResultAlert groupId="g1" roundId="r8" number={8} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

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
