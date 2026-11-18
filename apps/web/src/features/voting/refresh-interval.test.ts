import { describe, expect, it } from 'vitest';
import { votingRefreshInterval } from './refresh-interval';

describe('votingRefreshInterval (jogo-ao-vivo)', () => {
  it('votação aberta no modo antigo: 15 s', () => {
    expect(votingRefreshInterval('VOTING', 'polling')).toBe(15_000);
    expect(votingRefreshInterval('VOTING')).toBe(15_000);
  });

  it('votação aberta com o canal conectado: 60 s de segurança', () => {
    expect(votingRefreshInterval('VOTING', 'live')).toBe(60_000);
  });

  it('fechada, antes de abrir ou sem dado: sem consulta periódica', () => {
    for (const status of ['CLOSED', 'IN_PROGRESS', 'POST_MATCH', undefined]) {
      expect(votingRefreshInterval(status, 'live')).toBe(false);
      expect(votingRefreshInterval(status, 'polling')).toBe(false);
    }
  });
});
