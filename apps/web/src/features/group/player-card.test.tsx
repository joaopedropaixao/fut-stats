import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlayerCard } from './player-card';

const avatar = { skin: 'TAN', hair: 'SHORT', hairColor: 'BLACK' } as const;

describe('PlayerCard (ouro e amarelo)', () => {
  it('admin líder: o ADMIN é neutro, sem amarelo, e o ouro fica para o líder', () => {
    const html = renderToString(
      <PlayerCard
        nickname="Rafa"
        avatar={avatar}
        position="DEFENDER"
        isAdmin
        ranking={{ rank: 1, average: 8.8 }}
      />,
    );
    expect(html).toContain('text-gold');
    expect(html).not.toContain('text-accent');
    expect(html).not.toContain('bg-accent');
    expect(html).not.toContain('border-accent');
    expect(html).not.toContain('var(--color-accent)');
  });

  it('o ADMIN é neutro também sem ouro', () => {
    const html = renderToString(
      <PlayerCard nickname="Rafa" avatar={avatar} position="DEFENDER" isAdmin />,
    );
    expect(html).not.toContain('accent');
  });
});

describe('PlayerCard (moldura da faixa: C7 a C9)', () => {
  const render = (ranking?: { rank: number | null; average: number | null }) =>
    renderToString(
      <PlayerCard
        nickname="Jota"
        avatar={avatar}
        position="MIDFIELDER"
        isAdmin={false}
        ranking={ranking}
      />,
    );

  /** O bloco do apelido com a moldura: `<div ... card-frame ... data-tier="x">`. */
  const frame = (html: string) => /<div[^>]*card-frame[^>]*>/.exec(html)?.[0];

  it.each([
    [8.2, 1, 'gold', 'Ouro'],
    [6.5, 7, 'silver', 'Prata'],
    [5.4, 18, 'bronze', 'Bronze'],
  ] as const)(
    'C7: média %s (%sº no ranking) vira a moldura %s com a palavra %s',
    (average, rank, tier, word) => {
      const html = render({ rank, average });
      expect(frame(html)).toContain(`data-tier="${tier}"`);
      expect(html).toContain(`>${word}</span>`);
      // o apelido e a posição ficam dentro da moldura, na tinta da faixa
      expect(html).toContain('text-(--card-ink)');
      expect(html).toContain('text-(--card-ink-2)');
    },
  );

  it.each([
    [6.0, 'silver'],
    [8.0, 'gold'],
    [5.94, 'bronze'],
    [5.95, 'silver'],
    [7.94, 'silver'],
    [7.96, 'gold'],
  ] as const)(
    'C7: a faixa vale para a média como aparece (1 casa): %s cai em %s',
    (average, tier) => {
      expect(frame(render({ rank: 5, average }))).toContain(`data-tier="${tier}"`);
    },
  );

  it('C8: poucos jogos (rank nulo) fica neutra, sem faixa nem palavra', () => {
    const html = render({ rank: null, average: 9.1 });
    expect(html).not.toContain('card-frame');
    expect(html).not.toContain('data-tier');
    expect(html).not.toMatch(/>(Ouro|Prata|Bronze)</);
  });

  it('C8: sem média fica neutra', () => {
    const html = render({ rank: 3, average: null });
    expect(html).not.toContain('card-frame');
    expect(html).not.toContain('data-tier');
  });

  it('C8: sem ranking (figurinha sem placar) fica neutra', () => {
    const html = render(undefined);
    expect(html).not.toContain('card-frame');
    expect(html).not.toContain('data-tier');
  });

  it('C9: o pódio mantém a medalha na faixa de baixo, fora da moldura', () => {
    const html = render({ rank: 1, average: 8.8 });
    expect(frame(html)).toContain('data-tier="gold"');
    const strip = html.indexOf('<dl');
    // a faixa Ranking/Média vem depois do bloco da moldura e é neutra (sem card-frame)
    expect(strip).toBeGreaterThan(html.indexOf('card-frame'));
    expect(html.slice(strip)).not.toContain('card-frame');
    expect(html.slice(strip)).toContain('text-gold');
  });
});
