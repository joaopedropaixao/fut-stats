import type { PushPayload } from '@fut-stats/shared';

/** Um aparelho para quem enviar (o que o navegador entregou ao assinar). */
export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** O aviso fica guardado no serviço de push por até 12 h: depois disso o aparelho ligado não precisa mais dele. */
export const PUSH_TTL_SECONDS = 12 * 60 * 60;

/**
 * A fronteira com o serviço de push de fora (Google, Apple, Mozilla). Classe abstrata para servir de token de
 * injeção: os testes de integração trocam por um gravador. Erro de rede lança; assinatura que o serviço diz que não
 * existe mais (403, 404 ou 410) volta `'gone'`.
 */
export abstract class PushSender {
  abstract send(target: PushTarget, payload: PushPayload): Promise<'sent' | 'gone'>;
}
