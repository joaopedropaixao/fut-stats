import type { RoundStatus } from '../round/status';

/**
 * Tipos de aviso do Feed, na ordem de prioridade: o primeiro da lista vira o aviso grande, os outros aparecem em
 * linha. O jogo ao vivo vem antes de tudo; depois a folha fixa "resultado > votação > presença".
 */
export const FEED_ALERT_TYPES = [
  'IN_PROGRESS',
  'POST_MATCH',
  'RESULT',
  'VOTING',
  'TEAMS_PUBLISHED',
  'PRESENCE',
] as const;

export type FeedAlertType = (typeof FEED_ALERT_TYPES)[number];

/** O mínimo de uma rodada para calcular os avisos. */
export interface FeedAlertRound {
  id: string;
  status: RoundStatus;
  scheduledAt: Date;
  closedAt: Date | null;
}

export interface FeedAlertRef {
  type: FeedAlertType;
  roundId: string;
}

/**
 * Avisos do Feed calculados do estado das rodadas (nada gravado). Compõe `pickCurrentRound` (IN_PROGRESS,
 * POST_MATCH, TEAMS_PUBLISHED, PRESENCE), `pickVotingRound` (VOTING) e `pickLatestResult` (RESULT, até 7 dias).
 * No máximo um aviso por tipo, na ordem de `FEED_ALERT_TYPES`. `now` vem de fora.
 */
export function feedAlerts(rounds: readonly FeedAlertRound[], now: Date): FeedAlertRef[] {
  void rounds;
  void now;
  throw new Error('feedAlerts: não implementado (dev-back)');
}
