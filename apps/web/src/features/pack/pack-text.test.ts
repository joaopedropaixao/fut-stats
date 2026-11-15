import { describe, expect, it } from 'vitest';
import type { PackCard } from './deck';
import { cardAnnouncement, shareFileName, shareText } from './pack-text';
import { player } from './fixtures';

const card = (
  kind: PackCard['kind'],
  nickname: string,
  score: number,
  tier: PackCard['tier'],
  you = false,
  rank = 1,
): PackCard => ({
  kind,
  player: player('x', nickname, score, rank),
  score,
  tier,
  you,
  rank,
});

describe('textos do pacote', () => {
  it('C22: anuncia cada carta com a faixa por extenso', () => {
    expect(cardAnnouncement(card('craque', 'Ronaldinho', 9.1, 'gold'), 12)).toBe(
      'Craque da rodada 12: Ronaldinho, nota 9,1, ouro',
    );
    expect(cardAnnouncement(card('flop', 'Zagueirão', 4.2, 'bronze'), 12)).toBe(
      'Perna de pau: Zagueirão, nota 4,2, bronze',
    );
    expect(cardAnnouncement(card('mine', 'Dedé', 7.4, 'silver', true, 3), 12)).toBe(
      'Sua carta: nota 7,4, prata, 3º na rodada',
    );
  });

  it('C10: o Craque sendo você, o anúncio diz VOCÊ', () => {
    expect(cardAnnouncement(card('craque', 'Dedé', 8.4, 'gold', true), 12)).toBe(
      'Você é o craque da rodada 12: nota 8,4, ouro',
    );
  });

  it('C19: textos do Compartilhar', () => {
    expect(shareText(card('craque', 'Ronaldinho', 9.1, 'gold'), 12)).toBe(
      'Craque da rodada 12: Ronaldinho, nota 9,1',
    );
    expect(shareText(card('mine', 'Dedé', 7.4, 'silver', true, 3), 12)).toBe(
      'Minha nota na rodada 12: 7,4 (prata)',
    );
  });

  it('nome do arquivo da imagem', () => {
    expect(shareFileName(card('mine', 'Dedé', 7.4, 'silver'), 12)).toBe(
      'fut-stats-rodada-12-minha-carta.png',
    );
    expect(shareFileName(card('craque', 'Ronaldinho', 9.1, 'gold'), 12)).toBe(
      'fut-stats-rodada-12-craque.png',
    );
  });
});
