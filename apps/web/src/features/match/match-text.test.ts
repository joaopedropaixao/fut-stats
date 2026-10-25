import { describe, expect, it } from 'vitest';
import { eventNoticeTitle, goalsOfScore, resultAnnouncement } from './match-text';

describe('goalsOfScore', () => {
  it('mostra quantos gols têm autor perto do placar do time', () => {
    expect(goalsOfScore(2, 3)).toBe('2 de 3 gols');
    expect(goalsOfScore(0, 1)).toBe('0 de 1 gol');
  });

  it('sem placar lançado, só a contagem', () => {
    expect(goalsOfScore(1, undefined)).toBe('1 gol');
    expect(goalsOfScore(2, undefined)).toBe('2 gols');
  });
});

describe('resultAnnouncement', () => {
  it('começa pelo placar do time de quem vê', () => {
    expect(resultAnnouncement('WIN', { WHITE: 3, BLACK: 2 }, 'WHITE')).toBe('Você venceu 3 a 2');
    expect(resultAnnouncement('LOSS', { WHITE: 3, BLACK: 2 }, 'BLACK')).toBe('Você perdeu 2 a 3');
    expect(resultAnnouncement('DRAW', { WHITE: 2, BLACK: 2 }, 'WHITE')).toBe('Empate em 2 a 2');
  });
});

describe('eventNoticeTitle', () => {
  it('assistência concorda no feminino', () => {
    expect(eventNoticeTitle('ASSIST', 'Diegão', 'launched')).toBe('Assistência de Diegão lançada');
    expect(eventNoticeTitle('ASSIST', 'Diegão', 'removed')).toBe('Assistência de Diegão apagada');
  });

  it('gol e gol contra ficam no masculino', () => {
    expect(eventNoticeTitle('GOAL', 'Diegão', 'launched')).toBe('Gol de Diegão lançado');
    expect(eventNoticeTitle('GOAL', 'Diegão', 'removed')).toBe('Gol de Diegão apagado');
    expect(eventNoticeTitle('OWN_GOAL', 'Diegão', 'launched')).toBe('Gol contra de Diegão lançado');
    expect(eventNoticeTitle('OWN_GOAL', 'Diegão', 'removed')).toBe('Gol contra de Diegão apagado');
  });

  it('o lance de quem lança vem em primeira pessoa, concordando também', () => {
    expect(eventNoticeTitle('ASSIST', null, 'launched')).toBe('Sua assistência lançada');
    expect(eventNoticeTitle('GOAL', null, 'launched')).toBe('Seu gol lançado');
    expect(eventNoticeTitle('OWN_GOAL', null, 'removed')).toBe('Seu gol contra apagado');
  });
});
