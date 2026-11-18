import { ROUND_LOG_ACTIONS, type RoundLogAction } from '@fut-stats/domain';
import { z } from 'zod';

export type { RoundLogAction };

export const roundLogActionSchema = z.enum(ROUND_LOG_ACTIONS);

/** Textos de UI de cada ação do registro da rodada. */
export const ROUND_LOG_ACTION_LABELS: Readonly<Record<RoundLogAction, string>> = {
  TEAMS_PUBLISHED: 'Times publicados',
  TEAMS_UNPUBLISHED: 'Times despublicados',
  MATCH_STARTED: 'Jogo começou',
  SCORE_SET: 'Placar lançado',
  MATCH_FINISHED: 'Jogo finalizado',
  VOTING_OPENED: 'Votação aberta',
  VOTING_CLOSED: 'Votação fechada',
  EVENT_LAUNCHED: 'Lance lançado',
  EVENT_REMOVED: 'Lance apagado',
};

/** Uma linha do registro da rodada (`GET /groups/:groupId/rounds/:roundId/log`, só admin), da mais antiga para a mais nova. */
export const roundLogEntrySchema = z.object({
  id: z.string(),
  action: roundLogActionSchema,
  label: z.string(),
  /** Quem fez. Nulo = automático (fechamento da votação). */
  actor: z.object({ membershipId: z.string(), nickname: z.string() }).nullable(),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.iso.datetime(),
});

export type RoundLogEntry = z.infer<typeof roundLogEntrySchema>;
