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

  it('mostra as 5 reações na ordem, com o nome curto visível e no title', () => {
    const names = ['Bola', 'Bagre', 'OSS!', 'Cartão amarelo', 'Pipocou'];
    let last = -1;
    for (const name of names) {
      expect(html).toContain(`title="${name}"`);
      const at = html.indexOf(`>${name}</span>`);
      expect(at).toBeGreaterThan(last);
      last = at;
    }
  });

  it('o nome do leitor de tela diz o nome, quantas reações e a minha', () => {
    expect(html).toContain('aria-label="Bagre, 3 reações, a sua"');
    expect(html).toContain('aria-label="Pipocou, 1 reação"');
    expect(html).toContain('aria-pressed="true"');
  });
});
