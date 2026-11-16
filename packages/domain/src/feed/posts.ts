import { validateMultilineText, validateText, type TextFieldError } from '../group/group';
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

/** As 5 reações de uma resenha (uma por pessoa): bola, bagre, OSS!, apito e pipocou. */
export const POST_REACTIONS = ['BALL', 'CATFISH', 'OSS', 'WHISTLE', 'POPCORN'] as const;

export type PostReaction = (typeof POST_REACTIONS)[number];

/**
 * Valida título e texto da resenha (já sem espaço nas pontas e em NFC). Conta caractere visível, como o apelido;
 * quebra de linha vale; demais caracteres inválidos seguem `hasInvalidCharacters`. Lista vazia = válida.
 */
export function validatePostInput(input: { title: string | null; body: string }): PostInputError[] {
  const errors = new Set<PostInputError>();
  if (input.title) {
    const title = validateText(input.title, POST_TITLE_MAX_LENGTH);
    if (title === 'TOO_LONG') errors.add('TITLE_TOO_LONG');
    else if (title === 'INVALID_CHARACTERS') errors.add('INVALID_CHARACTERS');
  }
  const body = validateMultilineText(input.body, POST_BODY_MAX_LENGTH);
  if (body === 'EMPTY') errors.add('BODY_EMPTY');
  else if (body === 'TOO_LONG') errors.add('BODY_TOO_LONG');
  else if (body === 'INVALID_CHARACTERS') errors.add('INVALID_CHARACTERS');
  return [...errors];
}

/** Valida o texto do comentário (mesma regra de caractere da resenha). `null` = válido. */
export function validateCommentText(text: string): TextFieldError | null {
  return validateMultilineText(text, COMMENT_MAX_LENGTH);
}

/** Escrever, editar, apagar e compartilhar resenha: só admin (de qualquer admin). */
export function canManagePost(actor: RoundActor): boolean {
  return actor.isAdmin;
}

/** Apagar comentário: o autor ou um admin. */
export function canDeleteComment(actor: RoundActor, authorId: string): boolean {
  return actor.isAdmin || actor.id === authorId;
}
