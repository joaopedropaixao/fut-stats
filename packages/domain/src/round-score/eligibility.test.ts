import { describe, expect, it } from 'vitest';
import { canVoteFor, rateablePlayers, validateVote } from './eligibility';

const played = ['ana', 'bia', 'caio', 'goleiro'];

describe('validateVote', () => {
  it('quem jogou vota em qualquer outro que jogou, de qualquer time', () => {
    expect(validateVote('ana', 'bia', played)).toBeNull();
  });

  it('goleiro também vota', () => {
    expect(validateVote('goleiro', 'ana', played)).toBeNull();
  });

  it('quem não jogou não vota', () => {
    expect(validateVote('davi', 'ana', played)).toBe('VOTER_DID_NOT_PLAY');
  });

  it('ninguém vota em si mesmo', () => {
    expect(validateVote('ana', 'ana', played)).toBe('SELF_VOTE');
  });

  it('não se vota em quem não jogou', () => {
    expect(validateVote('ana', 'davi', played)).toBe('TARGET_DID_NOT_PLAY');
  });

  it('votante de fora tem prioridade sobre os outros motivos', () => {
    expect(validateVote('davi', 'davi', played)).toBe('VOTER_DID_NOT_PLAY');
  });
});

describe('canVoteFor', () => {
  it('é a versão sim/não de validateVote', () => {
    expect(canVoteFor('ana', 'bia', played)).toBe(true);
    expect(canVoteFor('ana', 'ana', played)).toBe(false);
  });
});

describe('rateablePlayers', () => {
  it('lista todos que jogaram, menos o próprio votante', () => {
    expect(rateablePlayers('bia', played)).toEqual(['ana', 'caio', 'goleiro']);
  });

  it('quem não jogou não tem ninguém para avaliar', () => {
    expect(rateablePlayers('davi', played)).toEqual([]);
  });
});
