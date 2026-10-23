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

async function send(method: string, path: string, body: unknown, signal?: AbortSignal) {
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

/** POST em /api{path} com corpo JSON, validando a resposta com o schema do @fut-stats/shared. */
export async function apiPost<S extends z.ZodType>(
  path: string,
  schema: S,
  body?: unknown,
  { signal }: RequestOptions = {},
): Promise<z.output<S>> {
  const res = await send('POST', path, body, signal);
  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) throw new ApiContractError(path, parsed.error.issues);
  return parsed.data;
}

/** POST que responde sem corpo (204), como o logout. */
export async function apiPostNoContent(path: string, body?: unknown): Promise<void> {
  await send('POST', path, body);
}

/** Endereço do login com Google (redireciona para fora do app, então é navegação de página inteira). */
export const LOGIN_URL = '/api/auth/google';
