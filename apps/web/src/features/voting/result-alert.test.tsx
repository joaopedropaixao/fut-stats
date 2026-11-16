import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ResultAlert } from './result-alert';

describe('aviso grande do resultado (C27, regra do ouro e do amarelo)', () => {
  const html = renderToString(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ResultAlert groupId="g1" roundId="r8" number={8} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  it('o rótulo da rodada e o traço do título são neutros: o ouro não compete com a tecla amarela', () => {
    expect(html).toContain('Rodada 8');
    expect(html).not.toContain('text-gold');
    expect(html).not.toContain('--color-gold');
    expect(html).toContain('--color-border-strong');
  });

  it('mantém o padrão de grande momento: contorno grosso, sombra dura e entrada animada', () => {
    expect(html).toContain('moment-frame');
    expect(html).toContain('animate-moment-in');
    expect(html).toContain('5px 5px 0 var(--color-shadow)');
  });
});
