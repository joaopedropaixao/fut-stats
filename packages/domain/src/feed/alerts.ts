import { pickCurrentRound, pickLatestResult, pickVotingRound } from '../round/current';
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

/** Aviso de cada status da rodada da vez (`pickCurrentRound` só devolve estes quatro). */
const CURRENT_ROUND_ALERT: Partial<Record<RoundStatus, FeedAlertType>> = {
  IN_PROGRESS: 'IN_PROGRESS',
  POST_MATCH: 'POST_MATCH',
  TEAMS_PUBLISHED: 'TEAMS_PUBLISHED',
  SCHEDULED: 'PRESENCE',
};

/**
 * Avisos do Feed calculados do estado das rodadas (nada gravado). Compõe `pickCurrentRound` (IN_PROGRESS,
 * POST_MATCH, TEAMS_PUBLISHED, PRESENCE), `pickVotingRound` (VOTING) e `pickLatestResult` (RESULT, até 7 dias).
 * No máximo um aviso por tipo, na ordem de `FEED_ALERT_TYPES`. `now` vem de fora.
 */
export function feedAlerts(rounds: readonly FeedAlertRound[], now: Date): FeedAlertRef[] {
  const byType = new Map<FeedAlertType, string>();

  const current = pickCurrentRound(rounds, now);
  if (current) {
    const type = CURRENT_ROUND_ALERT[current.status];
    if (type) byType.set(type, current.id);
  }
  const voting = pickVotingRound(rounds);
  if (voting) byType.set('VOTING', voting.id);
  const result = pickLatestResult(rounds, now);
  if (result) byType.set('RESULT', result.id);

  return FEED_ALERT_TYPES.flatMap((type) => {
    const roundId = byType.get(type);
    return roundId === undefined ? [] : [{ type, roundId }];
  });
}
