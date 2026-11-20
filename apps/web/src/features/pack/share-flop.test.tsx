import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PackCard } from './deck';
import { player } from './fixtures';
import { ShareButton } from './share-button';
import { renderCardPng } from './share-card';

const flop: PackCard = {
  kind: 'flop',
  player: player('f', 'Dudu', 5.7),
  score: 5.7,
  tier: 'bronze',
  you: false,
  rank: null,
  phrase: 'O pé tava torto',
};

describe('o Perna de pau não é compartilhável', () => {
  it('a tecla Compartilhar não aparece para a carta dele', () => {
    expect(renderToString(<ShareButton card={flop} roundNumber={8} />)).toBe('');
    expect(
      renderToString(<ShareButton card={{ ...flop, kind: 'craque' }} roundNumber={8} />),
    ).toContain('Compartilhar');
  });

  it('o PNG recusa a carta dele (não sai uma imagem sem a moldura de madeira)', async () => {
    await expect(renderCardPng(flop, 8)).rejects.toThrow(/não é compartilhável/);
  });
});
