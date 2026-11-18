import type * as SentryReact from '@sentry/react';
import { describe, expect, it, vi } from 'vitest';
import { createMonitoring, scrubEvent } from './monitoring';

function fakeSentry() {
  return {
    init: vi.fn(),
    captureException: vi.fn(),
    setUser: vi.fn(),
  } as unknown as typeof SentryReact & {
    init: ReturnType<typeof vi.fn>;
    captureException: ReturnType<typeof vi.fn>;
    setUser: ReturnType<typeof vi.fn>;
  };
}

/** Deixa as promessas encadeadas do monitoring terminarem. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createMonitoring', () => {
  it('C15: sem DSN, o Sentry nunca é carregado (nem em start, nem em erro)', async () => {
    const load = vi.fn();
    const monitoring = createMonitoring({ dsn: undefined, environment: 'production' }, load);
    monitoring.start();
    monitoring.report(new Error('x'));
    monitoring.setUser('u1');
    await settle();
    expect(load).not.toHaveBeenCalled();
  });

  it('C16: com DSN, carrega uma vez só e liga sem dado pessoal, sem tracing e sem replay', async () => {
    const sentry = fakeSentry();
    const load = vi.fn().mockResolvedValue(sentry);
    const monitoring = createMonitoring(
      { dsn: 'https://k@o.ingest.sentry.io/1', environment: 'staging' },
      load,
    );
    monitoring.start();
    monitoring.start();
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
    expect(sentry.init).toHaveBeenCalledTimes(1);
    const options = sentry.init.mock.calls[0]![0];
    expect(options).toMatchObject({
      dsn: 'https://k@o.ingest.sentry.io/1',
      environment: 'staging',
      tracesSampleRate: 0,
    });
    expect(options.dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    });
    expect(options).not.toHaveProperty('replaysSessionSampleRate');
    expect(options).not.toHaveProperty('replaysOnErrorSampleRate');
  });

  it('C17: o erro vai para o Sentry com o contexto, e o id do usuário vai só como id', async () => {
    const sentry = fakeSentry();
    const monitoring = createMonitoring(
      { dsn: 'https://k@o.ingest.sentry.io/1', environment: 'production' },
      () => Promise.resolve(sentry),
    );
    monitoring.start();
    monitoring.setUser('user-1');
    const error = new Error('quebrou');
    monitoring.report(error, { source: 'route' });
    await settle();
    expect(sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { source: 'route' },
      user: { id: 'user-1' },
    });
    expect(sentry.setUser).toHaveBeenLastCalledWith({ id: 'user-1' });
    monitoring.setUser(null);
    await settle();
    expect(sentry.setUser).toHaveBeenLastCalledWith(null);
  });

  it('um erro antes do início agendado liga o Sentry e não se perde; o usuário guardado entra no init', async () => {
    const sentry = fakeSentry();
    const monitoring = createMonitoring(
      { dsn: 'https://k@o.ingest.sentry.io/1', environment: 'production' },
      () => Promise.resolve(sentry),
    );
    monitoring.setUser('user-9');
    const error = new Error('cedo');
    monitoring.report(error);
    await settle();
    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.setUser).toHaveBeenCalledWith({ id: 'user-9' });
    expect(sentry.captureException).toHaveBeenCalledWith(error, { user: { id: 'user-9' } });
  });

  it('pedaço que sumiu (deploy novo) não vai para o Sentry', async () => {
    const sentry = fakeSentry();
    const load = vi.fn().mockResolvedValue(sentry);
    const monitoring = createMonitoring(
      { dsn: 'https://k@o.ingest.sentry.io/1', environment: 'production' },
      load,
    );
    monitoring.report(new TypeError('Failed to fetch dynamically imported module: /a.js'));
    await settle();
    expect(load).not.toHaveBeenCalled();
  });

  it('o Sentry que não carrega (rede, bloqueador) não derruba nada', async () => {
    const monitoring = createMonitoring(
      { dsn: 'https://k@o.ingest.sentry.io/1', environment: 'production' },
      () => Promise.reject(new Error('blocked')),
    );
    monitoring.start();
    monitoring.report(new Error('x'));
    monitoring.setUser('u1');
    await expect(settle()).resolves.toBeUndefined();
  });
});

describe('scrubEvent', () => {
  it('deixa só o id do usuário e tira cookie, cabeçalhos e corpo do pedido', () => {
    const event = {
      user: { id: 'u1', email: 'a@b.c', username: 'Fulano', ip_address: '1.2.3.4' },
      request: {
        url: 'https://x/',
        cookies: { a: 'b' },
        headers: { authorization: 'x' },
        data: 'corpo',
      },
    } as unknown as SentryReact.ErrorEvent;
    const out = scrubEvent(event)!;
    expect(out.user).toEqual({ id: 'u1' });
    expect(out.request).toEqual({ url: 'https://x/' });
  });

  it('sem id, tira o usuário todo', () => {
    const event = { user: { email: 'a@b.c' } } as unknown as SentryReact.ErrorEvent;
    expect(scrubEvent(event)!.user).toBeUndefined();
  });

  it('descarta o evento de pedaço que sumiu', () => {
    const event = {
      exception: { values: [{ value: 'Failed to fetch dynamically imported module: /a.js' }] },
    } as unknown as SentryReact.ErrorEvent;
    expect(scrubEvent(event)).toBeNull();
  });
});
