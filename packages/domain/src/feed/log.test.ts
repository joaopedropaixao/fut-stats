import { describe, expect, it } from 'vitest';
import { ROUND_LOG_ACTIONS } from '../round';
import { AUDIT_ACTIONS, FEED_LOG_ACTIONS } from './log';

describe('FEED_LOG_ACTIONS', () => {
  it('C23: tem as 7 ações das escritas do feed, na ordem resenha, comentário, reação', () => {
    expect([...FEED_LOG_ACTIONS]).toEqual([
      'POST_CREATED',
      'POST_EDITED',
      'POST_DELETED',
      'COMMENT_CREATED',
      'COMMENT_DELETED',
      'REACTION_SET',
      'REACTION_REMOVED',
    ]);
  });

  it('C23: não tem repetidas nem repete ação da rodada', () => {
    expect(new Set(FEED_LOG_ACTIONS).size).toBe(FEED_LOG_ACTIONS.length);
    for (const action of FEED_LOG_ACTIONS) {
      expect(ROUND_LOG_ACTIONS).not.toContain(action);
    }
  });

  it('C23: não inclui leitura nem nada que o feed não escreva', () => {
    for (const action of FEED_LOG_ACTIONS) {
      expect(action).not.toMatch(/READ|VIEW|LIST|ALERT/);
    }
  });
});

describe('AUDIT_ACTIONS', () => {
  it('C23: são as ações da rodada seguidas das do feed', () => {
    expect([...AUDIT_ACTIONS]).toEqual([...ROUND_LOG_ACTIONS, ...FEED_LOG_ACTIONS]);
    expect(AUDIT_ACTIONS).toHaveLength(16);
  });
});
