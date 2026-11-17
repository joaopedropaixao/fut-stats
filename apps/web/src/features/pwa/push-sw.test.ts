import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const SOURCE = readFileSync(new URL('../../../public/push-sw.js', import.meta.url), 'utf8');
const ORIGIN = 'https://fut-stats.example';

type Listener = (event: unknown) => void;
type FakeClient = {
  url: string;
  focus: ReturnType<typeof vi.fn>;
  navigate?: ReturnType<typeof vi.fn>;
};

/** Roda o `push-sw.js` como o navegador roda: um script clássico, com `self` de service worker. */
function load(windowClients: FakeClient[] = []) {
  const listeners = new Map<string, Listener>();
  class ServiceWorkerGlobalScope {
    location = { origin: ORIGIN };
    registration = { showNotification: vi.fn(() => Promise.resolve()) };
    clients = {
      matchAll: vi.fn(() => Promise.resolve(windowClients)),
      openWindow: vi.fn(() => Promise.resolve(null)),
    };
    addEventListener(type: string, listener: Listener) {
      listeners.set(type, listener);
    }
  }
  const scope = new ServiceWorkerGlobalScope();
  const context = createContext({ ServiceWorkerGlobalScope, self: scope, URL });
  runInContext(SOURCE, context);
  const fire = async (type: string, event: Record<string, unknown>) => {
    const waits: Promise<unknown>[] = [];
    listeners.get(type)!({ ...event, waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
  };
  return { scope, context, listeners, fire };
}

const payload = {
  type: 'ROUND_CREATED',
  title: 'Pelada do Zé',
  body: 'Rodada 13 marcada: sáb, 24 out, 9h. Confirme sua presença.',
  url: '/rodadas/r13?grupo=g1',
  tag: 'ROUND_CREATED:r13',
};

describe('push-sw.js (C35): chega um aviso', () => {
  it('mostra a notificação com título, texto, ícone do app, tag e a url nos dados', async () => {
    const { scope, fire } = load();
    await fire('push', { data: { json: () => payload } });
    expect(scope.registration.showNotification).toHaveBeenCalledExactlyOnceWith('Pelada do Zé', {
      body: payload.body,
      icon: 'pwa-192x192.png',
      badge: 'pwa-192x192.png',
      tag: 'ROUND_CREATED:r13',
      lang: 'pt-BR',
      data: { url: '/rodadas/r13?grupo=g1' },
    });
  });

  it('conteúdo ilegível ou incompleto vira um aviso genérico que abre o início (o navegador exige uma notificação)', async () => {
    const generic = ['Fut Stats', expect.objectContaining({ data: { url: '/' } })] as const;
    for (const data of [
      null,
      {
        json: () => {
          throw new SyntaxError('não é JSON');
        },
      },
      { json: () => ({ title: 'Só o título' }) },
      { json: () => 'texto solto' },
    ]) {
      const { scope, fire } = load();
      await fire('push', { data });
      expect(scope.registration.showNotification).toHaveBeenCalledWith(...generic);
    }
  });

  it('a url que não é um caminho do app nunca chega aos dados', async () => {
    for (const url of ['https://outro.site/x', '//outro.site/x', 'javascript:alert(1)', 42]) {
      const { scope, fire } = load();
      await fire('push', { data: { json: () => ({ ...payload, url }) } });
      expect(scope.registration.showNotification).toHaveBeenCalledWith(
        'Pelada do Zé',
        expect.objectContaining({ data: { url: '/' } }),
      );
    }
  });
});

describe('push-sw.js (C36): toca na notificação', () => {
  const notification = (url?: string) => ({ close: vi.fn(), data: url ? { url } : undefined });

  it('com o app aberto: foca a janela e navega para a url', async () => {
    const navigated = vi.fn(() => Promise.resolve());
    const client: FakeClient = {
      url: `${ORIGIN}/ranking`,
      focus: vi.fn(() => Promise.resolve({ navigate: navigated })),
    };
    const { scope, fire } = load([client]);
    const n = notification('/rodadas/r13?grupo=g1');
    await fire('notificationclick', { notification: n });
    expect(n.close).toHaveBeenCalled();
    expect(client.focus).toHaveBeenCalled();
    expect(navigated).toHaveBeenCalledWith(`${ORIGIN}/rodadas/r13?grupo=g1`);
    expect(scope.clients.openWindow).not.toHaveBeenCalled();
  });

  it('com o app fechado: abre a url numa janela nova', async () => {
    const { scope, fire } = load([]);
    await fire('notificationclick', { notification: notification('/times?grupo=g1') });
    expect(scope.clients.openWindow).toHaveBeenCalledExactlyOnceWith(`${ORIGIN}/times?grupo=g1`);
  });

  it('janela de outro endereço não conta como o app aberto', async () => {
    const other: FakeClient = { url: 'https://outro.site/', focus: vi.fn() };
    const { scope, fire } = load([other]);
    await fire('notificationclick', { notification: notification('/') });
    expect(other.focus).not.toHaveBeenCalled();
    expect(scope.clients.openWindow).toHaveBeenCalled();
  });

  it('janela sem `navigate`: abre a url em vez de ficar parada', async () => {
    const client: FakeClient = {
      url: `${ORIGIN}/`,
      focus: vi.fn(() => Promise.resolve({})),
    };
    const { scope, fire } = load([client]);
    await fire('notificationclick', { notification: notification('/times') });
    expect(scope.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/times`);
  });

  it('notificação sem url nos dados abre o início', async () => {
    const { scope, fire } = load([]);
    await fire('notificationclick', { notification: notification() });
    expect(scope.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/`);
  });
});

describe('push-sw.js: ligação com o service worker', () => {
  it('registra `push` e `notificationclick` só dentro de um service worker', () => {
    const { listeners } = load();
    expect([...listeners.keys()].sort()).toEqual(['notificationclick', 'push']);

    // Fora de um service worker (a página, os testes) o arquivo não liga nada e não quebra
    const stray = createContext({ self: {} });
    expect(() => runInContext(SOURCE, stray)).not.toThrow();
  });

  it('não depende de import nem de export (é um script clássico de importScripts)', () => {
    expect(SOURCE).not.toMatch(/^\s*(import|export)\s/m);
  });
});
