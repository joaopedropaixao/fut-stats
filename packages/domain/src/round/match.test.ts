import { describe, expect, it } from 'vitest';
import { teams } from './fixtures.test-utils';
import {
  roundPlayerIds,
  tallyMatchEvents,
  tallyPlayerEvents,
  teamOf,
  validateScore,
} from './match';

describe('teamOf', () => {
  it('acha o time de titulares e reservas', () => {
    expect(teamOf('w1', teams)).toBe('WHITE');
    expect(teamOf('b8', teams)).toBe('BLACK');
  });

  it('devolve null para quem não jogou', () => {
    expect(teamOf('x', teams)).toBeNull();
  });
});

describe('roundPlayerIds', () => {
  it('lista titulares e reservas dos dois times', () => {
    const ids = roundPlayerIds(teams);
    expect(ids).toHaveLength(16);
    expect(ids).toContain('w8');
    expect(ids).toContain('b1');
  });
});

describe('tallyMatchEvents', () => {
  it('gol conta para o time de quem fez; gol contra, para o adversário', () => {
    const tally = tallyMatchEvents(
      [
        { playerId: 'w7', type: 'GOAL' },
        { playerId: 'w8', type: 'GOAL' },
        { playerId: 'w2', type: 'OWN_GOAL' },
        { playerId: 'w6', type: 'ASSIST' },
      ],
      teams,
    );
    expect(tally.goals).toEqual({ WHITE: 2, BLACK: 1 });
    expect(tally.assists).toEqual({ WHITE: 1, BLACK: 0 });
  });

  it('ignora lance de quem não está nos times', () => {
    const tally = tallyMatchEvents([{ playerId: 'x', type: 'GOAL' }], teams);
    expect(tally.goals).toEqual({ WHITE: 0, BLACK: 0 });
  });

  it('sem lances, tudo zero', () => {
    expect(tallyMatchEvents([], teams)).toEqual({
      goals: { WHITE: 0, BLACK: 0 },
      assists: { WHITE: 0, BLACK: 0 },
    });
  });
});

describe('tallyPlayerEvents', () => {
  it('soma gols, assistências e gols contra de cada jogador', () => {
    const tally = tallyPlayerEvents([
      { playerId: 'a', type: 'GOAL' },
      { playerId: 'a', type: 'GOAL' },
      { playerId: 'a', type: 'ASSIST' },
      { playerId: 'b', type: 'ASSIST' },
      { playerId: 'c', type: 'OWN_GOAL' },
    ]);
    expect(tally.get('a')).toEqual({ goals: 2, assists: 1, ownGoals: 0 });
    expect(tally.get('b')).toEqual({ goals: 0, assists: 1, ownGoals: 0 });
    expect(tally.get('c')).toEqual({ goals: 0, assists: 0, ownGoals: 1 });
  });

  it('gol contra não vira gol de quem fez', () => {
    expect(tallyPlayerEvents([{ playerId: 'c', type: 'OWN_GOAL' }]).get('c')?.goals).toBe(0);
  });

  it('quem não tem lance não aparece', () => {
    expect(tallyPlayerEvents([]).size).toBe(0);
  });
});

describe('validateScore', () => {
  it('aceita inteiros de zero para cima', () => {
    expect(validateScore({ WHITE: 0, BLACK: 0 })).toBeNull();
    expect(validateScore({ WHITE: 12, BLACK: 3 })).toBeNull();
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('recusa %s', (goals) => {
    expect(validateScore({ WHITE: goals, BLACK: 0 })).toBe('INVALID_SCORE');
    expect(validateScore({ WHITE: 0, BLACK: goals })).toBe('INVALID_SCORE');
  });
});
