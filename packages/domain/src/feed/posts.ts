import type { TextFieldError } from '../group/group';
import type { RoundActor } from '../round/events';

/** Resenha: título opcional até 60 caracteres; texto obrigatório até 1000, com quebra de linha. */
export const POST_TITLE_MAX_LENGTH = 60;
export const POST_BODY_MAX_LENGTH = 1000;
/** Comentário: até 280 caracteres, com quebra de linha. */
export const COMMENT_MAX_LENGTH = 280;

/** Por que a resenha é inválida. Textos de UI em `POST_INPUT_ERROR_LABELS` (shared). */
export const POST_INPUT_ERRORS = [
  'TITLE_TOO_LONG',
  'BODY_EMPTY',
  'BODY_TOO_LONG',
  'INVALID_CHARACTERS',
] as const;

export type PostInputError = (typeof POST_INPUT_ERRORS)[number];

/** As 5 reações de uma resenha (uma por pessoa): bola, fogo, risada, palmas e perna de pau. */
export const POST_REACTIONS = ['BALL', 'FIRE', 'LAUGH', 'CLAP', 'FLOP'] as const;

export type PostReaction = (typeof POST_REACTIONS)[number];

/**
 * Valida título e texto da resenha (já sem espaço nas pontas e em NFC). Conta caractere visível, como o apelido;
 * quebra de linha vale; demais caracteres inválidos seguem `hasInvalidCharacters`. Lista vazia = válida.
 */
export function validatePostInput(input: { title: string | null; body: string }): PostInputError[] {
  void input;
  throw new Error('validatePostInput: não implementado (dev-back)');
}

/** Valida o texto do comentário (mesma regra de caractere da resenha). `null` = válido. */
export function validateCommentText(text: string): TextFieldError | null {
  void text;
  throw new Error('validateCommentText: não implementado (dev-back)');
}

/** Escrever, editar, apagar e compartilhar resenha: só admin (de qualquer admin). */
export function canManagePost(actor: RoundActor): boolean {
  void actor;
  throw new Error('canManagePost: não implementado (dev-back)');
}

/** Apagar comentário: o autor ou um admin. */
export function canDeleteComment(actor: RoundActor, authorId: string): boolean {
  void actor;
  void authorId;
  throw new Error('canDeleteComment: não implementado (dev-back)');
}
