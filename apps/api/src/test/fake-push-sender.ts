import type { PushPayload } from '@fut-stats/shared';
import { PushSender, type PushTarget } from '../push/push-sender';

/** Chaves VAPID só para a validação do ambiente dos testes passar: o enviador de verdade nunca é chamado. */
export const TEST_VAPID_ENV = {
  VAPID_PUBLIC_KEY: 'chave-publica-dos-testes',
  VAPID_PRIVATE_KEY: 'chave-privada-dos-testes',
  VAPID_SUBJECT: 'mailto:dono@example.com',
} as const;

/**
 * Grava cada envio no lugar de falar com o serviço de push de fora (a fronteira externa, como o Google no login).
 * `answers` diz o que fazer com um endpoint: `'gone'` (404/410) ou `'error'` (rede).
 */
export class FakePushSender extends PushSender {
  readonly sent: { endpoint: string; payload: PushPayload }[] = [];
  readonly answers = new Map<string, 'gone' | 'error'>();

  send(target: PushTarget, payload: PushPayload): Promise<'sent' | 'gone'> {
    const answer = this.answers.get(target.endpoint);
    if (answer === 'error') return Promise.reject(new Error('rede fora do ar'));
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
