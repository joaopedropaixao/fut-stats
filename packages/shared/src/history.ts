import { MATCH_WINNERS, type MatchWinner } from '@fut-stats/domain';
import { z } from 'zod';
import {
  avatarSchema,
  matchResultSchema,
  matchScoreSchema,
  roundStatusSchema,
  teamSchema,
} from './domain';

/** Tamanho da página do histórico (proteção de entrada, não regra da pelada). */
export const HISTORY_PAGE_DEFAULT = 20;
export const HISTORY_PAGE_MAX = 50;

/** Erro de cursor que não é de uma partida finalizada do grupo. */
export const INVALID_CURSOR_LABEL = 'Não deu para continuar a lista. Abra o Histórico de novo.';

/** Query de GET .../history. `cursor` = o `nextCursor` da página anterior (o id da última rodada dela). */
export const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(HISTORY_PAGE_MAX).default(HISTORY_PAGE_DEFAULT),
  cursor: z.string().min(1).optional(),
});

export const matchWinnerSchema = z.enum(MATCH_WINNERS);

/** Textos de UI para o vencedor da partida. */
export const MATCH_WINNER_LABELS: Readonly<Record<MatchWinner, string>> = {
  WHITE: 'Branco venceu',
  BLACK: 'Preto venceu',
  DRAW: 'Empate',
};

/** Uma partida finalizada na lista (status POST_MATCH, VOTING ou CLOSED). */
export const historyItemSchema = z.object({
  roundId: z.string(),
  number: z.number().int().positive(),
  scheduledAt: z.iso.datetime(),
  location: z.string().nullable(),
  status: roundStatusSchema,
  score: matchScoreSchema,
  winner: matchWinnerSchema,
  /** Quem pede: o time em que jogou (titular ou reserva) e o resultado. Nulo = não jogou. */
  me: z.object({ team: teamSchema, result: matchResultSchema }).nullable(),
  /** Craque(s) da rodada; vazio antes de CLOSED. */
  mvps: z.array(z.object({ membershipId: z.string(), nickname: z.string(), avatar: avatarSchema })),
});

export const historyListSchema = z.object({
  items: z.array(historyItemSchema),
  nextCursor: z.string().nullable(),
});

export type HistoryQuery = z.infer<typeof historyQuerySchema>;
export type HistoryItem = z.infer<typeof historyItemSchema>;
export type HistoryList = z.infer<typeof historyListSchema>;
export type { MatchWinner };

/** Reexportado para o web decidir "a partida terminou?" sem copiar a regra (a regra mora no domain). */
export { isMatchFinished } from '@fut-stats/domain';
