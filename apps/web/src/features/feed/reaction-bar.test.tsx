import type { Post } from '@fut-stats/shared';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReactionBar } from './reaction-bar';

const post = {
  reactions: { BALL: 0, CATFISH: 3, OSS: 0, YELLOW_CARD: 0, POPCORN: 1 },
  myReaction: 'CATFISH',
} as unknown as Post;

describe('barra de reações (C36)', () => {
  const html = renderToString(<ReactionBar post={post} onReact={() => {}} />);

  it('mostra as 5 reações na ordem, com o nome só no title e sem texto visível', () => {
    const names = ['Bola', 'Bagre', 'OSS!', 'Cartão amarelo', 'Pipocou'];
    let last = -1;
    for (const name of names) {
      const at = html.indexOf(`title="${name}"`);
      expect(at).toBeGreaterThan(last);
      last = at;
      // o nome não aparece como texto visível (nem inteiro, nem a forma curta "Cartão")
      expect(html).not.toContain(`>${name}</`);
    }
    expect(html).not.toContain('>Cartão</');
  });

  it('o nome do leitor de tela diz o nome, quantas reações e a minha', () => {
    expect(html).toContain('aria-label="Bagre, 3 reações, a sua"');
    expect(html).toContain('aria-label="Pipocou, 1 reação"');
    expect(html).toContain('aria-pressed="true"');
  });

  it('o ✓ da minha reação fica em linha ao lado do contador, nunca solto por cima do ícone (OSS! é largo)', () => {
    for (const mine of ['BALL', 'OSS'] as const) {
      const out = renderToString(
        <ReactionBar post={{ ...post, myReaction: mine } as unknown as Post} onReact={() => {}} />,
      );
      // nenhum elemento posicionado por cima do botão: o antigo selo era `absolute top-0.5 right-0.5`
      expect(out).not.toContain('absolute');
      expect(out).not.toContain('top-0.5');
      // exatamente um ✓, dentro da linha do contador (depois dos dígitos, antes de fechar o botão)
      expect(out.match(/data-mine-check/g)).toHaveLength(1);
      const button = out.slice(out.indexOf(`<button`), out.length).split('</button>');
      const mineButton = button.find((b) => b.includes('data-mine-check'))!;
      expect(mineButton.indexOf('<svg')).toBeLessThan(mineButton.indexOf('data-mine-check'));
      expect(mineButton.indexOf('items-center justify-center gap-1')).toBeLessThan(
        mineButton.indexOf('data-mine-check'),
      );
    }
  });
});
