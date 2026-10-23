import { z } from 'zod';
import { matchScoreSchema, positionSchema, roundStatusSchema, teamSchema } from './domain';

/** Lances que o jogador ou o admin lançam: gol e assistência (gol contra e gol sofrido ficam de fora). */
export const launchableEventTypeSchema = z.enum(['GOAL', 'ASSIST']);

/** Para onde a tela do jogo leva a rodada: começar (em jogo) ou terminar (votação). */
export const matchStatusTargetSchema = z.enum(['IN_PROGRESS', 'VOTING']);

/** Corpo de PATCH /api/groups/:groupId/rounds/:roundId/match/status. */
export const changeMatchStatusSchema = z.object({ to: matchStatusTargetSchema });

/** Corpo de PUT /api/groups/:groupId/rounds/:roundId/match/score. */
export const setMatchScoreSchema = matchScoreSchema;

/** Corpo de POST /api/groups/:groupId/rounds/:roundId/match/events. */
export const launchMatchEventSchema = z.object({
  membershipId: z.string().min(1),
  type: launchableEventTypeSchema,
});

/** Quem jogou a rodada (titular ou reserva). */
export const matchPlayerSchema = z.object({
  membershipId: z.string(),
  nickname: z.string(),
  team: teamSchema,
  position: positionSchema,
  isReserve: z.boolean(),
});

/** Um lance da rodada, com quem fez e quem lançou. */
export const matchEventSchema = z.object({
  id: z.string(),
  membershipId: z.string(),
  nickname: z.string(),
  team: teamSchema,
  type: launchableEventTypeSchema,
  createdById: z.string(),
  createdByNickname: z.string(),
  createdAt: z.iso.datetime(),
  /** Quem pediu pode remover este lance agora (regra do domain). */
  canRemove: z.boolean(),
});

/**
 * Resposta de GET (e de toda escrita) em /api/groups/:groupId/rounds/:roundId/match.
 * `isOpen`, `next` e `canRemove` de cada lance já vêm do domain para a tela só mostrar.
 */
export const matchViewSchema = z.object({
  roundId: z.string(),
  /** Dia e hora marcados da rodada (o placar mostra o dia). */
  scheduledAt: z.iso.datetime(),
  status: roundStatusSchema,
  /** Nulo até o admin lançar. */
  score: matchScoreSchema.nullable(),
  /** Vazio enquanto os times não foram montados. */
  players: z.array(matchPlayerSchema),
  events: z.array(matchEventSchema),
  /** Quem pediu: o id da membership dele e se é admin. */
  me: z.object({ membershipId: z.string(), isAdmin: z.boolean() }),
  /** Placar e lances podem ser lançados agora (jogo em andamento ou votação). */
  isOpen: z.boolean(),
  /**
   * O próximo passo do admin: começar o jogo (`IN_PROGRESS`) ou encerrar o jogo (`VOTING`). `allowed` e
   * `reason` vêm do domain (`validateRoundTransition`); nulo quando a rodada não está numa dessas etapas.
   */
  next: z
    .object({
      to: matchStatusTargetSchema,
      allowed: z.boolean(),
      reason: z.string().nullable(),
    })
    .nullable(),
});

export type LaunchableEventType = z.infer<typeof launchableEventTypeSchema>;
export type ChangeMatchStatusInput = z.infer<typeof changeMatchStatusSchema>;
export type SetMatchScoreInput = z.infer<typeof setMatchScoreSchema>;
export type LaunchMatchEventInput = z.infer<typeof launchMatchEventSchema>;
export type MatchPlayer = z.infer<typeof matchPlayerSchema>;
export type MatchEventItem = z.infer<typeof matchEventSchema>;
export type MatchView = z.infer<typeof matchViewSchema>;
