import type { PushPayload } from '@fut-stats/shared';
import { PushSender, type PushTarget } from '../push/push-sender';
import { TEST_VAPID_KEYS } from './vapid-keys';

/** Chaves VAPID só para a validação do ambiente dos testes passar (formato de verdade): o enviador de verdade nunca é chamado. */
export const TEST_VAPID_ENV = {
  VAPID_PUBLIC_KEY: TEST_VAPID_KEYS.publicKey,
  VAPID_PRIVATE_KEY: TEST_VAPID_KEYS.privateKey,
  VAPID_SUBJECT: 'mailto:dono@example.com',
} as const;

/** O erro que o `web-push` lança quando o serviço de push responde com erro (`statusCode`, `body`, `endpoint`). */
export class FakeWebPushError extends Error {
  override readonly name = 'WebPushError';
  constructor(
    readonly statusCode: number,
    readonly body: string,
    readonly endpoint: string,
  ) {
    super('Received unexpected response code');
  }
}

/** A rede para o serviço de push fora do ar: o Node junta as tentativas (IPv6 e IPv4) num `AggregateError` sem mensagem. */
export function unreachableError(): AggregateError {
  const refused = (address: string) =>
    Object.assign(new Error(`connect ECONNREFUSED ${address}`), { code: 'ECONNREFUSED' });
  return Object.assign(new AggregateError([refused('::1:8443'), refused('127.0.0.1:8443')]), {
    code: 'ECONNREFUSED',
  });
}

/**
 * Grava cada envio no lugar de falar com o serviço de push de fora (a fronteira externa, como o Google no login).
 * `answers` diz o que fazer com um endpoint: `'gone'` (404/410), `'error'` (erro simples), `'rejected'` (o serviço de
 * push respondeu 429 com um corpo) ou `'unreachable'` (rede fora do ar, `AggregateError` com a mensagem vazia).
 */
export class FakePushSender extends PushSender {
  readonly sent: { endpoint: string; payload: PushPayload }[] = [];
  readonly answers = new Map<string, 'gone' | 'error' | 'rejected' | 'unreachable'>();

  send(target: PushTarget, payload: PushPayload): Promise<'sent' | 'gone'> {
    const answer = this.answers.get(target.endpoint);
    if (answer === 'error') return Promise.reject(new Error('rede fora do ar'));
    if (answer === 'rejected')
      return Promise.reject(
        new FakeWebPushError(429, 'quota exceeded for this endpoint', target.endpoint),
      );
    if (answer === 'unreachable') return Promise.reject(unreachableError());
    if (answer === 'gone') return Promise.resolve('gone');
    this.sent.push({ endpoint: target.endpoint, payload });
    return Promise.resolve('sent');
  }

  reset(): void {
    this.sent.length = 0;
    this.answers.clear();
  }
}

/** Liga as variáveis VAPID do ambiente (antes de `createTestApp`). */
export function enableVapid(): void {
  Object.assign(process.env, TEST_VAPID_ENV);
}

/** Desliga o push (antes de `createTestApp`). Vazio, e não apagado: o ambiente vence o arquivo de ambiente local. */
export function disableVapid(): void {
  for (const key of Object.keys(TEST_VAPID_ENV)) process.env[key] = '';
}
