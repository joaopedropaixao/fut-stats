import { DEFAULT_AVATAR, validateGroupName, validateNickname } from '@fut-stats/domain';
import type {
  AvatarHair,
  AvatarHairColor,
  AvatarSkin,
  JoinGroupError,
  MemberAdminChangeError,
  PlayerAvatar,
  PlayerPositionsError,
  TextFieldError,
} from '@fut-stats/domain';
import { z } from 'zod';
import { myGroupSchema, roleSchema } from './auth';
import { avatarSchema, positionSchema, ratingSchema } from './domain';

export type { PlayerAvatar };

/** Por que um texto (apelido, nome do grupo) é inválido. */
export const NICKNAME_ERROR_LABELS: Readonly<Record<TextFieldError, string>> = {
  EMPTY: 'Informe o apelido',
  TOO_LONG: 'O apelido pode ter até 10 caracteres',
  INVALID_CHARACTERS: 'O apelido tem um caractere inválido',
};

export const GROUP_NAME_ERROR_LABELS: Readonly<Record<TextFieldError, string>> = {
  EMPTY: 'Informe o nome da pelada',
  TOO_LONG: 'O nome da pelada pode ter até 50 caracteres',
  INVALID_CHARACTERS: 'O nome da pelada tem um caractere inválido',
};

/** Por que não dá para entrar no grupo pelo convite. */
export const JOIN_GROUP_ERROR_LABELS: Readonly<Record<JoinGroupError, string>> = {
  MEMBERSHIP_INACTIVE: 'Sua participação nesta pelada está desativada. Fale com o admin.',
};

/** Nomes das opções do bonequinho (também para leitor de tela). */
export const AVATAR_SKIN_LABELS: Readonly<Record<AvatarSkin, string>> = {
  LIGHT: 'Pele clara',
  FAIR: 'Pele morena clara',
  TAN: 'Pele morena',
  BROWN: 'Pele marrom',
  DARK: 'Pele escura',
};

export const AVATAR_HAIR_LABELS: Readonly<Record<AvatarHair, string>> = {
  BALD: 'Careca',
  SHORT: 'Curto',
  CURLY: 'Cacheado',
  AFRO: 'Black power',
  LONG: 'Comprido',
  MOHAWK: 'Moicano',
};

export const AVATAR_HAIR_COLOR_LABELS: Readonly<Record<AvatarHairColor, string>> = {
  BLACK: 'Preto',
  BROWN: 'Castanho',
  BLOND: 'Loiro',
  RED: 'Ruivo',
  GRAY: 'Grisalho',
};

/** Por que a posição principal e as secundárias não combinam. */
export const PLAYER_POSITIONS_ERROR_LABELS: Readonly<Record<PlayerPositionsError, string>> = {
  SECONDARY_IS_PRIMARY: 'A posição secundária não pode ser a principal',
  DUPLICATE_SECONDARY: 'Posição secundária repetida',
  GOALKEEPER_AS_SECONDARY: 'Goleiro não pode ser posição secundária',
  GOALKEEPER_HAS_SECONDARY: 'Goleiro joga só no gol',
  TOO_MANY_SECONDARIES: 'No máximo 2 posições secundárias',
};

/** Por que o admin não pode fazer essa mudança de papel ou de ativo. */
export const MEMBER_ADMIN_CHANGE_ERROR_LABELS: Readonly<Record<MemberAdminChangeError, string>> = {
  SELF_CHANGE: 'Você não muda o próprio papel nem se desativa',
};

/** 409 `NICKNAME_TAKEN`: outro membro ativo já usa o apelido (ignora maiúscula e acento). */
export const NICKNAME_TAKEN_LABEL = 'Esse apelido já está em uso no grupo';

/** 403 `NOT_OWN_PROFILE`: jogador comum editando outro membro. */
export const NOT_OWN_PROFILE_LABEL = 'Você só edita o seu próprio perfil';

/** Apelido: sem espaço nas pontas e em NFC (acento composto, igual em toda origem); até 10 caracteres. */
export const nicknameSchema = z
  .string()
  .trim()
  .normalize('NFC')
  .superRefine((value, ctx) => {
    const error = validateNickname(value);
    if (error) ctx.addIssue({ code: 'custom', message: NICKNAME_ERROR_LABELS[error] });
  });

export const groupNameSchema = z
  .string()
  .trim()
  .normalize('NFC')
  .superRefine((value, ctx) => {
    const error = validateGroupName(value);
    if (error) ctx.addIssue({ code: 'custom', message: GROUP_NAME_ERROR_LABELS[error] });
  });

/** O mínimo para ser jogador do grupo. O resto do perfil (secundárias, nota) é editado depois.
 * Sem `avatar`, entra o `DEFAULT_AVATAR` (clientes antigos seguem valendo). */
const playerEntrySchema = z.object({
  nickname: nicknameSchema,
  primaryPosition: positionSchema,
  avatar: avatarSchema.default(DEFAULT_AVATAR),
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
  avatar: avatarSchema,
});

/** Linha do Elenco (admin): o membro mais o que só o admin vê. */
export const rosterMemberSchema = memberSchema.extend({
  initialRating: ratingSchema,
  active: z.boolean(),
});

/**
 * Corpo de PATCH /api/groups/:groupId/members/:membershipId: só o que muda.
 * Os 4 últimos campos são só do admin. As posições são validadas no service com o estado final
 * (o que veio + o que já estava), via `validatePlayerPositions`.
 */
export const updateMemberSchema = z
  .object({
    nickname: nicknameSchema,
    avatar: avatarSchema,
    primaryPosition: positionSchema,
    secondaryPositions: z.array(positionSchema),
    initialRating: ratingSchema,
    isHiredGoalkeeper: z.boolean(),
    role: roleSchema,
    active: z.boolean(),
  })
  .partial()
  .refine((input) => Object.keys(input).length > 0, { message: 'Informe o que mudar' });

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
export type RosterMember = z.infer<typeof rosterMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type Invite = z.infer<typeof inviteSchema>;
export type InvitePreview = z.infer<typeof invitePreviewSchema>;
