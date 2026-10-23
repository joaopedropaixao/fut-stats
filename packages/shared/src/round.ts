import type { AttendanceError } from '@fut-stats/domain';
import { z } from 'zod';
import { positionSchema, roundStatusSchema } from './domain';

/** Tamanho máximo do texto do local (proteção de entrada, não regra da pelada). */
export const ROUND_LOCATION_MAX_LENGTH = 100;

/** Por que a presença (Vou / Não vou) não pode ser marcada. */
export const ATTENDANCE_ERROR_LABELS: Readonly<Record<AttendanceError, string>> = {
  ATTENDANCE_CLOSED: 'O jogo já começou: a presença não muda mais',
  NOT_OWN_ATTENDANCE: 'Você só pode marcar a sua própria presença',
  TEAMS_ALREADY_PUBLISHED: 'Os times já foram publicados: fale com o admin para mudar',
};

/** Textos dos "não pode" da rodada (`isRoundEditable` / `isRoundDeletable` no domain). */
export const ROUND_NOT_EDITABLE_LABEL = 'Depois que o jogo começa, data e local não mudam mais';
export const ROUND_NOT_DELETABLE_LABEL = 'Só dá para apagar a rodada antes do jogo';

/** Data e hora com fuso (ISO 8601), ex.: `2026-10-29T20:00:00-03:00`. */
const scheduledAtSchema = z.iso.datetime({
  offset: true,
  error: 'Informe data e hora válidas',
});

/** Local: espaço nas pontas é removido; vazio vira `null` (sem local). */
const locationSchema = z
  .string()
  .trim()
  .max(ROUND_LOCATION_MAX_LENGTH, `O local pode ter até ${ROUND_LOCATION_MAX_LENGTH} caracteres`)
  .transform((value) => value || null)
  .nullable();

/** Corpo de POST /api/groups/:groupId/rounds. */
export const createRoundSchema = z.object({
  scheduledAt: scheduledAtSchema,
  location: locationSchema.optional().transform((value) => value ?? null),
});

/** Corpo de PATCH /api/groups/:groupId/rounds/:roundId: só o que muda. */
export const updateRoundSchema = z
  .object({ scheduledAt: scheduledAtSchema, location: locationSchema })
  .partial()
  .refine((input) => input.scheduledAt !== undefined || input.location !== undefined, {
    message: 'Informe o que mudar: data e hora ou local',
  });

/** Corpo de PUT /api/groups/:groupId/rounds/:roundId/attendances/:membershipId (Vou = true). */
export const setAttendanceSchema = z.object({ confirmed: z.boolean() });

/** Uma rodada na lista do grupo. */
export const roundSummarySchema = z.object({
  id: z.string(),
  /** Número da rodada no grupo ("RODADA 12"), dado pelo banco na criação. */
  number: z.number().int().positive(),
  scheduledAt: z.iso.datetime(),
  location: z.string().nullable(),
  status: roundStatusSchema,
  confirmedCount: z.number().int(),
});

/** Resposta de GET /api/groups/:groupId/rounds: próximas (mais perto primeiro) e passadas (mais recente primeiro). */
export const roundListSchema = z.object({
  upcoming: z.array(roundSummarySchema),
  past: z.array(roundSummarySchema),
});

/** Membro ativo na lista de presença. */
export const attendanceMemberSchema = z.object({
  membershipId: z.string(),
  nickname: z.string(),
  photoUrl: z.string().nullable(),
  primaryPosition: positionSchema,
  isHiredGoalkeeper: z.boolean(),
});

/** Detalhe da rodada com a lista de presença (só membros ativos). */
export const roundDetailSchema = roundSummarySchema.extend({
  /** A resposta de quem pediu: `true` = Vou, `false` = Não vou, `null` = não respondeu. */
  myAttendance: z.boolean().nullable(),
  attendance: z.object({
    confirmed: z.array(attendanceMemberSchema),
    declined: z.array(attendanceMemberSchema),
    pending: z.array(attendanceMemberSchema),
  }),
});

export type CreateRoundInput = z.infer<typeof createRoundSchema>;
export type UpdateRoundInput = z.infer<typeof updateRoundSchema>;
export type SetAttendanceInput = z.infer<typeof setAttendanceSchema>;
export type RoundSummary = z.infer<typeof roundSummarySchema>;
export type RoundList = z.infer<typeof roundListSchema>;
export type AttendanceMember = z.infer<typeof attendanceMemberSchema>;
export type RoundDetail = z.infer<typeof roundDetailSchema>;
