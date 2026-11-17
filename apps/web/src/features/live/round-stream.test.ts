import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectRoundStream, type StreamSource } from './round-stream';
import { LEGACY_MS, RECONNECT_MS, type ChannelMode } from './stream-state';

type Handler = (event: MessageEvent<string>) => void;

class FakeSource implements StreamSource {
  static all: FakeSource[] = [];
  closed = false;
  private handlers = new Map<string, Handler[]>();
  constructor(readonly url: string) {
    FakeSource.all.push(this);
  }
  addEventListener(type: string, listener: Handler) {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), listener]);
  }
  close() {
    this.closed = true;
  }
  emit(type: string, data = '') {
    for (const handler of this.handlers.get(type) ?? []) {
      handler({ data } as MessageEvent<string>);
    }
  }
}

const parse = (data: string) => {
  try {
    const value: unknown = JSON.parse(data);
    return Array.isArray((value as { scopes?: unknown }).scopes)
      ? (value as { scopes: string[] }).scopes
      : null;
  } catch {
    return null;
  }
};

function setup() {
  const changed: (readonly string[])[] = [];
  const modes: ChannelMode[] = [];
  const close = connectRoundStream<string>({
    url: '/api/stream',
    parse,
    fallbackScopes: ['match', 'voting', 'status'],
    onChanged: (scopes) => changed.push(scopes),
    onMode: (mode) => modes.push(mode),
    createSource: (url) => new FakeSource(url),
  });
  return { changed, modes, close };
}

const last = () => FakeSource.all[FakeSource.all.length - 1]!;

beforeEach(() => {
  vi.useFakeTimers();
  FakeSource.all = [];
});
afterEach(() => vi.useRealTimers());

describe('round-stream: o canal ao vivo da rodada', () => {
  it('abre a conexão e, no ready, passa a tempo real e refaz os três escopos', () => {
    const { changed, modes } = setup();
    expect(FakeSource.all).toHaveLength(1);
    expect(last().url).toBe('/api/stream');
    expect(modes).toEqual(['polling']);
    last().emit('ready', '{}');
    expect(modes.at(-1)).toBe('live');
    expect(changed).toEqual([['match', 'voting', 'status']]);
  });

  it('cada changed vira os escopos da mensagem', () => {
    const { changed } = setup();
    last().emit('ready', '{}');
    last().emit('changed', JSON.stringify({ scopes: ['match'], at: 'x' }));
    last().emit('changed', JSON.stringify({ scopes: ['voting', 'status'], at: 'x' }));
    expect(changed.slice(1)).toEqual([['match'], ['voting', 'status']]);
  });

  it('mensagem fora do contrato refaz tudo (e nunca lança erro)', () => {
    const { changed } = setup();
    last().emit('ready', '{}');
    last().emit('changed', 'isto não é json');
    expect(changed.at(-1)).toEqual(['match', 'voting', 'status']);
  });

  it('caiu: volta ao modo antigo, tenta de novo em 3 s e refaz tudo ao reconectar', () => {
    const { changed, modes } = setup();
    last().emit('ready', '{}');
    const first = last();
    first.emit('error');
    expect(first.closed).toBe(true);
    expect(modes.at(-1)).toBe('polling');
    expect(FakeSource.all).toHaveLength(1);
    vi.advanceTimersByTime(RECONNECT_MS);
    expect(FakeSource.all).toHaveLength(2);
    last().emit('ready', '{}');
    expect(modes.at(-1)).toBe('live');
    expect(changed).toHaveLength(2);
  });

  it('3 falhas seguidas: fica 60 s sem tentar e depois tenta de novo', () => {
    const { modes } = setup();
    last().emit('error');
    vi.advanceTimersByTime(RECONNECT_MS);
    last().emit('error');
    vi.advanceTimersByTime(RECONNECT_MS);
    last().emit('error');
    expect(FakeSource.all).toHaveLength(3);
    vi.advanceTimersByTime(LEGACY_MS - 1);
    expect(FakeSource.all).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(FakeSource.all).toHaveLength(4);
    expect(modes.every((mode) => mode === 'polling')).toBe(true);
    last().emit('ready', '{}');
    expect(modes.at(-1)).toBe('live');
  });

  it('conexão que abre e cai logo: não reconecta para sempre, vai para o modo antigo na 3ª queda', () => {
    const { changed, modes } = setup();
    for (let i = 0; i < 3; i += 1) {
      last().emit('ready', '{}');
      vi.advanceTimersByTime(500);
      last().emit('error');
      if (i < 2) vi.advanceTimersByTime(RECONNECT_MS);
    }
    expect(FakeSource.all).toHaveLength(3);
    expect(modes.at(-1)).toBe('polling');
    // no modo antigo não tenta (nem refaz tudo) a cada 3 s
    vi.advanceTimersByTime(LEGACY_MS - 1);
    expect(FakeSource.all).toHaveLength(3);
    expect(changed).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(FakeSource.all).toHaveLength(4);
  });

  it('fechar encerra a conexão e as tentativas, e ignora o que chegar depois', () => {
    const { changed, close } = setup();
    const source = last();
    source.emit('error');
    close();
    vi.advanceTimersByTime(LEGACY_MS * 2);
    expect(FakeSource.all).toHaveLength(1);
    source.emit('ready', '{}');
    expect(changed).toEqual([]);

    const second = setup();
    const open = last();
    second.close();
    expect(open.closed).toBe(true);
  });

  it('erro ao criar a conexão conta como falha e não lança', () => {
    const modes: ChannelMode[] = [];
    let attempts = 0;
    connectRoundStream<string>({
      url: '/api/stream',
      parse,
      fallbackScopes: [],
      onChanged: () => undefined,
      onMode: (mode) => modes.push(mode),
      createSource: () => {
        attempts += 1;
        throw new Error('sem EventSource');
      },
    });
    vi.advanceTimersByTime(RECONNECT_MS * 2);
    expect(attempts).toBe(3);
    expect(modes.every((mode) => mode === 'polling')).toBe(true);
  });
});
