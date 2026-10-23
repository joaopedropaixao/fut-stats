import { describe, expect, it } from 'vitest';
import { isRoundPlayed, matchWinner, PLAYED_ROUND_STATUSES, roundResult } from './winner';

describe('matchWinner', () => {
  it('quem fez mais gols vence', () => {
    expect(matchWinner({ WHITE: 4, BLACK: 3 })).toBe('WHITE');
    expect(matchWinner({ WHITE: 0, BLACK: 1 })).toBe('BLACK');
  });

  it('placar igual é empate, inclusive 0 a 0', () => {
    expect(matchWinner({ WHITE: 2, BLACK: 2 })).toBe('DRAW');
    expect(matchWinner({ WHITE: 0, BLACK: 0 })).toBe('DRAW');
  });
});

describe('isRoundPlayed', () => {
  it('a partida começou: em jogo, votação ou encerrada', () => {
    expect(PLAYED_ROUND_STATUSES).toEqual(['IN_PROGRESS', 'VOTING', 'CLOSED']);
    expect(isRoundPlayed('IN_PROGRESS')).toBe(true);
    expect(isRoundPlayed('VOTING')).toBe(true);
    expect(isRoundPlayed('CLOSED')).toBe(true);
  });

  it('antes de começar não conta, mesmo com placar no banco', () => {
    expect(isRoundPlayed('SCHEDULED')).toBe(false);
    expect(isRoundPlayed('TEAMS_PUBLISHED')).toBe(false);
  });
});

describe('roundResult', () => {
  it('depois do jogo, o vencedor sai do placar', () => {
    expect(roundResult('VOTING', { WHITE: 3, BLACK: 1 })).toBe('WHITE');
    expect(roundResult('CLOSED', { WHITE: 2, BLACK: 2 })).toBe('DRAW');
  });

  it('em jogo, o placar é parcial: ninguém venceu ainda', () => {
    expect(roundResult('IN_PROGRESS', { WHITE: 2, BLACK: 0 })).toBeNull();
  });

  it('sem placar ou sem jogo, não há resultado', () => {
    expect(roundResult('CLOSED', null)).toBeNull();
    expect(roundResult('TEAMS_PUBLISHED', { WHITE: 1, BLACK: 0 })).toBeNull();
  });
});
