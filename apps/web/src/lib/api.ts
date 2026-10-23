import type { z } from 'zod';

/** Corpo de erro da API (`{ code, message }`), quando ela manda um. */
export type ApiErrorBody = { code?: string; message: string };

/** A API respondeu com status de erro (4xx/5xx). `body` traz o código e o texto da API, quando houver. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly body: ApiErrorBody | null = null,
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
  if (!res.ok) throw new ApiError(res.status, path, await readErrorBody(res));

  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) throw new ApiContractError(path, parsed.error.issues);
  return parsed.data;
}

type WriteMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function readErrorBody(res: Response): Promise<ApiErrorBody | null> {
  try {
    const json: unknown = await res.json();
    if (typeof json !== 'object' || json === null || !('message' in json)) return null;
    const { code, message } = json as { code?: unknown; message: unknown };
    if (typeof message !== 'string') return null;
    return typeof code === 'string' ? { code, message } : { message };
  } catch {
    return null;
  }
}

async function apiWrite<S extends z.ZodType>(
  method: WriteMethod,
  path: string,
  schema: S,
  body: unknown,
  { signal }: RequestOptions = {},
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
  if (!res.ok) throw new ApiError(res.status, path, await readErrorBody(res));

  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) throw new ApiContractError(path, parsed.error.issues);
  return parsed.data;
}

/** POST em /api{path}; sem `body`, não manda corpo. Valida a resposta como o `apiGet`. */
export const apiPost = <S extends z.ZodType>(
  path: string,
  schema: S,
  body?: unknown,
  options?: RequestOptions,
) => apiWrite('POST', path, schema, body, options);

/** PUT em /api{path} com corpo JSON. Valida a resposta como o `apiGet`. */
export const apiPut = <S extends z.ZodType>(
  path: string,
  schema: S,
  body: unknown,
  options?: RequestOptions,
) => apiWrite('PUT', path, schema, body, options);

/** Endereço do login com Google (redireciona para fora do app, então é navegação de página inteira). */
export const LOGIN_URL = '/api/auth/google';
