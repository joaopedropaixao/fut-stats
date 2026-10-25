import { ROUND_TRANSITION_ERRORS } from '@fut-stats/domain';
import { z } from 'zod';
import {
  matchEventTypeSchema,
  matchResultSchema,
  matchScoreSchema,
  positionSchema,
  roundStatusSchema,
  teamSchema,
} from './domain';

/** Corpo de PUT .../match/score e de POST .../match/finish (finalizar o jogo informando o placar final). */
export const setMatchScoreSchema = matchScoreSchema;

/** Corpo de POST /api/groups/:groupId/rounds/:roundId/match/events: gol, assistência ou gol contra. */
export const launchMatchEventSchema = z.object({
  membershipId: z.string().min(1),
  type: matchEventTypeSchema,
});

/** Quem jogou a rodada (titular ou reserva). */
export const matchPlayerSchema = z.object({
  membershipId: z.string(),
  nickname: z.string(),
  photoUrl: z.string().nullable(),
  team: teamSchema,
  position: positionSchema,
  isReserve: z.boolean(),
});

/** Um lance da rodada, com quem fez, quem lançou e se quem pediu pode apagar. */
export const matchEventSchema = z.object({
  id: z.string(),
  type: matchEventTypeSchema,
  membershipId: z.string(),
  nickname: z.string(),
  photoUrl: z.string().nullable(),
  /** Time de quem fez (anel do avatar). */
  playerTeam: teamSchema,
  /** Time que ganhou o lance: no gol contra, o adversário. É a lista em que o lance aparece. */
  team: teamSchema,
  createdByNickname: z.string(),
  createdAt: z.iso.datetime(),
  /** `validateMatchEventRemoval` para quem pediu. */
  canRemove: z.boolean(),
});

/** Contagem por time. */
export const teamTallySchema = z.object({ WHITE: z.number().int(), BLACK: z.number().int() });

/** O que quem pediu pode fazer agora, calculado com o domain (papel + status). */
export const matchPermissionsSchema = z.object({
  /** Admin e `TEAMS_PUBLISHED` (mesmo com `errors`, para a tela mostrar o motivo). */
  start: z.boolean(),
  /** Admin e `IN_PROGRESS` ou `POST_MATCH`. */
  setScore: z.boolean(),
  /** Admin e `IN_PROGRESS`. */
  finish: z.boolean(),
  /** Admin e `POST_MATCH` (mesmo com `errors`). */
  openVoting: z.boolean(),
  /** Pode lançar um lance próprio agora (jogou, e o status e o papel deixam). */
  launchOwn: z.boolean(),
  /** Admin e `IN_PROGRESS` ou `POST_MATCH`: lança de qualquer um. */
  launchAny: z.boolean(),
});

/** Resposta de GET (e de toda escrita) em /api/groups/:groupId/rounds/:roundId/match. */
export const matchViewSchema = z.object({
  roundId: z.string(),
  number: z.number().int(),
  scheduledAt: z.iso.datetime(),
  status: roundStatusSchema,
  /** Nulo até o admin lançar. */
  score: matchScoreSchema.nullable(),
  /** Gols (com gol contra a favor) e assistências lançados, por time (`tallyMatchEvents`). */
  tally: z.object({ goals: teamTallySchema, assists: teamTallySchema }),
  /** Vazio enquanto os times não foram montados. */
  players: z.array(matchPlayerSchema),
  /** Na ordem de lançamento. */
  events: z.array(matchEventSchema),
  me: z.object({
    membershipId: z.string(),
    isAdmin: z.boolean(),
    /** Nulo = não jogou. */
    team: teamSchema.nullable(),
    /** De `POST_MATCH` em diante, com placar e se jogou; senão nulo. */
    result: matchResultSchema.nullable(),
  }),
  /**
   * O que impede o próximo passo do admin: em `TEAMS_PUBLISHED`, `→ IN_PROGRESS`; em `POST_MATCH`, `→ VOTING`.
   * Vazio em `IN_PROGRESS` (o placar vem no finish), nos outros status e para jogador.
   */
  errors: z.array(z.enum(ROUND_TRANSITION_ERRORS)),
  permissions: matchPermissionsSchema,
});

export type MatchScore = z.infer<typeof matchScoreSchema>;
export type MatchResult = z.infer<typeof matchResultSchema>;
export type SetMatchScoreInput = z.infer<typeof setMatchScoreSchema>;
export type LaunchMatchEventInput = z.infer<typeof launchMatchEventSchema>;
export type MatchPlayer = z.infer<typeof matchPlayerSchema>;
export type MatchEventItem = z.infer<typeof matchEventSchema>;
export type MatchPermissions = z.infer<typeof matchPermissionsSchema>;
export type MatchView = z.infer<typeof matchViewSchema>;
