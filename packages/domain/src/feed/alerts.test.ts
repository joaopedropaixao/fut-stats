import { describe, expect, it } from 'vitest';
import { feedAlerts, FEED_ALERT_TYPES, type FeedAlertRound } from './alerts';
import type { RoundStatus } from '../round/status';

const now = new Date('2026-11-15T15:00:00Z');

function round(
  id: string,
  status: RoundStatus,
  scheduledAt: string,
  closedAt: string | null = null,
): FeedAlertRound {
  return {
    id,
    status,
    scheduledAt: new Date(scheduledAt),
    closedAt: closedAt ? new Date(closedAt) : null,
  };
}

describe('feedAlerts', () => {
  it('C1: resultado, votação e presença, nessa ordem, cada um com a rodada certa', () => {
    const rounds = [
      round('proxima', 'SCHEDULED', '2026-11-20T20:00:00Z'),
      round('votando', 'VOTING', '2026-11-13T20:00:00Z'),
      round('encerrada', 'CLOSED', '2026-11-12T20:00:00Z', '2026-11-14T15:00:00Z'),
    ];
    expect(feedAlerts(rounds, now)).toEqual([
      { type: 'RESULT', roundId: 'encerrada' },
      { type: 'VOTING', roundId: 'votando' },
      { type: 'PRESENCE', roundId: 'proxima' },
    ]);
  });

  it('C2: jogo rolando vem antes da votação', () => {
    const rounds = [
      round('votando', 'VOTING', '2026-11-08T20:00:00Z'),
      round('hoje', 'IN_PROGRESS', '2026-11-15T14:00:00Z'),
    ];
    expect(feedAlerts(rounds, now)).toEqual([
      { type: 'IN_PROGRESS', roundId: 'hoje' },
      { type: 'VOTING', roundId: 'votando' },
    ]);
  });

  it('C3: Resenha pós-jogo é um aviso', () => {
    const rounds = [round('hoje', 'POST_MATCH', '2026-11-15T14:00:00Z')];
    expect(feedAlerts(rounds, now)).toEqual([{ type: 'POST_MATCH', roundId: 'hoje' }]);
  });

  it('C3: times publicados é um aviso', () => {
    const rounds = [round('hoje', 'TEAMS_PUBLISHED', '2026-11-15T20:00:00Z')];
    expect(feedAlerts(rounds, now)).toEqual([{ type: 'TEAMS_PUBLISHED', roundId: 'hoje' }]);
  });

  it('C4: só encerradas há mais de 7 dias, ou nenhuma rodada, dá lista vazia', () => {
    const velha = round('velha', 'CLOSED', '2026-11-01T20:00:00Z', '2026-11-03T15:00:00Z');
    expect(feedAlerts([velha], now)).toEqual([]);
    expect(feedAlerts([], now)).toEqual([]);
  });

  it('C4: encerrada há exatamente 7 dias já saiu do destaque', () => {
    const borda = round('borda', 'CLOSED', '2026-11-07T20:00:00Z', '2026-11-08T15:00:00Z');
    expect(feedAlerts([borda], now)).toEqual([]);
  });

  it('no máximo um aviso por tipo, na ordem de prioridade', () => {
    const rounds = [
      round('v1', 'VOTING', '2026-11-06T20:00:00Z'),
      round('v2', 'VOTING', '2026-11-13T20:00:00Z'),
      round('c1', 'CLOSED', '2026-11-10T20:00:00Z', '2026-11-12T10:00:00Z'),
      round('c2', 'CLOSED', '2026-11-11T20:00:00Z', '2026-11-14T10:00:00Z'),
      round('p1', 'SCHEDULED', '2026-11-22T20:00:00Z'),
      round('p2', 'SCHEDULED', '2026-11-29T20:00:00Z'),
    ];
    const alerts = feedAlerts(rounds, now);
    expect(alerts).toEqual([
      { type: 'RESULT', roundId: 'c2' },
      { type: 'VOTING', roundId: 'v2' },
      { type: 'PRESENCE', roundId: 'p1' },
    ]);
    const order = alerts.map((a) => FEED_ALERT_TYPES.indexOf(a.type));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('rodada marcada que passou de 24h do horário não vira aviso de presença', () => {
    const rounds = [round('esquecida', 'SCHEDULED', '2026-11-10T20:00:00Z')];
    expect(feedAlerts(rounds, now)).toEqual([]);
  });

  it('não altera a lista recebida', () => {
    const rounds = [
      round('b', 'SCHEDULED', '2026-11-20T20:00:00Z'),
      round('a', 'VOTING', '2026-11-13T20:00:00Z'),
    ];
    const copy = [...rounds];
    feedAlerts(rounds, now);
    expect(rounds).toEqual(copy);
  });
});
