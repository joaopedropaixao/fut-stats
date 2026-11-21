import { cardTier } from '@fut-stats/shared';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { player } from '../pack/fixtures';
import { CraqueCard } from './craque-card';

const html = (score: number, extra: Partial<Parameters<typeof CraqueCard>[0]> = {}) =>
  renderToString(
    <CraqueCard
      player={player('c1', 'Felipinho', score)}
      tier={cardTier(score)}
      roundNumber={8}
      stats
      {...extra}
    />,
  );

/** Tira só o que muda com a nota e a faixa (data-tier, a nota, o rótulo e a cor do selo), para comparar a moldura. */
const frameOf = (out: string) =>
  out
    .replace(/data-tier="[a-z]+"/g, '')
    .replace(/aria-label="[^"]*"/g, '')
    .replace(/<path[^>]*d="[^"]*"[^>]*><\/path>/g, '<path/>')
    .replace(/>(Bronze|Prata|Ouro)</g, '>SELO<');

describe('carta do Craque com a moldura Lenda (C23)', () => {
  it('bronze, prata e ouro usam a mesma moldura: só muda o selo da faixa', () => {
    const [bronze, silver, gold] = [5.8, 7.2, 9.1].map((s) => html(s));
    expect(bronze).toContain('data-legend');
    expect(bronze).toContain('legend-frame');
    expect(bronze).toContain('legend-gold');
    expect(bronze).toContain('>Bronze<');
    expect(silver).toContain('>Prata<');
    expect(gold).toContain('>Ouro<');
    expect(frameOf(silver!) === frameOf(bronze!)).toBe(true);
    expect(frameOf(gold!) === frameOf(bronze!)).toBe(true);
  });

  it('o selo é escuro (aguenta o dourado) e é só decoração: aria-hidden, com a faixa por escrito no nome da carta', () => {
    const out = html(9.1);
    expect(out).toMatch(/<span aria-hidden="true" class="[^"]*bg-team-black[^"]*text-\(--seal\)/);
    expect(out).toContain('aria-label="Craque da rodada 8: Felipinho"');
  });

  it('a carta acesa usa a tinta quase preta e nunca a faixa clara das outras cartas', () => {
    const out = html(9.1);
    expect(out).toContain('data-lit');
    expect(out).not.toContain('card-frame');
  });

  it('no walkout, antes do rosto, a carta fica apagada: sem moldura dourada, sem selo e sem enfeites', () => {
    const out = html(9.1, { clues: { team: true, position: true, rating: 9.1, face: false } });
    expect(out).not.toContain('data-lit');
    expect(out).not.toContain('legend-gold');
    expect(out).not.toContain('>Ouro<');
    expect(out).not.toContain('legend-friso');
  });

  it('com o rosto, a moldura acende junto com o selo', () => {
    const out = html(9.1, { clues: { team: true, position: true, rating: 9.1, face: true } });
    expect(out).toContain('data-lit');
    expect(out).toContain('legend-gold');
    expect(out).toContain('>Ouro<');
  });

  it('o Craque sou eu: contorno creme da carta especial, VOCÊ na tira e o selo mais abaixo', () => {
    const me = html(9.1, { special: true });
    expect(me).toContain('data-special');
    expect(me).toContain('top-[112px]');
    expect(me).toContain('>Você<');
    const other = html(9.1);
    expect(other).toContain('top-[96px]');
    expect(other).not.toContain('data-special');
  });
});
