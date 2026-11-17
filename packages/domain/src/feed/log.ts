import { ROUND_LOG_ACTIONS, type RoundLogAction } from '../round/log';

/**
 * Ações do feed que entram no registro de auditoria (quem fez o quê e quando): publicar, editar e apagar resenha,
 * comentar e apagar comentário, colocar/trocar e tirar reação.
 *
 * Só o vocabulário: gravar é da API, na mesma transação da escrita. Leitura do feed nunca entra, nem `PUT` de
 * reação igual à que já existe (não muda nada). O registro do feed é interno: quem lê é o dono, direto no banco.
 */
export const FEED_LOG_ACTIONS = [
  'POST_CREATED',
  'POST_EDITED',
  'POST_DELETED',
  'COMMENT_CREATED',
  'COMMENT_DELETED',
  'REACTION_SET',
  'REACTION_REMOVED',
] as const;

export type FeedLogAction = (typeof FEED_LOG_ACTIONS)[number];

/** Tudo o que o registro de auditoria guarda: as ações da rodada e as do feed (igual ao enum `AuditAction` do banco). */
export const AUDIT_ACTIONS = [...ROUND_LOG_ACTIONS, ...FEED_LOG_ACTIONS] as const;

export type AuditAction = RoundLogAction | FeedLogAction;
