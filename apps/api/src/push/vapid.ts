import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/**
 * As chaves VAPID, ou `null` com o push desligado. Vazia vale como ausente (`VAPID_PUBLIC_KEY=` no exemplo do
 * ambiente): o `ConfigService` devolve o texto cru do ambiente, não o valor já tratado pela validação.
 */
export function vapidConfig(config: ConfigService<Env, true>): VapidConfig | null {
  const publicKey = config.get('VAPID_PUBLIC_KEY', { infer: true });
  const privateKey = config.get('VAPID_PRIVATE_KEY', { infer: true });
  const subject = config.get('VAPID_SUBJECT', { infer: true });
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}
