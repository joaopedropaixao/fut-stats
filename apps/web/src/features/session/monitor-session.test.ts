import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { monitorSession } from './monitor-session';
import { fetchSession, sessionQueryKey } from './use-session';

vi.mock('../../app/monitoring', () => ({ setMonitoringUser: vi.fn() }));

const me = {
  user: { id: 'u1', name: 'Ronaldo', email: 'ro@exemplo.com', avatarUrl: null },
  groups: [],
};

function setup() {
  const queryClient = new QueryClient();
  const setUser = vi.fn();
  monitorSession(queryClient, setUser);
  return { queryClient, setUser };
}

describe('monitorSession', () => {
  it('a sessão carrega (a leitura do /me, de qualquer tela): o Sentry recebe só o id', async () => {
    const { queryClient, setUser } = setup();
    await queryClient.fetchQuery({ queryKey: sessionQueryKey, queryFn: async () => me });
    expect(setUser).toHaveBeenCalledTimes(1);
    expect(setUser).toHaveBeenCalledWith('u1');
  });

  it('o /me real passa pelo mesmo caminho (fetchSession como queryFn)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(me), { status: 200 })),
    );
    const { queryClient, setUser } = setup();
    await queryClient.fetchQuery({
      queryKey: sessionQueryKey,
      queryFn: ({ signal }) => fetchSession(signal),
    });
    vi.unstubAllGlobals();
    expect(setUser).toHaveBeenCalledWith('u1');
  });

  it('sem sessão (401 vira null): o Sentry fica sem usuário', async () => {
    const { queryClient, setUser } = setup();
    await queryClient.fetchQuery({ queryKey: sessionQueryKey, queryFn: async () => null });
    expect(setUser).toHaveBeenCalledWith(null);
  });

  it('"Sair da conta" (limpa o cache e grava null): setUser(null)', async () => {
    const { queryClient, setUser } = setup();
    await queryClient.fetchQuery({ queryKey: sessionQueryKey, queryFn: async () => me });
    setUser.mockClear();
    queryClient.clear();
    queryClient.setQueryData(sessionQueryKey, null);
    expect(setUser).toHaveBeenCalled();
    expect(setUser).toHaveBeenLastCalledWith(null);
  });

  it('outra consulta não mexe no usuário', async () => {
    const { queryClient, setUser } = setup();
    await queryClient.fetchQuery({ queryKey: ['groups', 'g1'], queryFn: async () => me });
    expect(setUser).not.toHaveBeenCalled();
  });
});
