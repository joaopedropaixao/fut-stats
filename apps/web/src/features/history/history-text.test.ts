import type { HistoryItem } from '@fut-stats/shared';
import { describe, expect, it } from 'vitest';
import { cardAriaLabel, detailResultText, formatLongDay, listResultText } from './history-text';

const base: HistoryItem = {
  roundId: 'r12',
  number: 12,
  // 17 de outubro de 2026 é sábado; meio-dia local não muda de dia em nenhum fuso comum
  scheduledAt: new Date(2026, 9, 17, 12, 0).toISOString(),
  location: null,
  status: 'CLOSED',
  score: { WHITE: 3, BLACK: 2 },
  winner: 'WHITE',
  me: { team: 'WHITE', result: 'WIN' },
};

describe('listResultText', () => {
  it('C14: vitória, derrota, empate e quem não jogou', () => {
    expect(listResultText({ team: 'WHITE', result: 'WIN' })).toEqual({
      kind: 'WIN',
      text: 'Você venceu',
    });
    expect(listResultText({ team: 'BLACK', result: 'LOSS' })).toEqual({
      kind: 'LOSS',
      text: 'Você perdeu',
    });
    expect(listResultText({ team: 'BLACK', result: 'DRAW' })).toEqual({
      kind: 'DRAW',
      text: 'Empate',
    });
    expect(listResultText(null)).toEqual({ kind: 'NONE', text: 'Você não jogou' });
  });
});

describe('detailResultText', () => {
  it('C18: vitória diz o placar começando pelo meu time', () => {
    expect(detailResultText({ team: 'WHITE', result: 'WIN' }, { WHITE: 3, BLACK: 2 })).toBe(
      'Você venceu 3 a 2 no Branco',
    );
    expect(detailResultText({ team: 'BLACK', result: 'WIN' }, { WHITE: 1, BLACK: 4 })).toBe(
      'Você venceu 4 a 1 no Preto',
    );
  });

  it('C18: derrota e empate', () => {
    expect(detailResultText({ team: 'BLACK', result: 'LOSS' }, { WHITE: 3, BLACK: 2 })).toBe(
      'Você perdeu 2 a 3 no Preto',
    );
    expect(detailResultText({ team: 'WHITE', result: 'DRAW' }, { WHITE: 2, BLACK: 2 })).toBe(
      'Empate em 2 a 2 no Branco',
    );
  });

  it('C18: quem não jogou', () => {
    expect(detailResultText(null, { WHITE: 3, BLACK: 2 })).toBe('Você não jogou esta partida');
  });
});

describe('cardAriaLabel', () => {
  it('C17: rodada, dia por extenso, placar e o meu resultado', () => {
    expect(cardAriaLabel(base)).toBe(
      'Rodada 12, sábado 17 de outubro, Branco 3, Preto 2, você venceu',
    );
  });

  it('C17: derrota, empate e não joguei', () => {
    expect(cardAriaLabel({ ...base, me: { team: 'WHITE', result: 'LOSS' } })).toMatch(
      /Branco 3, Preto 2, você perdeu$/,
    );
    expect(
      cardAriaLabel({
        ...base,
        score: { WHITE: 2, BLACK: 2 },
        winner: 'DRAW',
        me: { team: 'WHITE', result: 'DRAW' },
      }),
    ).toMatch(/Branco 2, Preto 2, empate$/);
    expect(cardAriaLabel({ ...base, me: null })).toMatch(/Branco 3, Preto 2, você não jogou$/);
  });

  it('C15: partida na Resenha ou na votação diz a etapa', () => {
    expect(cardAriaLabel({ ...base, status: 'POST_MATCH' })).toMatch(/, Resenha$/);
    expect(cardAriaLabel({ ...base, status: 'VOTING' })).toMatch(/, Votação$/);
  });
});

describe('formatLongDay', () => {
  it('escreve o dia da semana e o mês por extenso, no fuso do aparelho', () => {
    expect(formatLongDay(new Date(2026, 9, 17, 12))).toBe('sábado 17 de outubro');
    expect(formatLongDay(new Date(2026, 0, 4, 12))).toBe('domingo 4 de janeiro');
  });
});
