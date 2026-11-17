import { NOTIFICATION_TYPES, type NotificationType } from '@fut-stats/domain';
import { z } from 'zod';

export { NOTIFICATION_TYPES } from '@fut-stats/domain';
export type { NotificationType };

// Contrato de pwa-e-push (docs/specs/pwa-e-push.md): GET /push/config, PUT e DELETE /push/subscriptions, POST /push/test.

export const pushConfigSchema = z.object({ enabled: z.boolean(), publicKey: z.string().nullable() });

/** O que o navegador devolve em `PushSubscription.toJSON()`. */
export const pushSubscriptionInputSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(200) }),
});
export const pushUnsubscribeSchema = z.object({ endpoint: z.string().min(1).max(2000) });
export const pushTestResultSchema = z.object({ sent: z.number().int() });

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);

/** O que vai dentro do push e o que o service worker mostra. */
export const pushPayloadSchema = z.object({
  type: notificationTypeSchema.or(z.literal('TEST')),
  /** Nome da pelada. */
  title: z.string(),
  body: z.string(),
  /** Caminho no app, com `?grupo=<groupId>`. */
  url: z.string(),
  /** `${type}:${roundId}`: o aviso novo substitui o antigo na bandeja. */
  tag: z.string(),
});

export type PushConfig = z.infer<typeof pushConfigSchema>;
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionInputSchema>;
export type PushUnsubscribeInput = z.infer<typeof pushUnsubscribeSchema>;
export type PushTestResult = z.infer<typeof pushTestResultSchema>;
export type PushPayload = z.infer<typeof pushPayloadSchema>;

export type NotificationData = {
  groupId: string;
  groupName: string;
  roundId: string;
  roundNumber: number;
  /** ISO. */
  scheduledAt: string;
  /** ISO; só em `VOTING_OPENED`. */
  votingDeadline?: string;
};

/**
 * Monta título, texto, url e tag de cada tipo. Fonte única dos textos (tabela do spec). Implementação: `dev-back`,
 * teste C21 primeiro.
 */
export function notificationContent(type: NotificationType, data: NotificationData): PushPayload {
  void type;
  void data;
  throw new Error('notificationContent: não implementado');
}
