import { describe, expect, it } from 'vitest';
import { canVoteFor, rateablePlayers } from './eligibility';

const played = ['ana', 'bia', 'caio', 'goleiro'];

describe('canVoteFor', () => {
  it('quem jogou vota em qualquer outro que jogou, de qualquer time', () => {
    expect(canVoteFor('ana', 'bia', played)).toBe(true);
    expect(canVoteFor('caio', 'goleiro', played)).toBe(true);
  });

  it('goleiro também vota', () => {
    expect(canVoteFor('goleiro', 'ana', played)).toBe(true);
  });

  it('ninguém vota em si mesmo', () => {
    expect(canVoteFor('ana', 'ana', played)).toBe(false);
  });

  it('quem não jogou não vota', () => {
    expect(canVoteFor('davi', 'ana', played)).toBe(false);
  });

  it('não se vota em quem não jogou', () => {
    expect(canVoteFor('ana', 'davi', played)).toBe(false);
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
