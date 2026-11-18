import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { sendNotification } from 'web-push';
import type { Env } from '../config/env';
import { PUSH_TTL_SECONDS } from './push-sender';
import { WebPushSender } from './web-push-sender';

// A biblioteca fala com o serviço de push de fora (Google, Apple, Mozilla): é a fronteira externa.
jest.mock('web-push', () => ({ sendNotification: jest.fn() }));
const send = jest.mocked(sendNotification);

const target = { endpoint: 'https://push.example.com/x', p256dh: 'p', auth: 'a' };
const payload = { type: 'TEST', title: 't', body: 'b', url: '/', tag: 'TEST' } as const;

function sender(env: Partial<Record<string, string>>) {
  const config = { get: (key: string) => env[key] } as unknown as ConfigService<Env, true>;
  return new WebPushSender(config);
}

const vapid = {
  VAPID_PUBLIC_KEY: 'pub',
  VAPID_PRIVATE_KEY: 'priv',
  VAPID_SUBJECT: 'mailto:dono@example.com',
};

describe('WebPushSender', () => {
  beforeEach(() => send.mockReset());

  it('envia o JSON com TTL de 12 h e as chaves VAPID', async () => {
    send.mockResolvedValue({ statusCode: 201, body: '', headers: {} });
    await expect(sender(vapid).send(target, payload)).resolves.toBe('sent');
    expect(send).toHaveBeenCalledWith(
      { endpoint: target.endpoint, keys: { p256dh: 'p', auth: 'a' } },
      JSON.stringify(payload),
      {
        TTL: PUSH_TTL_SECONDS,
        vapidDetails: { subject: vapid.VAPID_SUBJECT, publicKey: 'pub', privateKey: 'priv' },
      },
    );
    expect(PUSH_TTL_SECONDS).toBe(43_200);
  });

  it.each([403, 404, 410])('%i do serviço de push vira "gone"', async (statusCode) => {
    send.mockRejectedValue(
      Object.assign(new Error('Received unexpected response code'), { statusCode }),
    );
    await expect(sender(vapid).send(target, payload)).resolves.toBe('gone');
  });

  it('"gone" registra o motivo (statusCode, body, host) e nunca o endereço inteiro', async () => {
    const warned = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    send.mockRejectedValue(
      Object.assign(new Error('Received unexpected response code'), {
        name: 'WebPushError',
        statusCode: 403,
        body: 'the VAPID credentials in the authorization header do not correspond',
        endpoint: 'https://fcm.googleapis.com/fcm/send/segredo',
      }),
    );
    await expect(sender(vapid).send(target, payload)).resolves.toBe('gone');
    const entry = warned.mock.calls[0]![0] as Record<string, unknown>;
    expect(entry).toMatchObject({
      event: 'push-subscription-gone',
      name: 'WebPushError',
      statusCode: 403,
      body: 'the VAPID credentials in the authorization header do not correspond',
      host: 'fcm.googleapis.com',
    });
    expect(JSON.stringify(entry)).not.toContain('segredo');
    warned.mockRestore();
  });

  it('outro status e erro de rede lançam', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('rate'), { statusCode: 429 }));
    await expect(sender(vapid).send(target, payload)).rejects.toThrow('rate');
    send.mockRejectedValueOnce(new Error('ECONNRESET'));
    await expect(sender(vapid).send(target, payload)).rejects.toThrow('ECONNRESET');
  });

  it('sem VAPID não tenta enviar', async () => {
    await expect(sender({}).send(target, payload)).rejects.toThrow('VAPID');
    expect(send).not.toHaveBeenCalled();
  });
});
