import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PushPayload } from '@fut-stats/shared';
import { sendNotification } from 'web-push';
import type { Env } from '../config/env';
import { PUSH_TTL_SECONDS, PushSender, type PushTarget } from './push-sender';
import { vapidConfig } from './vapid';

/** O serviço de push responde 404 ou 410 quando o aparelho desfez a assinatura (ou ela venceu). */
const GONE_STATUS: ReadonlySet<number> = new Set([404, 410]);

/** `PushSender` de verdade: `web-push` assina com as chaves VAPID e criptografa o conteúdo. */
@Injectable()
export class WebPushSender extends PushSender {
  constructor(private readonly config: ConfigService<Env, true>) {
    super();
  }

  async send(target: PushTarget, payload: PushPayload): Promise<'sent' | 'gone'> {
    const vapidDetails = vapidConfig(this.config);
    if (!vapidDetails) throw new Error('VAPID não configurado');

    try {
      await sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(payload),
        { TTL: PUSH_TTL_SECONDS, vapidDetails },
      );
      return 'sent';
    } catch (error) {
      const status = (error as { statusCode?: unknown }).statusCode;
      if (typeof status === 'number' && GONE_STATUS.has(status)) return 'gone';
      throw error;
    }
  }
}
