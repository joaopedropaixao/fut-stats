import type { Post, PostList } from '@fut-stats/shared';
import { MutationObserver, QueryClient, type InfiniteData } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { postsKey, reactOptions } from './queries';

const author = {
  membershipId: 'm1',
  nickname: 'Ana',
  avatar: { skin: 'TAN', hair: 'SHORT', hairColor: 'BLACK' },
  role: 'PLAYER',
};

function post(ball: number, mine: Post['myReaction']): Post {
  return {
    id: 'p1',
    title: null,
    body: 'texto',
    author,
    createdAt: '2026-11-17T12:00:00.000Z',
    editedAt: null,
    reactions: { BALL: ball, CATFISH: 0, OSS: 0, YELLOW_CARD: 0, POPCORN: 0 },
    myReaction: mine,
    commentCount: 0,
    canManage: false,
  } as Post;
}

/** Um fetch que só responde quando o teste manda, na ordem que o teste quiser. */
function controlledFetch() {
  const calls: { method: string; resolve: (body: Post) => void }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((resolve) =>
          calls.push({
            method: init.method ?? 'GET',
            resolve: (body) => resolve(new Response(JSON.stringify(body), { status: 200 })),
          }),
        ),
    ),
  );
  return calls;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('reações em fila por resenha (corrida de toques rápidos)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('pôr e tirar a Bola rápido: a segunda chamada só sai depois da primeira e o cache termina sem a Bola', async () => {
    const calls = controlledFetch();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const pages: InfiniteData<PostList> = {
      pages: [{ items: [post(0, null)], nextCursor: null }],
      pageParams: [null],
    };
    client.setQueryData(postsKey('g1'), pages);
    const current = () =>
      client.getQueryData<InfiniteData<PostList>>(postsKey('g1'))?.pages[0]?.items[0];

    const put = new MutationObserver(client, reactOptions(client, 'g1', 'p1'));
    const del = new MutationObserver(client, reactOptions(client, 'g1', 'p1'));
    const first = put.mutate('BALL');
    await tick();
    const second = del.mutate(null);
    await tick();

    // Otimista dos dois na hora, mas só uma chamada na rede: a segunda espera na fila.
    expect(current()).toMatchObject({ myReaction: null, reactions: { BALL: 0 } });
    expect(calls.map((c) => c.method)).toEqual(['PUT']);

    // A resposta velha (com a Bola) chega, mas não é a última da fila: não mexe no cache.
    calls[0]!.resolve(post(1, 'BALL'));
    await first;
    await tick();
    expect(current()).toMatchObject({ myReaction: null, reactions: { BALL: 0 } });
    expect(calls.map((c) => c.method)).toEqual(['PUT', 'DELETE']);

    calls[1]!.resolve(post(0, null));
    await second;
    expect(current()).toMatchObject({ myReaction: null, reactions: { BALL: 0 } });
  });
});
