import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PushPayload } from '@fut-stats/shared';
import { sendNotification } from 'web-push';
import type { Env } from '../config/env';
import { describePushError, endpointHost } from './push-error';
import { PUSH_TTL_SECONDS, PushSender, type PushTarget } from './push-sender';
import { vapidConfig } from './vapid';

/**
 * A assinatura morreu: 404 ou 410 quando o aparelho a desfez (ou ela venceu); 403 quando ela foi criada com outra chave
 * VAPID (a chave do servidor trocou), e nunca mais vai aceitar o envio.
 */
const GONE_STATUS: ReadonlySet<number> = new Set([403, 404, 410]);

/** `PushSender` de verdade: `web-push` assina com as chaves VAPID e criptografa o conteúdo. */
@Injectable()
export class WebPushSender extends PushSender {
  private readonly logger = new Logger(WebPushSender.name);

  constructor(private readonly config: ConfigService<Env, true>) {
    super();
  }

  async send(target: PushTarget, payload: PushPayload): Promise<'sent' | 'gone'> {
    const vapidDetails = vapidConfig(this.config);
    if (!vapidDetails) throw new Error('VAPID não configurado');

    try {
      const result = await sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(payload),
        { TTL: PUSH_TTL_SECONDS, vapidDetails },
      );
      // 201 quer dizer só "o serviço guardou": se o aparelho mostra ou não é com o navegador.
      this.logger.debug({
        event: 'push-sent',
        statusCode: result.statusCode,
        host: endpointHost(target.endpoint),
      });
      return 'sent';
    } catch (error) {
      const status = (error as { statusCode?: unknown }).statusCode;
      if (typeof status === 'number' && GONE_STATUS.has(status)) {
        // A assinatura vai ser apagada: o motivo (403 é chave VAPID diferente da usada ao ligar) fica no log.
        this.logger.warn({ event: 'push-subscription-gone', ...describePushError(error) });
        return 'gone';
      }
      throw error;
    }
  }
}
