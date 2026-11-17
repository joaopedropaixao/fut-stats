import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Cabeçalho que identifica o pedido: chega do cliente (se válido) e sempre volta na resposta. */
export const REQUEST_ID_HEADER = 'x-request-id';

/** O que o pedido em andamento sabe sobre si, sem passar parâmetro pela pilha toda. */
export interface RequestContext {
  requestId: string;
  /** Preenchidos pelos guards de sessão e de grupo, conforme o pedido avança. */
  userId?: string;
  groupId?: string;
  /** O `code` do corpo do erro (ex.: `NOT_OWN_COMMENT`), anotado pelo filtro de exceção; vai para o log de pedido. */
  errorCode?: string;
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

const storage = new AsyncLocalStorage<RequestContext>();

/** O `x-request-id` recebido se for seguro de pôr em log e cabeçalho; senão, um UUID novo. */
export function resolveRequestId(incoming: unknown): string {
  return typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming)
    ? incoming
    : randomUUID();
}

/** Contexto do pedido em andamento; `undefined` fora de um pedido (relógio da votação, seed, scripts). */
export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** O id do pedido em andamento; nulo fora de um pedido. */
export function getRequestId(): string | null {
  return storage.getStore()?.requestId ?? null;
}

/** Completa o contexto do pedido (usuário e grupo pelos guards, `errorCode` pelo filtro de exceção). */
export function annotateRequestContext(
  patch: Partial<Pick<RequestContext, 'userId' | 'groupId' | 'errorCode'>>,
): void {
  const context = storage.getStore();
  if (context) Object.assign(context, patch);
}

/** Primeiro middleware da app: abre o contexto do pedido e devolve o `x-request-id` na resposta. */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
  res.setHeader(REQUEST_ID_HEADER, requestId);
  storage.run({ requestId }, next);
}
