import { z } from 'zod';
import { matchScoreSchema, positionSchema, roundStatusSchema, teamSchema } from './domain';

/** Tamanho da página do histórico (proteção de entrada, não regra da pelada). */
export const HISTORY_PAGE_DEFAULT = 20;
export const HISTORY_PAGE_MAX = 50;

/** Query de GET /api/groups/:groupId/history: `cursor` é o `nextCursor` da página anterior. */
export const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(HISTORY_PAGE_MAX).default(HISTORY_PAGE_DEFAULT),
  cursor: z.string().min(1).optional(),
});

export const matchWinnerSchema = z.enum([...teamSchema.options, 'DRAW']);

/**
 * Uma partida já jogada na lista. `score` e `winner` são nulos se o placar ainda não foi lançado;
 * `winner` também é nulo com o jogo em andamento (placar parcial).
 */
export const historyItemSchema = z.object({
  roundId: z.string(),
  scheduledAt: z.iso.datetime(),
  location: z.string().nullable(),
  status: roundStatusSchema,
  score: matchScoreSchema.nullable(),
  winner: matchWinnerSchema.nullable(),
});

export const historyListSchema = z.object({
  items: z.array(historyItemSchema),
  nextCursor: z.string().nullable(),
});

/** Jogador de um time na partida, com os lances dele. */
export const historyPlayerSchema = z.object({
  membershipId: z.string(),
  nickname: z.string(),
  position: positionSchema,
  goals: z.number().int(),
  assists: z.number().int(),
});

export const historyTeamSchema = z.object({
  /** Titulares na ordem do campo: Goleiro, Zagueiro, Ala, Meia, Atacante. */
  starters: z.array(historyPlayerSchema),
  reserves: z.array(historyPlayerSchema),
});

export const historyDetailSchema = historyItemSchema.extend({
  teams: z.object({ WHITE: historyTeamSchema, BLACK: historyTeamSchema }),
});

export type HistoryQuery = z.infer<typeof historyQuerySchema>;
export type HistoryItem = z.infer<typeof historyItemSchema>;
export type HistoryList = z.infer<typeof historyListSchema>;
export type HistoryPlayer = z.infer<typeof historyPlayerSchema>;
export type HistoryTeam = z.infer<typeof historyTeamSchema>;
export type HistoryDetail = z.infer<typeof historyDetailSchema>;
