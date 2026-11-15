import { VOTING_END_REASONS, type VotingEndReason } from '@fut-stats/domain';
import { z } from 'zod';
import {
  avatarSchema,
  matchScoreSchema,
  positionSchema,
  roundStatusSchema,
  teamSchema,
} from './domain';
import { matchWinnerSchema } from './history';

/** Erros de momento da votação (409). */
export const VOTING_ERROR_LABELS = {
  VOTING_NOT_OPEN: 'A votação desta rodada ainda não abriu',
  VOTING_CLOSED: 'A votação fechou',
  RESULT_NOT_READY: 'O resultado ainda não saiu',
} as const;

export type VotingError = keyof typeof VOTING_ERROR_LABELS;

/** Textos de UI para o motivo do fechamento. */
export const VOTING_END_REASON_LABELS: Readonly<Record<VotingEndReason, string>> = {
  ALL_VOTED: 'Todo mundo votou',
  DEADLINE_PASSED: 'O prazo acabou',
  ADMIN_CLOSED: 'O admin encerrou',
};

export const votingEndReasonSchema = z.enum(VOTING_END_REASONS);

export const ratingEntrySchema = z.object({
  targetId: z.string().min(1),
  // Só "é número": o passo e a faixa da nota vêm do domain (INVALID_STEP / OUT_OF_RANGE), com o code da regra.
  value: z.number(),
});

/** Corpo de PUT .../voting/vote: o pacote inteiro. Enviar de novo substitui. */
export const submitVoteSchema = z.object({
  ratings: z.array(ratingEntrySchema).max(40),
  /** Craque. */
  mvpId: z.string().min(1),
  /** Perna de Pau. */
  flopId: z.string().min(1),
});

/** Quem jogou a rodada, como a votação e o resultado mostram. */
export const votingPlayerSchema = z.object({
  membershipId: z.string(),
  nickname: z.string(),
  avatar: avatarSchema,
  team: teamSchema,
  position: positionSchema,
  isReserve: z.boolean(),
});

export const votingViewSchema = z.object({
  roundId: z.string(),
  number: z.number().int(),
  scheduledAt: z.iso.datetime(),
  status: roundStatusSchema,
  /** Round.votingOpenedAt. */
  openedAt: z.iso.datetime().nullable(),
  /** votingDeadline(openedAt, prazo do grupo). */
  deadline: z.iso.datetime().nullable(),
  closedAt: z.iso.datetime().nullable(),
  closeReason: votingEndReasonSchema.nullable(),
  serverTime: z.iso.datetime(),
  /** Do meu time primeiro; em cada time, pela vaga e depois reservas. */
  players: z.array(votingPlayerSchema),
  /** Só ativos. */
  progress: z.object({ voted: z.number().int(), total: z.number().int() }),
  /** Quem ainda não votou. Só para o admin; `null` para jogador. */
  pending: z.array(votingPlayerSchema).nullable(),
  me: z.object({
    membershipId: z.string(),
    isAdmin: z.boolean(),
    played: z.boolean(),
    vote: submitVoteSchema.extend({ updatedAt: z.iso.datetime() }).nullable(),
  }),
  permissions: z.object({
    /** Jogou e isVotingOpen. */
    vote: z.boolean(),
    /** Admin e VOTING. */
    close: z.boolean(),
  }),
});

export const resultPlayerSchema = votingPlayerSchema.extend({
  /** Nota da rodada (1 casa); null = sem nota. */
  score: z.number().nullable(),
  ratingsCount: z.number().int(),
  /** Posição na rodada pela nota (empate divide); null sem nota. */
  rank: z.number().int().positive().nullable(),
  goals: z.number().int(),
  assists: z.number().int(),
  ownGoals: z.number().int(),
  isMvp: z.boolean(),
  isFlop: z.boolean(),
});

export const roundResultSchema = z.object({
  roundId: z.string(),
  number: z.number().int(),
  scheduledAt: z.iso.datetime(),
  score: matchScoreSchema,
  winner: matchWinnerSchema,
  closedAt: z.iso.datetime(),
  closeReason: votingEndReasonSchema,
  votes: z.object({ voted: z.number().int(), total: z.number().int() }),
  mvps: z.array(resultPlayerSchema),
  flops: z.array(resultPlayerSchema),
  /** Em ordem de nota; sem nota por último, depois apelido. */
  players: z.array(resultPlayerSchema),
  me: z.object({ membershipId: z.string(), played: z.boolean() }),
});

export type RatingEntryInput = z.infer<typeof ratingEntrySchema>;
export type SubmitVoteInput = z.infer<typeof submitVoteSchema>;
export type VotingPlayer = z.infer<typeof votingPlayerSchema>;
export type VotingView = z.infer<typeof votingViewSchema>;
export type ResultPlayer = z.infer<typeof resultPlayerSchema>;
export type RoundResult = z.infer<typeof roundResultSchema>;
export type { VotingEndReason };
export { RESULT_HIGHLIGHT_DAYS, VOTING_END_REASONS } from '@fut-stats/domain';
