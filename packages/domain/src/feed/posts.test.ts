import { describe, expect, it } from 'vitest';
import {
  canDeleteComment,
  canManagePost,
  COMMENT_MAX_LENGTH,
  POST_BODY_MAX_LENGTH,
  POST_TITLE_MAX_LENGTH,
  validateCommentText,
  validatePostInput,
} from './posts';

describe('validatePostInput', () => {
  const body = 'Foi um jogaço.';

  it('C5: título com 61 caracteres', () => {
    expect(validatePostInput({ title: 'a'.repeat(POST_TITLE_MAX_LENGTH + 1), body })).toEqual([
      'TITLE_TOO_LONG',
    ]);
  });

  it('C5: título com 60 caracteres e sem título valem', () => {
    expect(validatePostInput({ title: 'a'.repeat(POST_TITLE_MAX_LENGTH), body })).toEqual([]);
    expect(validatePostInput({ title: null, body })).toEqual([]);
  });

  it('C5: texto vazio (só espaços e quebras)', () => {
    expect(validatePostInput({ title: null, body: '' })).toEqual(['BODY_EMPTY']);
    expect(validatePostInput({ title: null, body: '   ' })).toEqual(['BODY_EMPTY']);
    expect(validatePostInput({ title: null, body: ' \n \n ' })).toEqual(['BODY_EMPTY']);
  });

  it('C5: texto com 1001 caracteres; 1000 vale', () => {
    expect(validatePostInput({ title: null, body: 'a'.repeat(POST_BODY_MAX_LENGTH + 1) })).toEqual([
      'BODY_TOO_LONG',
    ]);
    expect(validatePostInput({ title: null, body: 'a'.repeat(POST_BODY_MAX_LENGTH) })).toEqual([]);
  });

  it('C5: texto com \\0 e outros caracteres de controle', () => {
    expect(validatePostInput({ title: null, body: 'oi\0tchau' })).toEqual(['INVALID_CHARACTERS']);
    expect(validatePostInput({ title: null, body: 'oi\ttchau' })).toEqual(['INVALID_CHARACTERS']);
    expect(validatePostInput({ title: null, body: 'oi​tchau' })).toEqual(['INVALID_CHARACTERS']);
  });

  it('C5: texto com quebra de linha vale (\\n, \\r\\n e linha em branco)', () => {
    expect(validatePostInput({ title: null, body: 'linha 1\nlinha 2' })).toEqual([]);
    expect(validatePostInput({ title: null, body: 'linha 1\r\nlinha 2' })).toEqual([]);
    expect(validatePostInput({ title: null, body: 'um\n\ndois' })).toEqual([]);
  });

  it('quebra de linha conta como um caractere no limite', () => {
    const exato = `${'a'.repeat(499)}\n${'b'.repeat(500)}`;
    expect(validatePostInput({ title: null, body: exato })).toEqual([]);
    expect(validatePostInput({ title: null, body: `${exato}c` })).toEqual(['BODY_TOO_LONG']);
  });

  it('CR solto (sem LF) é inválido', () => {
    expect(validatePostInput({ title: null, body: 'a\rb' })).toEqual(['INVALID_CHARACTERS']);
  });

  it('título não aceita quebra de linha', () => {
    expect(validatePostInput({ title: 'a\nb', body })).toEqual(['INVALID_CHARACTERS']);
  });

  it('emoji composto conta como um caractere', () => {
    const familia = '👨‍👩‍👧‍👦';
    expect(
      validatePostInput({
        title: familia.repeat(POST_TITLE_MAX_LENGTH),
        body: familia.repeat(POST_BODY_MAX_LENGTH),
      }),
    ).toEqual([]);
  });

  it('junta os erros do título e do texto', () => {
    expect(validatePostInput({ title: 'a'.repeat(61), body: ' ' }).sort()).toEqual([
      'BODY_EMPTY',
      'TITLE_TOO_LONG',
    ]);
  });
});

describe('validateCommentText', () => {
  it('C6: comentário vazio', () => {
    expect(validateCommentText('')).toBe('EMPTY');
    expect(validateCommentText('   ')).toBe('EMPTY');
  });

  it('C6: comentário com 281 caracteres; 280 vale', () => {
    expect(validateCommentText('a'.repeat(COMMENT_MAX_LENGTH + 1))).toBe('TOO_LONG');
    expect(validateCommentText('a'.repeat(COMMENT_MAX_LENGTH))).toBeNull();
  });

  it('C6: emoji composto conta 1', () => {
    expect(validateCommentText('👨‍👩‍👧‍👦'.repeat(COMMENT_MAX_LENGTH))).toBeNull();
    expect(validateCommentText('👨‍👩‍👧‍👦'.repeat(COMMENT_MAX_LENGTH + 1))).toBe('TOO_LONG');
  });

  it('C6: quebra de linha vale; caractere inválido não', () => {
    expect(validateCommentText('boa\nresenha')).toBeNull();
    expect(validateCommentText('boa\0resenha')).toBe('INVALID_CHARACTERS');
  });
});

describe('permissões', () => {
  const admin = { id: 'a1', isAdmin: true };
  const player = { id: 'p1', isAdmin: false };

  it('C7: só admin gerencia resenha', () => {
    expect(canManagePost(admin)).toBe(true);
    expect(canManagePost(player)).toBe(false);
  });

  it('C7: o autor e o admin apagam o comentário; outro jogador não', () => {
    expect(canDeleteComment(player, 'p1')).toBe(true);
    expect(canDeleteComment(admin, 'p1')).toBe(true);
    expect(canDeleteComment(player, 'p2')).toBe(false);
  });
});
