import { meResponseSchema } from '@fut-stats/shared';
import { z } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiContractError, ApiError, apiGet, apiPost, apiPut } from './api';

const me = {
  user: { id: 'u1', name: 'Ronaldo', email: 'ro@exemplo.com', avatarUrl: null },
  groups: [{ id: 'g1', name: 'Pelada', slug: 'pelada', role: 'ADMIN' }],
};

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiGet', () => {
  it('chama /api{path} e devolve o corpo validado pelo schema', async () => {
    const fetchMock = mockFetch(200, me);

    await expect(apiGet('/me', meResponseSchema)).resolves.toEqual(me);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me',
      expect.objectContaining({ credentials: 'same-origin' }),
    );
  });

  it('lança ApiError com o status quando a API responde erro', async () => {
    mockFetch(401, { message: 'Unauthorized' });

    const err = await apiGet('/me', meResponseSchema).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
  });

  it('lança ApiContractError quando o corpo foge do contrato', async () => {
    mockFetch(200, { user: { id: 'u1' }, groups: [] });

    const err = await apiGet('/me', meResponseSchema).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiContractError);
    expect((err as ApiContractError).issues.length).toBeGreaterThan(0);
  });
});

describe('apiPut e apiPost', () => {
  const okSchema = z.object({ ok: z.boolean() });

  it('mandam o corpo em JSON com o método certo e validam a resposta', async () => {
    const fetchMock = mockFetch(200, { ok: true });

    await expect(apiPut('/x', okSchema, { a: 1 })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/x',
      expect.objectContaining({
        method: 'PUT',
        body: '{"a":1}',
        credentials: 'same-origin',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );

    await apiPost('/y', okSchema);
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/y',
      expect.objectContaining({ method: 'POST', body: undefined }),
    );
  });

  it('lançam ApiError com status e o { code, message } da API', async () => {
    mockFetch(409, { code: 'INVALID_LINEUP', message: 'Times incompletos', statusCode: 409 });

    const err = await apiPost('/publish', okSchema).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
    expect((err as ApiError).body).toEqual({
      code: 'INVALID_LINEUP',
      message: 'Times incompletos',
    });
  });

  it('erro sem corpo no formato da API deixa body nulo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Bad Gateway', { status: 502 })),
    );

    const err = await apiPut('/x', okSchema, {}).catch((e: unknown) => e);
    expect((err as ApiError).status).toBe(502);
    expect((err as ApiError).body).toBeNull();
  });

  it('resposta fora do contrato vira ApiContractError', async () => {
    mockFetch(200, { ok: 'sim' });
    await expect(apiPost('/x', okSchema)).rejects.toBeInstanceOf(ApiContractError);
  });
});
