import { roundStatusSchema } from '@fut-stats/shared';
import { describe, expect, it } from 'vitest';
import { matchRefreshInterval } from './refresh-interval';

describe('matchRefreshInterval (C64)', () => {
  it('na Resenha atualiza a cada 5 s', () => {
    expect(matchRefreshInterval('POST_MATCH')).toBe(5_000);
  });

  it('em jogo segue a cada 15 s', () => {
    expect(matchRefreshInterval('IN_PROGRESS')).toBe(15_000);
  });

  it('nos outros status e antes de carregar não faz polling', () => {
    const others = roundStatusSchema.options.filter((s) => s !== 'POST_MATCH' && s !== 'IN_PROGRESS');
    expect(others.length).toBeGreaterThan(0);
    for (const status of others) expect(matchRefreshInterval(status)).toBe(false);
    expect(matchRefreshInterval(undefined)).toBe(false);
  });
});
