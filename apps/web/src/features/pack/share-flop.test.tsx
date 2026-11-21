import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PackCard } from './deck';
import { player } from './fixtures';
import { ShareButton } from './share-button';
import { renderCardPng } from './share-card';
import { canShareCard } from './share-rule';

const card = (kind: PackCard['kind'], isFlop = false, you = false): PackCard => ({
  kind,
  player: { ...player('p', 'Dudu', 5.7), isFlop },
  score: 5.7,
  tier: 'bronze',
  you,
  rank: kind === 'mine' ? 9 : null,
  phrase: kind === 'mine' ? null : 'Jogou demais',
});

const button = (c: PackCard) => renderToString(<ShareButton card={c} roundNumber={8} />);

describe('quem compartilha a carta (C37)', () => {
  it('a carta do Perna de pau (madeira) nunca é compartilhável', () => {
    expect(canShareCard(card('flop', true))).toBe(false);
    expect(button(card('flop', true))).toBe('');
  });

  it('quem foi o Perna de pau da rodada não vê "Compartilhar minha carta" na carta comum', () => {
    const mine = card('mine', true, true);
    expect(canShareCard(mine)).toBe(false);
    expect(button(mine)).toBe('');
  });

  it('um jogador comum vê "Compartilhar minha carta"', () => {
    const mine = card('mine', false, true);
    expect(canShareCard(mine)).toBe(true);
    expect(button(mine)).toContain('Compartilhar minha carta');
  });

  it('o Craque compartilha, inclusive quando sou eu', () => {
    for (const you of [false, true]) {
      const craque = card('craque', false, you);
      expect(canShareCard(craque)).toBe(true);
      expect(button(craque)).toContain('Compartilhar');
    }
  });

  it('o PNG também recusa as cartas que não se compartilham', async () => {
    await expect(renderCardPng(card('flop', true), 8)).rejects.toThrow(/não é compartilhável/);
    await expect(renderCardPng(card('mine', true, true), 8)).rejects.toThrow(
      /não é compartilhável/,
    );
  });
});
