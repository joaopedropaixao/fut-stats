import {
  FEED_ALERT_TYPES,
  POST_REACTIONS,
  validateCommentText,
  validatePostInput,
  type FeedAlertType,
  type PostInputError,
  type PostReaction,
  type TextFieldError,
} from '@fut-stats/domain';
import { z } from 'zod';
import { roleSchema } from './auth';
import { avatarSchema, teamSchema } from './domain';

// Limites e listas do domain que as telas usam (contadores, ordem dos botões): o front importa daqui, sem copiar número.
export {
  COMMENT_MAX_LENGTH,
  FEED_ALERT_TYPES,
  POST_BODY_MAX_LENGTH,
  POST_REACTIONS,
  POST_TITLE_MAX_LENGTH,
  splitCharacters,
} from '@fut-stats/domain';
export type { FeedAlertType, PostReaction };

// --- Avisos ---

export const feedAlertTypeSchema = z.enum(FEED_ALERT_TYPES);

/** Tipo do aviso escrito na tela (linha e card). */
export const FEED_ALERT_LABELS: Readonly<Record<FeedAlertType, string>> = {
  IN_PROGRESS: 'Em jogo',
  POST_MATCH: 'Hora da Resenha',
  RESULT: 'O resultado saiu',
  VOTING: 'Votação aberta',
  TEAMS_PUBLISHED: 'Times publicados',
  PRESENCE: 'Presença aberta',
};

/** Um aviso de GET .../feed/alerts. A lista vem na ordem de prioridade (o primeiro é o aviso grande). */
export const feedAlertSchema = z.object({
  type: feedAlertTypeSchema,
  roundId: z.string(),
  roundNumber: z.number().int(),
  scheduledAt: z.iso.datetime(),
  /** O que quem pede tem a ver com o aviso; cada campo só vem no tipo em que faz sentido. */
  me: z.object({
    /** PRESENCE: true vou, false não vou, null não respondi. */
    attendance: z.boolean().nullable().optional(),
    /** TEAMS_PUBLISHED, IN_PROGRESS, POST_MATCH: null = não escalado. */
    team: teamSchema.nullable().optional(),
    /** VOTING. */
    played: z.boolean().optional(),
    /** VOTING. */
    voted: z.boolean().optional(),
  }),
});

// --- Resenhas ---

export const postReactionSchema = z.enum(POST_REACTIONS);

/** Nome de cada reação (leitor de tela e legenda). */
export const POST_REACTION_LABELS: Readonly<Record<PostReaction, string>> = {
  BALL: 'Bola',
  CATFISH: 'Bagre',
  OSS: 'OSS!',
  YELLOW_CARD: 'Cartão amarelo',
  POPCORN: 'Pipocou',
};

export const POST_INPUT_ERROR_LABELS: Readonly<Record<PostInputError, string>> = {
  TITLE_TOO_LONG: 'O título tem no máximo 60 caracteres',
  BODY_EMPTY: 'Escreva o texto da resenha',
  BODY_TOO_LONG: 'O texto tem no máximo 1000 caracteres',
  INVALID_CHARACTERS: 'O texto tem um caractere que não pode ser usado',
};

export const COMMENT_ERROR_LABELS: Readonly<Record<TextFieldError, string>> = {
  EMPTY: 'Escreva o comentário',
  TOO_LONG: 'O comentário tem no máximo 280 caracteres',
  INVALID_CHARACTERS: 'O comentário tem um caractere que não pode ser usado',
};

/** 403 `NOT_OWN_COMMENT`: jogador apagando comentário de outro. */
export const NOT_OWN_COMMENT_LABEL = 'Você só apaga o seu próprio comentário';

/** Corpo de POST e PATCH .../posts. Título vazio vira `null`. */
export const postInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .normalize('NFC')
      .transform((v) => v || null)
      .nullable()
      .optional(),
    body: z.string().trim().normalize('NFC'),
  })
  .superRefine((value, ctx) => {
    for (const error of validatePostInput({ title: value.title ?? null, body: value.body })) {
      ctx.addIssue({
        code: 'custom',
        message: POST_INPUT_ERROR_LABELS[error],
        path: [error === 'TITLE_TOO_LONG' ? 'title' : 'body'],
      });
    }
  });

export const reactionInputSchema = z.object({ reaction: postReactionSchema });

export const commentInputSchema = z.object({
  text: z
    .string()
    .trim()
    .normalize('NFC')
    .superRefine((value, ctx) => {
      const error = validateCommentText(value);
      if (error) ctx.addIssue({ code: 'custom', message: COMMENT_ERROR_LABELS[error] });
    }),
});

export const POSTS_PAGE_DEFAULT = 10;
export const POSTS_PAGE_MAX = 30;

/** Query de GET .../posts: da mais nova para a mais antiga, em páginas com cursor. */
export const postsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(POSTS_PAGE_MAX).default(POSTS_PAGE_DEFAULT),
  cursor: z.string().min(1).optional(),
});

/** Autor de resenha ou comentário (continua aparecendo mesmo se ficou inativo). */
export const authorSchema = z.object({
  membershipId: z.string(),
  nickname: z.string(),
  avatar: avatarSchema,
  role: roleSchema,
});

export const postSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  body: z.string(),
  author: authorSchema,
  createdAt: z.iso.datetime(),
  editedAt: z.iso.datetime().nullable(),
  /** Sempre as 5 chaves. */
  reactions: z.record(postReactionSchema, z.number().int()),
  myReaction: postReactionSchema.nullable(),
  commentCount: z.number().int(),
  /** Quem pede é admin: edita, apaga e compartilha. */
  canManage: z.boolean(),
});

export const postListSchema = z.object({
  items: z.array(postSchema),
  nextCursor: z.string().nullable(),
});

export const commentSchema = z.object({
  id: z.string(),
  author: authorSchema,
  text: z.string(),
  createdAt: z.iso.datetime(),
  /** Autor ou admin. */
  canDelete: z.boolean(),
});

export type FeedAlert = z.infer<typeof feedAlertSchema>;
export type PostInput = z.infer<typeof postInputSchema>;
export type ReactionInput = z.infer<typeof reactionInputSchema>;
export type CommentInput = z.infer<typeof commentInputSchema>;
export type PostsQuery = z.infer<typeof postsQuerySchema>;
export type Author = z.infer<typeof authorSchema>;
export type Post = z.infer<typeof postSchema>;
export type PostList = z.infer<typeof postListSchema>;
export type Comment = z.infer<typeof commentSchema>;
