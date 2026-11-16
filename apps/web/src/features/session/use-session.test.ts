import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiContractError, ApiError } from '../../lib/api';
import { fetchSession } from './use-session';

const me = {
  user: { id: 'u1', name: 'Ronaldo', email: 'ro@exemplo.com', avatarUrl: null },
  groups: [
    {
      id: 'g1',
      name: 'Pelada',
      slug: 'pelada',
      role: 'ADMIN',
      membershipId: 'm1',
      nickname: 'Beto',
      avatar: { skin: 'TAN', hair: 'SHORT', hairColor: 'BLACK' },
    },
  ],
};

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchSession', () => {
  it('devolve a sessão validada pelo schema carregado sob demanda', async () => {
    mockFetch(200, me);
    await expect(fetchSession()).resolves.toEqual(me);
  });

  it('devolve null sem sessão (401)', async () => {
    mockFetch(401, { message: 'Unauthorized' });
    await expect(fetchSession()).resolves.toBeNull();
  });

  it('resposta fora do contrato continua dando erro de contrato (não passa sem validar)', async () => {
    mockFetch(200, { user: { id: 'u1' }, groups: [] });
    await expect(fetchSession()).rejects.toBeInstanceOf(ApiContractError);
  });

  it('erro de servidor continua erro (a tela mostra "Tentar de novo")', async () => {
    mockFetch(500, { message: 'boom' });
    await expect(fetchSession()).rejects.toBeInstanceOf(ApiError);
  });
});
