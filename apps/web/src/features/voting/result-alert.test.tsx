import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ResultLine } from './result-alert';

describe('linha do resultado já aberto (C55)', () => {
  const html = renderToString(
    <MemoryRouter>
      <ResultLine roundId="r8" number={8} />
    </MemoryRouter>,
  );

  it('leva ao resultado da rodada e diz o número no nome acessível', () => {
    expect(html).toContain('href="/rodadas/r8/resultado"');
    expect(html).toContain('aria-label="Resultado da rodada 8"');
  });

  it('"Resultado" e "Rodada 8" ficam em textos separados que não quebram linha: o número não cai sozinho', () => {
    // PixelText sem `wrap` usa whitespace-nowrap; o contêiner não tem flex-wrap
    expect(html.match(/whitespace-nowrap/g)).toHaveLength(2);
    expect(html).not.toContain('flex-wrap');
  });
});
