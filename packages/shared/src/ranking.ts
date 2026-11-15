import { z } from 'zod';
import { roleSchema } from './auth';
import { avatarSchema, matchResultSchema, positionSchema, teamSchema } from './domain';

// Contrato do ranking (spec `docs/specs/ranking.md`). Só conta rodada encerrada (`CLOSED`).
// Ordem, posição, tendência e mínimo de jogos vêm prontos da API; o front só mostra.

/** Resultados iguais seguidos nas últimas rodadas que o jogador jogou ("3 vitórias seguidas"). */
export const streakSchema = z.object({
  result: matchResultSchema,
  count: z.number().int().positive(),
});

/** Números de goleiro: só as rodadas em que ele jogou na vaga de goleiro. */
export const goalkeeperStatsSchema = z.object({
  games: z.number().int(),
  conceded: z.number().int(),
  cleanSheets: z.number().int(),
  /** 2 casas; null sem jogo no gol. */
  concededPerGame: z.number().nullable(),
});

/** Estatísticas do jogador nas rodadas encerradas. Gol contra não conta como gol. */
export const playerStatsSchema = z.object({
  games: z.number().int(),
  wins: z.number().int(),
  draws: z.number().int(),
  losses: z.number().int(),
  goals: z.number().int(),
  assists: z.number().int(),
  ownGoals: z.number().int(),
  mvps: z.number().int(),
  flops: z.number().int(),
  ratedGames: z.number().int(),
  /** Média das notas de rodada, 2 casas; null sem nota. */
  average: z.number().nullable(),
  streak: streakSchema.nullable(),
  /** Só para quem tem GOALKEEPER como posição principal. */
  goalkeeper: goalkeeperStatsSchema.nullable(),
});

export const rankingPlayerSchema = z.object({
  membershipId: z.string(),
  nickname: z.string(),
  avatar: avatarSchema,
  primaryPosition: positionSchema,
  /** Geral; null = poucos jogos. */
  rank: z.number().int().positive().nullable(),
  /** Dentro da posição principal; null = poucos jogos. */
  positionRank: z.number().int().positive().nullable(),
  /** + subiu, − desceu, 0 igual (com a última rodada encerrada); null sem comparação. */
  trend: z.number().int().nullable(),
  stats: playerStatsSchema,
});

/** GET /groups/:groupId/ranking */
export const rankingSchema = z.object({
  closedRounds: z.number().int(),
  minRatedGames: z.number().int(),
  /** Classificados na ordem do ranking; depois os de poucos jogos (por jogos e apelido). */
  players: z.array(rankingPlayerSchema),
  me: z.object({ membershipId: z.string() }),
});

/** Uma rodada encerrada que o jogador jogou, para "ÚLTIMAS RODADAS". */
export const playerRoundSchema = z.object({
  roundId: z.string(),
  number: z.number().int(),
  scheduledAt: z.iso.datetime(),
  team: teamSchema,
  result: matchResultSchema,
  score: z.number().nullable(),
  goals: z.number().int(),
  assists: z.number().int(),
  isMvp: z.boolean(),
  isFlop: z.boolean(),
});

/** GET /groups/:groupId/members/:membershipId/stats */
export const playerProfileSchema = rankingPlayerSchema.extend({
  secondaryPositions: z.array(positionSchema),
  isHiredGoalkeeper: z.boolean(),
  role: roleSchema,
  /** Nota que o seletor e a lista de presença usam (5 últimas, com a inicial completando). */
  referenceRating: z.number(),
  /** Até 5, da mais recente para a mais antiga. */
  lastRounds: z.array(playerRoundSchema),
});

export type Streak = z.infer<typeof streakSchema>;
export type GoalkeeperStats = z.infer<typeof goalkeeperStatsSchema>;
export type PlayerStats = z.infer<typeof playerStatsSchema>;
export type RankingPlayer = z.infer<typeof rankingPlayerSchema>;
export type Ranking = z.infer<typeof rankingSchema>;
export type PlayerRound = z.infer<typeof playerRoundSchema>;
export type PlayerProfile = z.infer<typeof playerProfileSchema>;
