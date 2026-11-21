import type { PackCard } from './deck';

/**
 * Quem tem a tecla "Compartilhar" e quem tem o PNG. A regra mora só aqui (o `ShareButton` e o `renderCardPng` usam):
 * o Craque compartilha (inclusive sendo você) e a carta comum "Sua nota" também, menos para quem foi o **Perna de
 * Pau da rodada**: ele não compartilha a própria carta comum nessa rodada (decisão do dono, 20 nov 2026), e a carta do
 * Perna de Pau (madeira) nunca é compartilhável.
 */
export function canShareCard(card: PackCard): boolean {
  if (card.kind === 'flop') return false;
  if (card.kind === 'mine' && card.player.isFlop) return false;
  return true;
}
