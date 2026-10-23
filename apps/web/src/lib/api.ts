import type { z } from 'zod';

/** Corpo de erro de regra de negócio da API: `code` para o código, `message` já em português para a tela. */
export type ApiErrorBody = { code: string; message: string };

/** A API respondeu com status de erro (4xx/5xx). `body` vem quando a API explicou o motivo ({ code, message }). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly body?: ApiErrorBody,
  ) {
    super(`HTTP ${status} em ${path}`);
    this.name = 'ApiError';
  }
}

async function readErrorBody(res: Response): Promise<ApiErrorBody | undefined> {
  try {
    const json: unknown = await res.json();
    if (json && typeof json === 'object' && 'code' in json && 'message' in json) {
      const { code, message } = json;
      if (typeof code === 'string' && typeof message === 'string') return { code, message };
    }
  } catch {
    // Sem corpo ou não é JSON: fica só o status.
  }
  return undefined;
}

/** A API respondeu 2xx, mas o corpo não bate com o contrato do @fut-stats/shared. */
export class ApiContractError extends Error {
  constructor(
    readonly path: string,
    readonly issues: z.ZodError['issues'],
  ) {
    super(`resposta inesperada da API em ${path}`);
    this.name = 'ApiContractError';
  }
}

type RequestOptions = { signal?: AbortSignal };

/**
 * GET em /api{path}, validando a resposta com o schema Zod do @fut-stats/shared.
 * Daqui para dentro o front confia nos tipos; se a API mudar o contrato, o erro aparece aqui.
 */
export async function apiGet<S extends z.ZodType>(
  path: string,
  schema: S,
  { signal }: RequestOptions = {},
): Promise<z.output<S>> {
  const res = await fetch(`/api${path}`, {
    signal,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  return parseResponse(res, path, schema);
}

async function parseResponse<S extends z.ZodType>(
  res: Response,
  path: string,
  schema: S,
): Promise<z.output<S>> {
  if (!res.ok) throw new ApiError(res.status, path, await readErrorBody(res));

  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) throw new ApiContractError(path, parsed.error.issues);
  return parsed.data;
}

type WriteOptions = RequestOptions & { body?: unknown };

async function apiWrite<S extends z.ZodType>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  schema: S,
  { body, signal }: WriteOptions = {},
): Promise<z.output<S>> {
  const res = await fetch(`/api${path}`, {
    method,
    signal,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parseResponse(res, path, schema);
}

/** POST em /api{path} com corpo JSON; a resposta é validada como no `apiGet`. */
export const apiPost = <S extends z.ZodType>(path: string, schema: S, options?: WriteOptions) =>
  apiWrite('POST', path, schema, options);

/** PUT em /api{path} com corpo JSON. */
export const apiPut = <S extends z.ZodType>(path: string, schema: S, options?: WriteOptions) =>
  apiWrite('PUT', path, schema, options);

/** PATCH em /api{path} com corpo JSON. */
export const apiPatch = <S extends z.ZodType>(path: string, schema: S, options?: WriteOptions) =>
  apiWrite('PATCH', path, schema, options);

/** DELETE em /api{path}; a resposta (se houver corpo) é validada pelo schema. */
export const apiDelete = <S extends z.ZodType>(path: string, schema: S, options?: WriteOptions) =>
  apiWrite('DELETE', path, schema, options);

/** Endereço do login com Google (redireciona para fora do app, então é navegação de página inteira). */
export const LOGIN_URL = '/api/auth/google';
