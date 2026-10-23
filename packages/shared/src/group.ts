import { validateGroupName, validateNickname } from '@fut-stats/domain';
import type { JoinGroupError, TextFieldError } from '@fut-stats/domain';
import { z } from 'zod';
import { myGroupSchema, roleSchema } from './auth';
import { positionSchema } from './domain';

/** Por que um texto (apelido, nome do grupo) é inválido. */
export const NICKNAME_ERROR_LABELS: Readonly<Record<TextFieldError, string>> = {
  EMPTY: 'Informe o apelido',
  TOO_LONG: 'O apelido pode ter até 10 caracteres',
};

export const GROUP_NAME_ERROR_LABELS: Readonly<Record<TextFieldError, string>> = {
  EMPTY: 'Informe o nome da pelada',
  TOO_LONG: 'O nome da pelada pode ter até 50 caracteres',
};

/** Por que não dá para entrar no grupo pelo convite. */
export const JOIN_GROUP_ERROR_LABELS: Readonly<Record<JoinGroupError, string>> = {
  MEMBERSHIP_INACTIVE: 'Sua participação nesta pelada está desativada. Fale com o admin.',
};

/** Apelido: espaço nas pontas é removido; até 10 caracteres. */
export const nicknameSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const error = validateNickname(value);
    if (error) ctx.addIssue({ code: 'custom', message: NICKNAME_ERROR_LABELS[error] });
  });

export const groupNameSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const error = validateGroupName(value);
    if (error) ctx.addIssue({ code: 'custom', message: GROUP_NAME_ERROR_LABELS[error] });
  });

/** O mínimo para ser jogador do grupo. O resto do perfil (foto, secundárias, nota) é editado depois. */
const playerEntrySchema = z.object({
  nickname: nicknameSchema,
  primaryPosition: positionSchema,
});

/** Corpo de POST /api/groups. Quem cria vira admin e também é jogador. */
export const createGroupSchema = playerEntrySchema.extend({ name: groupNameSchema });

/** Corpo de POST /api/invites/:code/join. */
export const joinGroupSchema = playerEntrySchema;

/** Um grupo visto por um membro: dados do grupo, o papel dele ali e quantos membros ativos tem. */
export const groupResponseSchema = myGroupSchema.extend({
  memberCount: z.number().int(),
});

/** Membro ativo, como a lista do grupo mostra. */
export const memberSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  photoUrl: z.string().nullable(),
  role: roleSchema,
  primaryPosition: positionSchema,
  secondaryPositions: z.array(positionSchema),
  isHiredGoalkeeper: z.boolean(),
});

/** Código do link de convite (só o admin vê). */
export const inviteSchema = z.object({ code: z.string() });

/** Prévia pública do convite: "Você foi convidado para a pelada X". */
export const invitePreviewSchema = z.object({
  groupName: z.string(),
  memberCount: z.number().int(),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type JoinGroupInput = z.infer<typeof joinGroupSchema>;
export type GroupResponse = z.infer<typeof groupResponseSchema>;
export type Member = z.infer<typeof memberSchema>;
export type Invite = z.infer<typeof inviteSchema>;
export type InvitePreview = z.infer<typeof invitePreviewSchema>;
