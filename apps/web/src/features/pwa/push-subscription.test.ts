import { describe, expect, it, vi } from 'vitest';
import { sameServerKey, subscribeWithKey, urlBase64ToUint8Array } from './push-subscription';

describe('urlBase64ToUint8Array', () => {
  it('converte a chave VAPID (base64url, sem preenchimento) em bytes', () => {
    // "hello?>" em base64url: aGVsbG8_Pg
    expect([...urlBase64ToUint8Array('aGVsbG8_Pg')]).toEqual([104, 101, 108, 108, 111, 63, 62]);
  });

  it('troca - e _ por + e /', () => {
    expect([...urlBase64ToUint8Array('-_8')]).toEqual([251, 255]);
  });

  it('a chave pública P-256 tem 65 bytes', () => {
    // 87 caracteres base64url, como uma chave real
    expect(urlBase64ToUint8Array(`B${'A'.repeat(86)}`)).toHaveLength(65);
  });
});

const KEY = 'aGVsbG8_Pg';
const OLD_KEY = '-_8';
const keyBuffer = (key: string) => urlBase64ToUint8Array(key).buffer;

function fakeSubscription(key: string | null) {
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/${key ?? 'sem-chave'}`,
    options: { applicationServerKey: key ? keyBuffer(key) : null },
    unsubscribe: vi.fn(() => Promise.resolve(true)),
  } as unknown as PushSubscription & { unsubscribe: ReturnType<typeof vi.fn> };
}

describe('sameServerKey', () => {
  it('compara os bytes da chave da assinatura com a chave atual', () => {
    expect(sameServerKey(keyBuffer(KEY), KEY)).toBe(true);
    expect(sameServerKey(keyBuffer(OLD_KEY), KEY)).toBe(false);
    expect(sameServerKey(null, KEY)).toBe(false);
  });
});

describe('subscribeWithKey (chave VAPID velha)', () => {
  it('reaproveita a assinatura da chave atual', async () => {
    const existing = fakeSubscription(KEY);
    const pushManager = {
      getSubscription: vi.fn(() => Promise.resolve(existing)),
      subscribe: vi.fn(),
    };
    await expect(subscribeWithKey(pushManager, KEY)).resolves.toEqual({
      subscription: existing,
      fresh: false,
    });
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('assinatura de outra chave: desfaz e assina de novo com a atual', async () => {
    const old = fakeSubscription(OLD_KEY);
    const created = fakeSubscription(KEY);
    const pushManager = {
      getSubscription: vi.fn(() => Promise.resolve(old)),
      subscribe: vi.fn(() => Promise.resolve(created)),
    };
    await expect(subscribeWithKey(pushManager, KEY)).resolves.toEqual({
      subscription: created,
      fresh: true,
    });
    expect(old.unsubscribe).toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(KEY),
    });
  });

  it('sem assinatura: assina', async () => {
    const created = fakeSubscription(KEY);
    const pushManager = {
      getSubscription: vi.fn(() => Promise.resolve(null)),
      subscribe: vi.fn(() => Promise.resolve(created)),
    };
    await expect(subscribeWithKey(pushManager, KEY)).resolves.toMatchObject({ fresh: true });
  });
});
