import type { z } from 'zod';

/** A API respondeu com status de erro (4xx/5xx). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
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
  if (!res.ok) throw new ApiError(res.status, path);

  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) throw new ApiContractError(path, parsed.error.issues);
  return parsed.data;
}

/** Endereço do login com Google (redireciona para fora do app, então é navegação de página inteira). */
export const LOGIN_URL = '/api/auth/google';
