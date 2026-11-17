/**
 * Avisos da v1 (Web Push), todos disparados por uma ação que já existe. Quem recebe cada um:
 * - `ROUND_CREATED`: todos os ativos do grupo;
 * - `TEAMS_PUBLISHED`: os escalados (titulares e reservas) ativos;
 * - `VOTING_OPENED`: quem jogou a rodada e segue ativo;
 * - `RESULT_OUT`: todos os ativos do grupo.
 * Quem causou a ação (`actorId`) nunca recebe o próprio aviso. Spec: `docs/specs/pwa-e-push.md`.
 */
export const NOTIFICATION_TYPES = [
  'ROUND_CREATED',
  'TEAMS_PUBLISHED',
  'VOTING_OPENED',
  'RESULT_OUT',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationContext = {
  /** membershipIds ativos do grupo. */
  activeMemberIds: readonly string[];
  /** Escalados da rodada (membershipIds), usados em `TEAMS_PUBLISHED` e `VOTING_OPENED`. */
  lineupIds?: readonly string[];
  /** Quem causou a ação; `null` quando ninguém causou (prazo, relógio, último voto). */
  actorId: string | null;
};

/** Quem recebe o aviso (membershipIds, sem repetir e sem o ator). Implementação: `dev-back`, testes C1–C5 primeiro. */
export function notificationRecipients(
  type: NotificationType,
  context: NotificationContext,
): string[] {
  void type;
  void context;
  throw new Error('notificationRecipients: não implementado');
}
