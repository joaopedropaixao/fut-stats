import { describe, expect, it } from 'vitest';
import { round as baseRound } from './fixtures.test-utils';
import {
  canLaunchMatchEvent,
  validateMatchEvent,
  validateMatchEventRemoval,
  validateScoreEntry,
  type RoundActor,
} from './events';
import type { MatchEvent } from './match';
import { ROUND_STATUSES } from './status';
import type { RoundState } from './match';

/** Na Resenha pós-jogo o jogador lança os próprios lances; é o status padrão destes testes. */
const round = (overrides: Partial<RoundState> = {}): RoundState =>
  baseRound({ status: 'POST_MATCH', ...overrides });

const player: RoundActor = { id: 'w7', isAdmin: false };
const admin: RoundActor = { id: 'w1', isAdmin: true };
const goal = (playerId: string): MatchEvent => ({ playerId, type: 'GOAL' });

describe('validateMatchEvent', () => {
  it('jogador lança o próprio gol, assistência e gol contra', () => {
    for (const type of ['GOAL', 'ASSIST', 'OWN_GOAL'] as const) {
      expect(validateMatchEvent({ playerId: 'w7', type }, player, round())).toEqual([]);
    }
  });

  it('jogador não lança lance de outro', () => {
    expect(validateMatchEvent(goal('w6'), player, round())).toEqual(['NOT_OWN_EVENT']);
  });

  it('admin lança de qualquer um, dos dois times', () => {
    expect(validateMatchEvent(goal('b7'), admin, round())).toEqual([]);
  });

  it('reserva também jogou', () => {
    expect(validateMatchEvent(goal('w8'), admin, round())).toEqual([]);
  });

  it('o alvo tem que ter jogado, mesmo para o admin', () => {
    expect(validateMatchEvent(goal('x'), admin, round())).toEqual(['PLAYER_DID_NOT_PLAY']);
  });

  it('jogador que não jogou lançando por outro que não jogou: lista os dois', () => {
    expect(validateMatchEvent(goal('y'), { id: 'x', isAdmin: false }, round())).toEqual([
      'NOT_OWN_EVENT',
      'PLAYER_DID_NOT_PLAY',
    ]);
  });

  it('C9: congela na votação e fora do jogo; só esse motivo', () => {
    const open = ROUND_STATUSES.filter(
      (status) => validateMatchEvent(goal('w7'), admin, round({ status })).length === 0,
    );
    expect(open).toEqual(['IN_PROGRESS', 'POST_MATCH']);
    for (const status of ['SCHEDULED', 'TEAMS_PUBLISHED', 'VOTING', 'CLOSED'] as const) {
      expect(validateMatchEvent(goal('x'), player, round({ status }))).toEqual(['ROUND_NOT_OPEN']);
    }
  });

  it('C6: durante o jogo só o admin lança, até o próprio lance do jogador', () => {
    const inGame = round({ status: 'IN_PROGRESS' });
    for (const type of ['GOAL', 'ASSIST', 'OWN_GOAL'] as const) {
      expect(validateMatchEvent({ playerId: 'w7', type }, player, inGame)).toEqual([
        'ADMIN_ONLY_IN_MATCH',
      ]);
    }
    expect(validateMatchEvent(goal('w6'), player, inGame)).toEqual(['ADMIN_ONLY_IN_MATCH']);
    expect(validateMatchEvent(goal('w7'), admin, inGame)).toEqual([]);
    expect(validateMatchEvent(goal('b7'), admin, inGame)).toEqual([]);
  });

  it('C7: na Resenha o jogador lança os 3 tipos do próprio; de outro, NOT_OWN_EVENT', () => {
    for (const type of ['GOAL', 'ASSIST', 'OWN_GOAL'] as const) {
      expect(validateMatchEvent({ playerId: 'w7', type }, player, round())).toEqual([]);
      expect(validateMatchEvent({ playerId: 'w6', type }, player, round())).toEqual([
        'NOT_OWN_EVENT',
      ]);
    }
  });

  it('C8: gol contra do Branco conta para o Preto, que já está cheio no placar', () => {
    const state = round({ score: { WHITE: 2, BLACK: 1 }, events: [goal('b7')] });
    expect(validateMatchEvent({ playerId: 'w7', type: 'OWN_GOAL' }, player, state)).toEqual([
      'GOALS_EXCEED_SCORE',
    ]);
  });

  describe('com placar lançado', () => {
    const score = { WHITE: 1, BLACK: 1 };

    it('gol não passa do placar do time', () => {
      expect(validateMatchEvent(goal('w7'), admin, round({ score }))).toEqual([]);
      expect(validateMatchEvent(goal('w6'), admin, round({ score, events: [goal('w7')] }))).toEqual(
        ['GOALS_EXCEED_SCORE'],
      );
    });

    it('gol contra conta no placar do adversário', () => {
      const ownGoal: MatchEvent = { playerId: 'w2', type: 'OWN_GOAL' };
      expect(validateMatchEvent(ownGoal, admin, round({ score }))).toEqual([]);
      expect(validateMatchEvent(ownGoal, admin, round({ score, events: [goal('b7')] }))).toEqual([
        'GOALS_EXCEED_SCORE',
      ]);
      expect(validateMatchEvent(goal('b7'), admin, round({ score, events: [ownGoal] }))).toEqual([
        'GOALS_EXCEED_SCORE',
      ]);
    });

    it('assistências do time não passam dos gols do time no placar', () => {
      const assist: MatchEvent = { playerId: 'w6', type: 'ASSIST' };
      expect(validateMatchEvent(assist, admin, round({ score }))).toEqual([]);
      expect(validateMatchEvent(assist, admin, round({ score, events: [assist] }))).toEqual([
        'ASSISTS_EXCEED_SCORE',
      ]);
      expect(validateMatchEvent(assist, admin, round({ score: { WHITE: 0, BLACK: 3 } }))).toEqual([
        'ASSISTS_EXCEED_SCORE',
      ]);
    });
  });

  it('sem placar, não há limite', () => {
    const events = [goal('w7'), goal('w7'), goal('w7')];
    expect(validateMatchEvent(goal('w7'), player, round({ events }))).toEqual([]);
  });
});

describe('canLaunchMatchEvent', () => {
  it('é a versão sim/não de validateMatchEvent', () => {
    expect(canLaunchMatchEvent(goal('w7'), player, round())).toBe(true);
    expect(canLaunchMatchEvent(goal('w6'), player, round())).toBe(false);
  });
});

describe('validateMatchEventRemoval', () => {
  it('jogador apaga só os próprios; admin, qualquer um', () => {
    expect(validateMatchEventRemoval(goal('w7'), player, round())).toEqual([]);
    expect(validateMatchEventRemoval(goal('w6'), player, round())).toEqual(['NOT_OWN_EVENT']);
    expect(validateMatchEventRemoval(goal('b7'), admin, round())).toEqual([]);
  });

  it('pode apagar mesmo que tire o placar do lugar (o fechamento confere)', () => {
    const state = round({ score: { WHITE: 1, BLACK: 0 }, events: [goal('w7')] });
    expect(validateMatchEventRemoval(goal('w7'), player, state)).toEqual([]);
  });

  it('C9: só em jogo e na Resenha; votação e encerrada congelam', () => {
    for (const status of ['SCHEDULED', 'TEAMS_PUBLISHED', 'VOTING', 'CLOSED'] as const) {
      expect(validateMatchEventRemoval(goal('w7'), admin, round({ status }))).toEqual([
        'ROUND_NOT_OPEN',
      ]);
    }
  });

  it('C6: durante o jogo jogador comum não apaga nem o próprio; admin apaga', () => {
    const inGame = round({ status: 'IN_PROGRESS' });
    expect(validateMatchEventRemoval(goal('w7'), player, inGame)).toEqual(['ADMIN_ONLY_IN_MATCH']);
    expect(validateMatchEventRemoval(goal('w7'), admin, inGame)).toEqual([]);
  });

  it('C7: na Resenha o jogador apaga o próprio GOAL, ASSIST ou OWN_GOAL, não o de outro', () => {
    for (const type of ['GOAL', 'ASSIST', 'OWN_GOAL'] as const) {
      expect(validateMatchEventRemoval({ playerId: 'w7', type }, player, round())).toEqual([]);
      expect(validateMatchEventRemoval({ playerId: 'w6', type }, player, round())).toEqual([
        'NOT_OWN_EVENT',
      ]);
    }
  });
});

describe('validateScoreEntry', () => {
  it('C10: admin lança e corrige o placar em jogo e na Resenha; abaixo dos gols, SCORE_BELOW_GOALS', () => {
    const events = [goal('w7'), goal('w6')];
    expect(validateScoreEntry({ WHITE: 1, BLACK: 0 }, admin, round({ events }))).toEqual([
      'SCORE_BELOW_GOALS',
    ]);
    for (const status of ['IN_PROGRESS', 'POST_MATCH'] as const) {
      expect(validateScoreEntry({ WHITE: 2, BLACK: 1 }, admin, round({ status }))).toEqual([]);
    }
  });

  it('C9: fora disso (inclusive votação), só esse motivo', () => {
    for (const status of ['SCHEDULED', 'TEAMS_PUBLISHED', 'VOTING', 'CLOSED'] as const) {
      expect(validateScoreEntry({ WHITE: -1, BLACK: 1 }, player, round({ status }))).toEqual([
        'ROUND_NOT_OPEN',
      ]);
    }
  });

  it('só admin lança placar', () => {
    expect(validateScoreEntry({ WHITE: 2, BLACK: 1 }, player, round())).toEqual(['NOT_ADMIN']);
  });

  it('placar inválido', () => {
    expect(validateScoreEntry({ WHITE: 1.5, BLACK: 1 }, admin, round())).toEqual(['INVALID_SCORE']);
  });

  it('placar não fica abaixo dos gols já lançados (gol contra conta para o adversário)', () => {
    const events: MatchEvent[] = [goal('w7'), goal('w6'), { playerId: 'w2', type: 'OWN_GOAL' }];
    expect(validateScoreEntry({ WHITE: 2, BLACK: 1 }, admin, round({ events }))).toEqual([]);
    expect(validateScoreEntry({ WHITE: 1, BLACK: 1 }, admin, round({ events }))).toEqual([
      'SCORE_BELOW_GOALS',
    ]);
    expect(validateScoreEntry({ WHITE: 2, BLACK: 0 }, admin, round({ events }))).toEqual([
      'SCORE_BELOW_GOALS',
    ]);
  });

  it('placar não fica abaixo das assistências já lançadas', () => {
    const events: MatchEvent[] = [
      { playerId: 'b6', type: 'ASSIST' },
      { playerId: 'b5', type: 'ASSIST' },
    ];
    expect(validateScoreEntry({ WHITE: 0, BLACK: 1 }, admin, round({ events }))).toEqual([
      'SCORE_BELOW_ASSISTS',
    ]);
  });

  it('não-admin com placar inválido: lista os dois', () => {
    expect(validateScoreEntry({ WHITE: -1, BLACK: 0 }, player, round())).toEqual([
      'NOT_ADMIN',
      'INVALID_SCORE',
    ]);
  });
});
