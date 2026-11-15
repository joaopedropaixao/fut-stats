import { describe, expect, it } from 'vitest';
import { buildDeck, hasPack } from './deck';
import { player, result } from './fixtures';
import { FLOP_PHRASES } from './impact-phrase';

const ronaldinho = player('a', 'Ronaldinho', 9.1, 1);
const zague = player('b', 'Zagueirão', 4.2, 9);
const eu = player('me', 'Dedé', 7.4, 3);

describe('cartas do pacote', () => {
  it('Craque, Perna de Pau e a sua carta, nesta ordem, cada uma com a faixa pela nota', () => {
    const deck = buildDeck(
      result({ mvps: [ronaldinho], flops: [zague], players: [ronaldinho, eu, zague] }),
    );
    expect(deck.map((c) => [c.kind, c.player.nickname, c.tier])).toEqual([
      ['craque', 'Ronaldinho', 'gold'],
      ['flop', 'Zagueirão', 'bronze'],
      ['mine', 'Dedé', 'silver'],
    ]);
    expect(deck[2]!.rank).toBe(3);
  });

  it('V1: o Craque leva a frase de impacto (vitória soma) e o Perna de Pau a piada estável; a sua carta não tem frase', () => {
    const craque = { ...ronaldinho, goals: 3 };
    const base = result({ mvps: [craque], flops: [zague], players: [craque, eu, zague] });
    const deck = buildDeck(base);
    expect(deck[0]!.phrase).toBe('Hat-trick e ainda levou a vitória');
    expect(FLOP_PHRASES).toContain(deck[1]!.phrase);
    expect(deck[2]!.phrase).toBeNull();
    // a mesma rodada e o mesmo jogador dão a mesma piada, e quem perdeu não soma a vitória
    expect(buildDeck(base)[1]!.phrase).toBe(deck[1]!.phrase);
    expect(buildDeck({ ...base, winner: 'BLACK' })[0]!.phrase).toBe('Hat-trick!');
    expect(buildDeck({ ...base, winner: 'DRAW' })[0]!.phrase).toBe('Hat-trick!');
  });

  it('C9: quem não jogou vê só Craque e Perna de Pau', () => {
    const deck = buildDeck(
      result({
        mvps: [ronaldinho],
        flops: [zague],
        players: [ronaldinho, zague],
        me: { membershipId: 'me', played: false },
      }),
    );
    expect(deck.map((c) => c.kind)).toEqual(['craque', 'flop']);
  });

  it('C10: o Craque sou eu: carta especial e sem a minha carta repetida', () => {
    const craqueEu = player('me', 'Dedé', 8.4, 1);
    const deck = buildDeck(
      result({ mvps: [craqueEu], flops: [zague], players: [craqueEu, zague] }),
    );
    expect(deck.map((c) => [c.kind, c.you])).toEqual([
      ['craque', true],
      ['flop', false],
    ]);
  });

  it('o Perna de Pau sou eu: leva o VOCÊ e não repete a minha carta', () => {
    const flopEu = player('me', 'Dedé', 4.0, 9);
    const deck = buildDeck(
      result({ mvps: [ronaldinho], flops: [flopEu], players: [ronaldinho, flopEu] }),
    );
    expect(deck.map((c) => [c.kind, c.you])).toEqual([
      ['craque', false],
      ['flop', true],
    ]);
  });

  it('C16: empate de Craque traz as duas cartas, antes do Perna de Pau', () => {
    const outro = player('c', 'Zé', 9.1, 1);
    const deck = buildDeck(
      result({
        mvps: [ronaldinho, outro],
        flops: [zague],
        players: [ronaldinho, outro, eu, zague],
      }),
    );
    expect(deck.map((c) => c.kind)).toEqual(['craque', 'craque', 'flop', 'mine']);
  });

  it('C17: sem Craque (ninguém votou) não há pacote', () => {
    const r = result({ voted: 0, players: [eu] });
    expect(buildDeck(r)).toEqual([]);
    expect(hasPack(r)).toBe(false);
  });

  it('minha carta sem nota não entra no pacote', () => {
    const semNota = player('me', 'Dedé', null, 0);
    const deck = buildDeck(result({ mvps: [ronaldinho], flops: [zague], players: [semNota] }));
    expect(deck.map((c) => c.kind)).toEqual(['craque', 'flop']);
  });

  it('C8: a faixa da minha carta muda nos cortes 6 e 8', () => {
    const tier = (score: number) =>
      buildDeck(result({ mvps: [ronaldinho], players: [player('me', 'Dedé', score, 2)] })).find(
        (c) => c.kind === 'mine',
      )!.tier;
    expect([tier(5.9), tier(6), tier(7.9), tier(8)]).toEqual([
      'bronze',
      'silver',
      'silver',
      'gold',
    ]);
  });
});
