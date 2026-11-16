import { describe, expect, it } from 'vitest';
import { ROUND_LOG_ACTIONS } from './log';

describe('ROUND_LOG_ACTIONS', () => {
  it('C1: tem as 9 ações do registro da rodada, na ordem do ciclo', () => {
    expect([...ROUND_LOG_ACTIONS]).toEqual([
      'TEAMS_PUBLISHED',
      'TEAMS_UNPUBLISHED',
      'MATCH_STARTED',
      'SCORE_SET',
      'MATCH_FINISHED',
      'VOTING_OPENED',
      'VOTING_CLOSED',
      'EVENT_LAUNCHED',
      'EVENT_REMOVED',
    ]);
  });

  it('C1: não tem repetidas e não inclui voto, presença, rascunho nem rodízio', () => {
    expect(new Set(ROUND_LOG_ACTIONS).size).toBe(ROUND_LOG_ACTIONS.length);
    for (const action of ROUND_LOG_ACTIONS) {
      expect(action).not.toMatch(/VOTE|ATTENDANCE|DRAFT|ROTATION/);
    }
  });
});
