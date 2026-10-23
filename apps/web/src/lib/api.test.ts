import { meResponseSchema } from '@fut-stats/shared';
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

describe('apiPost / apiPut', () => {
  it('manda o corpo em JSON e valida a resposta', async () => {
    const fetchMock = mockFetch(201, me);

    await expect(apiPost('/x', meResponseSchema, { body: { a: 1 } })).resolves.toEqual(me);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/x',
      expect.objectContaining({
        method: 'POST',
        body: '{"a":1}',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
  });

  it('erro de regra vira ApiError com status e { code, message }', async () => {
    mockFetch(409, { code: 'ROUND_NOT_OPEN', message: 'Só dá para lançar durante o jogo' });

    await expect(apiPut('/x', meResponseSchema, { body: {} })).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      body: { code: 'ROUND_NOT_OPEN', message: 'Só dá para lançar durante o jogo' },
    });
  });

  it('erro sem corpo de regra fica só com o status', async () => {
    mockFetch(500, { statusCode: 500 });

    const err = await apiPut('/x', meResponseSchema).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).body).toBeUndefined();
  });
});
