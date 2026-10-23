import { describe, expect, it } from 'vitest';
import {
  isValidRatingSheet,
  isValidRoundVote,
  validateRatingSheet,
  validateRoundVote,
  type RatingEntry,
} from './vote';

const played = ['ana', 'bia', 'caio', 'goleiro'];

const sheet = (...targets: string[]): RatingEntry[] =>
  targets.map((targetId) => ({ targetId, value: 7 }));

describe('validateRatingSheet', () => {
  it('quem vota dá nota a todos que jogaram, menos a si mesmo', () => {
    expect(validateRatingSheet('ana', sheet('bia', 'caio', 'goleiro'), played)).toEqual([]);
  });

  it('a ordem das notas não importa', () => {
    expect(validateRatingSheet('ana', sheet('goleiro', 'bia', 'caio'), played)).toEqual([]);
  });

  it('não pode pular ninguém: lista cada um que faltou', () => {
    expect(validateRatingSheet('ana', sheet('bia'), played)).toEqual([
      { targetId: 'caio', code: 'MISSING_RATING' },
      { targetId: 'goleiro', code: 'MISSING_RATING' },
    ]);
  });

  it('folha vazia: faltam todos', () => {
    expect(validateRatingSheet('ana', [], played)).toHaveLength(3);
  });

  it('quem não jogou não vota: só esse motivo', () => {
    expect(validateRatingSheet('davi', sheet('ana'), played)).toEqual([
      { targetId: 'davi', code: 'VOTER_DID_NOT_PLAY' },
    ]);
  });

  it('nota para si mesmo ou para quem não jogou', () => {
    expect(
      validateRatingSheet('ana', sheet('ana', 'bia', 'caio', 'goleiro', 'davi'), played),
    ).toEqual([
      { targetId: 'ana', code: 'SELF_VOTE' },
      { targetId: 'davi', code: 'TARGET_DID_NOT_PLAY' },
    ]);
  });

  it('nota inválida', () => {
    const ratings: RatingEntry[] = [
      { targetId: 'bia', value: 7.3 },
      { targetId: 'caio', value: 11 },
      { targetId: 'goleiro', value: Number.NaN },
    ];
    expect(validateRatingSheet('ana', ratings, played)).toEqual([
      { targetId: 'bia', code: 'INVALID_STEP' },
      { targetId: 'caio', code: 'OUT_OF_RANGE' },
      { targetId: 'goleiro', code: 'NOT_A_NUMBER' },
    ]);
  });

  it('duas notas para o mesmo jogador', () => {
    expect(validateRatingSheet('ana', sheet('bia', 'bia', 'caio', 'goleiro'), played)).toEqual([
      { targetId: 'bia', code: 'DUPLICATE_TARGET' },
    ]);
  });

  it('nota 0 vale', () => {
    const ratings = sheet('bia', 'caio').concat({ targetId: 'goleiro', value: 0 });
    expect(validateRatingSheet('ana', ratings, played)).toEqual([]);
  });
});

describe('isValidRatingSheet', () => {
  it('é a versão sim/não de validateRatingSheet', () => {
    expect(isValidRatingSheet('ana', sheet('bia', 'caio', 'goleiro'), played)).toBe(true);
    expect(isValidRatingSheet('ana', sheet('bia'), played)).toBe(false);
  });
});

describe('validateRoundVote', () => {
  const vote = {
    voterId: 'ana',
    mvpId: 'bia',
    flopId: 'caio',
    ratings: sheet('bia', 'caio', 'goleiro'),
  };

  it('voto completo: notas de todos + Craque + Perna de Pau', () => {
    expect(validateRoundVote(vote, played)).toEqual({ ratings: [], awards: [] });
    expect(isValidRoundVote(vote, played)).toBe(true);
  });

  it('votante que não jogou: o motivo aparece uma vez só', () => {
    expect(validateRoundVote({ ...vote, voterId: 'davi' }, played)).toEqual({
      ratings: [{ targetId: 'davi', code: 'VOTER_DID_NOT_PLAY' }],
      awards: [],
    });
  });

  it('separa os problemas das notas e dos prêmios', () => {
    const result = validateRoundVote({ ...vote, flopId: 'bia', ratings: sheet('bia') }, played);
    expect(result.ratings).toHaveLength(2);
    expect(result.awards).toEqual([{ voterId: 'ana', field: 'flopId', code: 'SAME_PLAYER_BOTH' }]);
    expect(isValidRoundVote({ ...vote, ratings: [] }, played)).toBe(false);
  });
});
