import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { restartQuery } from './server-wait-view';

/** Uma consulta que nunca responde (o servidor dormindo) e uma que falha logo (o 500), observadas como o `useQuery` faz. */
function setup(queryFn: () => Promise<unknown>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const queryKey = ['me'];
  const observer = new QueryObserver(client, { queryKey, queryFn });
  const unsubscribe = observer.subscribe(() => {});
  return { client, queryKey, observer, unsubscribe };
}

describe('"Tentar de novo" da espera do servidor (C19)', () => {
  it('só refetch() de uma consulta pendurada não refaz o pedido (a causa do bug)', async () => {
    const queryFn = vi.fn(() => new Promise(() => {}));
    const { observer, unsubscribe } = setup(queryFn);
    expect(queryFn).toHaveBeenCalledTimes(1);
    void observer.refetch();
    await Promise.resolve();
    expect(queryFn).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('restartQuery cancela o pedido pendurado e sai uma chamada nova', async () => {
    const queryFn = vi.fn(() => new Promise(() => {}));
    const { client, queryKey, observer, unsubscribe } = setup(queryFn);
    expect(queryFn).toHaveBeenCalledTimes(1);
    void restartQuery(client, queryKey, () => observer.refetch());
    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    unsubscribe();
  });

  it('cancela só a chave da consulta e só se ela estiver sem dado e buscando: outras consultas não são revertidas', async () => {
    const hanging = vi.fn(() => new Promise(() => {}));
    const other = vi.fn(() => new Promise(() => {}));
    const { client, queryKey, observer, unsubscribe } = setup(hanging);
    const otherObserver = new QueryObserver(client, { queryKey: ['me', 'outra'], queryFn: other });
    const stop = otherObserver.subscribe(() => {});
    const cancel = vi.spyOn(client, 'cancelQueries');
    void restartQuery(client, queryKey, () => observer.refetch());
    await vi.waitFor(() => expect(hanging).toHaveBeenCalledTimes(2));
    expect(cancel).toHaveBeenCalledWith({ queryKey, exact: true });
    expect(other).toHaveBeenCalledTimes(1);
    expect(otherObserver.getCurrentResult().fetchStatus).toBe('fetching');
    stop();
    unsubscribe();
  });

  it('com dado em cache e sem pedido pendente, não cancela nada: só refaz', async () => {
    const queryFn = vi.fn(() => Promise.resolve({ ok: true }));
    const { client, queryKey, observer, unsubscribe } = setup(queryFn);
    await vi.waitFor(() => expect(observer.getCurrentResult().data).toEqual({ ok: true }));
    const cancel = vi.spyOn(client, 'cancelQueries');
    await restartQuery(client, queryKey, () => observer.refetch());
    expect(cancel).not.toHaveBeenCalled();
    expect(queryFn).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('com o 500 já resolvido, tentar de novo refaz uma vez e o resultado novo vale', async () => {
    let calls = 0;
    const queryFn = vi.fn(() => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error('500')) : Promise.resolve({ ok: true });
    });
    const { client, queryKey, observer, unsubscribe } = setup(queryFn);
    await vi.waitFor(() => expect(observer.getCurrentResult().isError).toBe(true));
    await restartQuery(client, queryKey, () => observer.refetch());
    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(observer.getCurrentResult().data).toEqual({ ok: true });
    unsubscribe();
  });
});
