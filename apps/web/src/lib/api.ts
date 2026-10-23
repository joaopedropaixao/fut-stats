import type { z } from 'zod';

/** A API respondeu com status de erro (4xx/5xx). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    /** Corpo `{ code, message }` quando a API mandou um. */
    readonly body?: { code?: string; message?: string },
  ) {
    super(`HTTP ${status} em ${path}`);
    this.name = 'ApiError';
  }
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

async function readErrorBody(res: Response): Promise<ApiError['body']> {
  try {
    const json: unknown = await res.json();
    if (typeof json !== 'object' || json === null) return undefined;
    const { code, message } = json as Record<string, unknown>;
    return {
      code: typeof code === 'string' ? code : undefined,
      message: typeof message === 'string' ? message : undefined,
    };
  } catch {
    return undefined;
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function send(method: Method, path: string, body?: unknown, signal?: AbortSignal) {
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
  if (!res.ok) throw new ApiError(res.status, path, await readErrorBody(res));
  return res;
}

/** Daqui para dentro o front confia nos tipos; se a API mudar o contrato, o erro aparece aqui. */
async function parse<S extends z.ZodType>(res: Response, path: string, schema: S) {
  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) throw new ApiContractError(path, parsed.error.issues);
  return parsed.data;
}

/** GET em /api{path}, validando a resposta com o schema Zod do @fut-stats/shared. */
export async function apiGet<S extends z.ZodType>(
  path: string,
  schema: S,
  { signal }: RequestOptions = {},
): Promise<z.output<S>> {
  return parse(await send('GET', path, undefined, signal), path, schema);
}

/** POST em /api{path} com corpo JSON, validando a resposta com o schema do @fut-stats/shared. */
export async function apiPost<S extends z.ZodType>(
  path: string,
  schema: S,
  body?: unknown,
  { signal }: RequestOptions = {},
): Promise<z.output<S>> {
  return parse(await send('POST', path, body, signal), path, schema);
}

/** PUT em /api{path} com corpo JSON, validando a resposta como no `apiPost`. */
export async function apiPut<S extends z.ZodType>(
  path: string,
  schema: S,
  body: unknown,
  { signal }: RequestOptions = {},
): Promise<z.output<S>> {
  return parse(await send('PUT', path, body, signal), path, schema);
}

/** PATCH em /api{path} com corpo JSON, validando a resposta como no `apiPost`. */
export async function apiPatch<S extends z.ZodType>(
  path: string,
  schema: S,
  body: unknown,
  { signal }: RequestOptions = {},
): Promise<z.output<S>> {
  return parse(await send('PATCH', path, body, signal), path, schema);
}

/** DELETE em /api{path}; a API responde 204 sem corpo. */
export async function apiDelete(path: string, { signal }: RequestOptions = {}): Promise<void> {
  await send('DELETE', path, undefined, signal);
}

/** O texto de uma falha para mostrar à pessoa: a mensagem da API quando há, senão o `fallback`. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  return (err instanceof ApiError && err.body?.message) || fallback;
}

/** POST que responde sem corpo (204), como o logout. */
export async function apiPostNoContent(path: string, body?: unknown): Promise<void> {
  await send('POST', path, body);
}

/** Endereço do login com Google (redireciona para fora do app, então é navegação de página inteira). */
export const LOGIN_URL = '/api/auth/google';
