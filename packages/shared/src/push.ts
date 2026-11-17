import { NOTIFICATION_TYPES, type NotificationType } from '@fut-stats/domain';
import { z } from 'zod';

export { NOTIFICATION_TYPES } from '@fut-stats/domain';
export type { NotificationType };

// Contrato de pwa-e-push (docs/specs/pwa-e-push.md): GET /push/config, PUT e DELETE /push/subscriptions, POST /push/test.

export const pushConfigSchema = z.object({
  enabled: z.boolean(),
  publicKey: z.string().nullable(),
});

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

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const;
const MONTHS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;

/** Brasília (UTC-3, sem horário de verão desde 2019). O servidor roda em UTC e não conhece o fuso de cada aparelho. */
const PELADA_UTC_OFFSET_MS = -3 * 60 * 60 * 1000;

/** A data no relógio da pelada, para ler com os getters `getUTC*`. */
function localTime(iso: string): Date {
  return new Date(new Date(iso).getTime() + PELADA_UTC_OFFSET_MS);
}

/** "9h" na hora cheia, "9h30" nas outras (o formato do app, em minúsculas). */
function clock(date: Date): string {
  const minutes = date.getUTCMinutes();
  return minutes === 0
    ? `${date.getUTCHours()}h`
    : `${date.getUTCHours()}h${String(minutes).padStart(2, '0')}`;
}

/** "sáb, 24 out, 9h": a data real da rodada (nunca um dia da semana fixo). */
function roundWhen(iso: string): string {
  const date = localTime(iso);
  return `${WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}, ${clock(date)}`;
}

/** "sáb às 21h": o dia real do prazo da votação. */
function deadlineAt(iso: string): string {
  const date = localTime(iso);
  return `${WEEKDAYS[date.getUTCDay()]} às ${clock(date)}`;
}

/**
 * Monta título (o nome da pelada), texto, url e tag de cada tipo. Fonte única dos textos (tabela do spec). Datas no
 * formato do app, no fuso de Brasília. O resultado não diz quem foi o Craque: o suspense é do pacote.
 */
export function notificationContent(type: NotificationType, data: NotificationData): PushPayload {
  const { groupId, groupName, roundId, roundNumber } = data;
  const withGroup = (path: string) => `${path}?grupo=${encodeURIComponent(groupId)}`;
  const base = { type, title: groupName, tag: `${type}:${roundId}` };
  switch (type) {
    case 'ROUND_CREATED':
      return {
        ...base,
        body: `Rodada ${roundNumber} marcada: ${roundWhen(data.scheduledAt)}. Confirme sua presença.`,
        url: withGroup(`/rodadas/${roundId}`),
      };
    case 'TEAMS_PUBLISHED':
      return {
        ...base,
        body: `Os times da rodada ${roundNumber} saíram. Veja em que time você joga.`,
        url: withGroup('/times'),
      };
    case 'VOTING_OPENED':
      return {
        ...base,
        body: data.votingDeadline
          ? `Votação aberta. Dê suas notas até ${deadlineAt(data.votingDeadline)}.`
          : 'Votação aberta. Dê suas notas.',
        url: withGroup(`/rodadas/${roundId}/votar`),
      };
    case 'RESULT_OUT':
      return {
        ...base,
        body: `O resultado da rodada ${roundNumber} saiu. Quem foi o craque?`,
        url: withGroup(`/rodadas/${roundId}/resultado`),
      };
  }
}
