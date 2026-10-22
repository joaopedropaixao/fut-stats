import { describe, expect, it } from 'vitest';
import {
  isValidAwardBallot,
  parseBallots,
  tallyAwards,
  validateAwardBallot,
  type AwardBallot,
  type AwardOptions,
} from './awards';

const played = ['ana', 'bia', 'caio', 'davi', 'edu'];

function ballot(voterId: string, mvpId: string, flopId: string): AwardBallot {
  return { voterId, mvpId, flopId };
}

/** Valida e apura; falha o teste se algum voto for inválido. */
function tally(ballots: AwardBallot[], options: AwardOptions) {
  const parsed = parseBallots(ballots, played);
  if (!parsed.ok) throw new Error(`votos inválidos no teste: ${JSON.stringify(parsed.errors)}`);
  return tallyAwards(parsed.value, options);
}

describe('validateAwardBallot', () => {
  it('voto de quem jogou em dois outros jogadores diferentes não tem problema', () => {
    expect(validateAwardBallot(ballot('ana', 'bia', 'caio'), played)).toEqual([]);
    expect(isValidAwardBallot(ballot('ana', 'bia', 'caio'), played)).toBe(true);
  });

  it('aponta voto em si mesmo, com o campo', () => {
    expect(validateAwardBallot(ballot('ana', 'ana', 'caio'), played)).toEqual([
      { voterId: 'ana', field: 'mvpId', code: 'SELF_VOTE' },
    ]);
  });

  it('aponta o mesmo jogador como MVP e Bola Murcha', () => {
    expect(validateAwardBallot(ballot('ana', 'bia', 'bia'), played)).toEqual([
      { voterId: 'ana', field: 'flopId', code: 'SAME_PLAYER_BOTH' },
    ]);
  });

  it('aponta votado que não jogou', () => {
    expect(validateAwardBallot(ballot('ana', 'bia', 'zeca'), played)).toEqual([
      { voterId: 'ana', field: 'flopId', code: 'TARGET_DID_NOT_PLAY' },
    ]);
  });

  it('votante que não jogou gera um único problema', () => {
    expect(validateAwardBallot(ballot('zeca', 'zeca', 'xico'), played)).toEqual([
      { voterId: 'zeca', field: 'voterId', code: 'VOTER_DID_NOT_PLAY' },
    ]);
    expect(isValidAwardBallot(ballot('zeca', 'bia', 'caio'), played)).toBe(false);
  });

  it('lista todos os problemas do voto', () => {
    expect(validateAwardBallot(ballot('ana', 'ana', 'zeca'), played)).toEqual([
      { voterId: 'ana', field: 'mvpId', code: 'SELF_VOTE' },
      { voterId: 'ana', field: 'flopId', code: 'TARGET_DID_NOT_PLAY' },
    ]);
  });
});

describe('parseBallots', () => {
  it('aceita votos válidos', () => {
    const ballots = [ballot('ana', 'bia', 'caio')];
    expect(parseBallots(ballots, played)).toEqual({ ok: true, value: ballots });
  });

  it('junta os problemas de todos os votos, incluindo voto repetido', () => {
    expect(
      parseBallots(
        [ballot('ana', 'bia', 'caio'), ballot('bia', 'bia', 'caio'), ballot('ana', 'davi', 'edu')],
        played,
      ),
    ).toEqual({
      ok: false,
      errors: [
        { voterId: 'bia', field: 'mvpId', code: 'SELF_VOTE' },
        { voterId: 'ana', field: 'voterId', code: 'DUPLICATE_VOTER' },
      ],
    });
  });
});

describe('tallyAwards', () => {
  it('só aceita votos validados por parseBallots', () => {
    // @ts-expect-error: array cru não tem o "carimbo" de ValidBallots
    tallyAwards([ballot('ana', 'bia', 'caio')], { tieBreak: 'SHARE' });
  });

  it('ROUND_SCORE (padrão) exige as notas da rodada', () => {
    const parsed = parseBallots([], played);
    if (!parsed.ok) throw new Error('inesperado');
    // @ts-expect-error: sem roundScores o desempate padrão não compila
    tallyAwards(parsed.value, {});
  });

  it('MVP e Bola Murcha são os mais votados', () => {
    const result = tally(
      [
        ballot('ana', 'bia', 'caio'),
        ballot('bia', 'davi', 'caio'),
        ballot('caio', 'bia', 'edu'),
        ballot('davi', 'bia', 'caio'),
      ],
      { tieBreak: 'SHARE' },
    );
    expect(result).toEqual({ mvpIds: ['bia'], flopIds: ['caio'] });
  });

  it('sem votos não há MVP nem Bola Murcha', () => {
    expect(tally([], { tieBreak: 'SHARE' })).toEqual({ mvpIds: [], flopIds: [] });
  });

  const tied = [ballot('ana', 'bia', 'davi'), ballot('bia', 'caio', 'edu')];

  describe('empate', () => {
    it('ROUND_SCORE (padrão): MVP é o de maior nota, Bola Murcha o de menor', () => {
      const roundScores = { bia: 8, caio: 7.5, davi: 4, edu: 5 };
      expect(tally(tied, { roundScores })).toEqual({ mvpIds: ['bia'], flopIds: ['davi'] });
    });

    it('ROUND_SCORE: se a nota também empata, todos levam', () => {
      const roundScores = { bia: 8, caio: 8, davi: 4, edu: 4 };
      expect(tally(tied, { roundScores })).toEqual({
        mvpIds: ['bia', 'caio'],
        flopIds: ['davi', 'edu'],
      });
    });

    it('ROUND_SCORE: jogador sem nota perde o desempate para quem tem nota', () => {
      const roundScores = { bia: null, caio: 6, edu: 9 };
      expect(tally(tied, { roundScores })).toEqual({ mvpIds: ['caio'], flopIds: ['edu'] });
    });

    it('ROUND_SCORE: se ninguém empatado tem nota, todos levam', () => {
      expect(tally(tied, { roundScores: {} })).toEqual({
        mvpIds: ['bia', 'caio'],
        flopIds: ['davi', 'edu'],
      });
    });

    it('SHARE: todos os empatados levam', () => {
      expect(tally(tied, { tieBreak: 'SHARE' })).toEqual({
        mvpIds: ['bia', 'caio'],
        flopIds: ['davi', 'edu'],
      });
    });

    it('NONE: ninguém leva', () => {
      expect(tally(tied, { tieBreak: 'NONE' })).toEqual({ mvpIds: [], flopIds: [] });
    });
  });
});
