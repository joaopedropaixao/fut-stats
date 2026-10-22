import { describe, expect, it } from 'vitest';
import { isValidAwardBallot, tallyAwards, type AwardBallot } from './awards';

const played = ['ana', 'bia', 'caio', 'davi', 'edu'];

function ballot(voterId: string, mvpId: string, flopId: string): AwardBallot {
  return { voterId, mvpId, flopId };
}

describe('isValidAwardBallot', () => {
  it('aceita voto de quem jogou em dois outros jogadores diferentes', () => {
    expect(isValidAwardBallot(ballot('ana', 'bia', 'caio'), played)).toBe(true);
  });

  it('rejeita voto em si mesmo, para MVP ou Bola Murcha', () => {
    expect(isValidAwardBallot(ballot('ana', 'ana', 'caio'), played)).toBe(false);
    expect(isValidAwardBallot(ballot('ana', 'bia', 'ana'), played)).toBe(false);
  });

  it('rejeita o mesmo jogador como MVP e Bola Murcha', () => {
    expect(isValidAwardBallot(ballot('ana', 'bia', 'bia'), played)).toBe(false);
  });

  it('rejeita votante ou votado que não jogou', () => {
    expect(isValidAwardBallot(ballot('zeca', 'bia', 'caio'), played)).toBe(false);
    expect(isValidAwardBallot(ballot('ana', 'zeca', 'caio'), played)).toBe(false);
  });
});

describe('tallyAwards', () => {
  it('MVP e Bola Murcha são os mais votados', () => {
    const result = tallyAwards(
      [
        ballot('ana', 'bia', 'caio'),
        ballot('bia', 'davi', 'caio'),
        ballot('caio', 'bia', 'edu'),
        ballot('davi', 'bia', 'caio'),
      ],
      played,
      { tieBreak: 'SHARE' },
    );
    expect(result).toEqual({ mvpIds: ['bia'], flopIds: ['caio'] });
  });

  it('sem votos não há MVP nem Bola Murcha', () => {
    expect(tallyAwards([], played, { tieBreak: 'SHARE' })).toEqual({ mvpIds: [], flopIds: [] });
  });

  const tied = [ballot('ana', 'bia', 'davi'), ballot('bia', 'caio', 'edu')];

  describe('empate', () => {
    it('ROUND_SCORE (padrão): MVP é o de maior nota, Bola Murcha o de menor', () => {
      const roundScores = { bia: 8, caio: 7.5, davi: 4, edu: 5 };
      expect(tallyAwards(tied, played, { roundScores })).toEqual({
        mvpIds: ['bia'],
        flopIds: ['davi'],
      });
    });

    it('ROUND_SCORE: se a nota também empata, todos levam', () => {
      const roundScores = { bia: 8, caio: 8, davi: 4, edu: 4 };
      expect(tallyAwards(tied, played, { roundScores })).toEqual({
        mvpIds: ['bia', 'caio'],
        flopIds: ['davi', 'edu'],
      });
    });

    it('ROUND_SCORE: jogador sem nota perde o desempate para quem tem nota', () => {
      const roundScores = { bia: null, caio: 6, edu: 9 };
      expect(tallyAwards(tied, played, { roundScores })).toEqual({
        mvpIds: ['caio'],
        flopIds: ['edu'],
      });
    });

    it('ROUND_SCORE: se ninguém empatado tem nota, todos levam', () => {
      expect(tallyAwards(tied, played, { roundScores: {} })).toEqual({
        mvpIds: ['bia', 'caio'],
        flopIds: ['davi', 'edu'],
      });
    });

    it('ROUND_SCORE exige as notas da rodada', () => {
      expect(() => tallyAwards(tied, played)).toThrow(/roundScores/);
    });

    it('SHARE: todos os empatados levam', () => {
      expect(tallyAwards(tied, played, { tieBreak: 'SHARE' })).toEqual({
        mvpIds: ['bia', 'caio'],
        flopIds: ['davi', 'edu'],
      });
    });

    it('NONE: ninguém leva', () => {
      expect(tallyAwards(tied, played, { tieBreak: 'NONE' })).toEqual({ mvpIds: [], flopIds: [] });
    });
  });

  it('lança erro com voto inválido', () => {
    expect(() => tallyAwards([ballot('ana', 'ana', 'bia')], played, { tieBreak: 'SHARE' })).toThrow(
      /inválido/,
    );
  });

  it('lança erro se a mesma pessoa votar duas vezes', () => {
    expect(() =>
      tallyAwards([ballot('ana', 'bia', 'caio'), ballot('ana', 'davi', 'edu')], played, {
        tieBreak: 'SHARE',
      }),
    ).toThrow(/mais de uma vez/);
  });
});
