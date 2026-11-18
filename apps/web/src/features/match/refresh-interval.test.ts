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
    const others = roundStatusSchema.options.filter(
      (s) => s !== 'POST_MATCH' && s !== 'IN_PROGRESS',
    );
    expect(others.length).toBeGreaterThan(0);
    for (const status of others) expect(matchRefreshInterval(status)).toBe(false);
    expect(matchRefreshInterval(undefined)).toBe(false);
  });
});

describe('matchRefreshInterval com o canal ao vivo (jogo-ao-vivo)', () => {
  it('conectado, em jogo e na Resenha só confere a cada 60 s (rede de segurança)', () => {
    expect(matchRefreshInterval('IN_PROGRESS', 'live')).toBe(60_000);
    expect(matchRefreshInterval('POST_MATCH', 'live')).toBe(60_000);
  });

  it('modo antigo (ou sem canal) mantém 15 s em jogo e 5 s na Resenha', () => {
    expect(matchRefreshInterval('IN_PROGRESS', 'polling')).toBe(15_000);
    expect(matchRefreshInterval('POST_MATCH', 'polling')).toBe(5_000);
    expect(matchRefreshInterval('IN_PROGRESS')).toBe(15_000);
  });

  it('nos outros status não há consulta periódica, com ou sem canal', () => {
    expect(matchRefreshInterval('VOTING', 'live')).toBe(false);
    expect(matchRefreshInterval(undefined, 'live')).toBe(false);
  });
});
