import { invitePreviewSchema, meResponseSchema } from '@fut-stats/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiContractError, ApiError, apiGet, apiPost, apiPostNoContent } from './api';

const me = {
  user: { id: 'u1', name: 'Ronaldo', email: 'ro@exemplo.com', avatarUrl: null },
  groups: [{ id: 'g1', name: 'Pelada', slug: 'pelada', role: 'ADMIN', membershipId: 'm1' }],
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

describe('apiPost', () => {
  const preview = { groupName: 'Pelada', memberCount: 3 };

  it('manda o corpo em JSON e valida a resposta', async () => {
    const fetchMock = mockFetch(201, preview);

    await expect(apiPost('/x', invitePreviewSchema, { a: 1 })).resolves.toEqual(preview);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/x',
      expect.objectContaining({ method: 'POST', body: '{"a":1}' }),
    );
  });

  it('guarda o { code, message } do erro no ApiError', async () => {
    mockFetch(409, { code: 'MEMBERSHIP_INACTIVE', message: 'Fale com o admin' });

    const err = await apiPost('/x', invitePreviewSchema, {}).catch((e: unknown) => e);
    expect((err as ApiError).status).toBe(409);
    expect((err as ApiError).body).toEqual({
      code: 'MEMBERSHIP_INACTIVE',
      message: 'Fale com o admin',
    });
  });

  it('aceita resposta sem corpo (204)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    await expect(apiPostNoContent('/auth/logout')).resolves.toBeUndefined();
  });
});
