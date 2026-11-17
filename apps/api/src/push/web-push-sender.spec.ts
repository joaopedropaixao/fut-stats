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

  it.each([404, 410])('%i do serviço de push vira "gone"', async (statusCode) => {
    send.mockRejectedValue(
      Object.assign(new Error('Received unexpected response code'), { statusCode }),
    );
    await expect(sender(vapid).send(target, payload)).resolves.toBe('gone');
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
