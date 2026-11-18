import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { notificationRecipients, votingDeadline, type NotificationType } from '@fut-stats/domain';
import { notificationContent, type PushPayload } from '@fut-stats/shared';
import { getRequestId } from '../common/request-context';
import { RoundEventsService, type RoundEventType } from '../events/round-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';
import { PushSender } from './push-sender';

/**
 * Qual evento da rodada vira qual aviso. `TEAMS_UNPUBLISHED` e o resto não avisam. `VOTING_CLOSED` é um evento só para
 * o admin, o último voto, o prazo e o relógio: o aviso sai uma vez por fechamento.
 */
const EVENT_TO_NOTIFICATION: Partial<Record<RoundEventType, NotificationType>> = {
  ROUND_CREATED: 'ROUND_CREATED',
  TEAMS_PUBLISHED: 'TEAMS_PUBLISHED',
  VOTING_OPENED: 'VOTING_OPENED',
  VOTING_CLOSED: 'RESULT_OUT',
};

export interface NotifyInput {
  groupId: string;
  roundId: string;
  /** Membership de quem causou a ação (não recebe o próprio aviso); `null` quando ninguém causou (prazo, último voto). */
  actorId: string | null;
}

/**
 * Os avisos da pelada (`ROUND_CREATED`, `TEAMS_PUBLISHED`, `VOTING_OPENED`, `RESULT_OUT`). Chamado depois que a ação
 * gravou: não bloqueia quem chamou e nunca falha a ação (aviso é cortesia). Quem recebe é do domain
 * (`notificationRecipients`); o texto é do shared (`notificationContent`); o envio é do `PushSender`.
 */
@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly pending = new Set<Promise<void>>();
  private stopListening: (() => void) | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly sender: PushSender,
    private readonly events: RoundEventsService,
  ) {}

  /** Ouve o sinal único da rodada: quem escreve na rodada não conhece o push. */
  onModuleInit(): void {
    this.stopListening = this.events.on((event) => {
      const type = EVENT_TO_NOTIFICATION[event.type];
      if (!type) return;
      this.notify(type, {
        groupId: event.groupId,
        roundId: event.roundId,
        actorId: event.actorMembershipId,
      });
    });
  }

  /**
   * No desligamento: para de ouvir e espera os avisos em andamento, que ainda usam o banco (assinatura morta é
   * apagada). Tem que ser aqui: o Nest roda `onModuleDestroy` em todos os módulos antes de `beforeApplicationShutdown`
   * e `onApplicationShutdown`, e o `PrismaModule` (global) é o último a ser destruído; nos ganchos de shutdown o
   * Prisma já desconectou.
   */
  async onModuleDestroy(): Promise<void> {
    this.stopListening?.();
    this.stopListening = null;
    await this.whenIdle();
  }

  /** Dispara e volta na hora. Erro vai para o log com o `requestId` de quem pediu; nada sobe. */
  notify(type: NotificationType, input: NotifyInput): void {
    if (!this.push.enabled) return;
    const requestId = getRequestId();
    const task = this.dispatch(type, input, requestId)
      .catch((error: unknown) => this.logFailure(type, requestId, error))
      .finally(() => this.pending.delete(task));
    this.pending.add(task);
  }

  /** Espera os avisos em andamento terminarem (testes e desligamento da API). */
  async whenIdle(): Promise<void> {
    while (this.pending.size > 0) await Promise.all([...this.pending]);
  }

  private async dispatch(
    type: NotificationType,
    { groupId, roundId, actorId }: NotifyInput,
    requestId: string | null,
  ): Promise<void> {
    const round = await this.prisma.round.findFirst({
      where: { id: roundId, groupId },
      select: {
        number: true,
        scheduledAt: true,
        votingOpenedAt: true,
        group: { select: { name: true, votingDeadlineHours: true } },
        teamPlayers: { select: { membershipId: true } },
      },
    });
    if (!round) return;

    const members = await this.prisma.membership.findMany({
      where: { groupId, active: true },
      select: { id: true, userId: true },
    });
    const recipientIds = new Set(
      notificationRecipients(type, {
        activeMemberIds: members.map((m) => m.id),
        lineupIds: round.teamPlayers.map((p) => p.membershipId),
        actorId,
      }),
    );
    const userIds = members.filter((m) => recipientIds.has(m.id)).map((m) => m.userId);
    if (userIds.length === 0) return;

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId: { in: userIds } },
      select: { endpoint: true, p256dh: true, auth: true },
    });
    if (subscriptions.length === 0) return;

    const payload: PushPayload = notificationContent(type, {
      groupId,
      groupName: round.group.name,
      roundId,
      roundNumber: round.number,
      scheduledAt: round.scheduledAt.toISOString(),
      votingDeadline: round.votingOpenedAt
        ? votingDeadline(round.votingOpenedAt, round.group.votingDeadlineHours).toISOString()
        : undefined,
    });

    const { errors } = await this.push.sendToSubscriptions(subscriptions, payload);
    // Um aparelho fora do ar não impede os outros; a assinatura fica para a próxima.
    for (const error of errors) this.logFailure(type, requestId, error);
  }

  private logFailure(type: NotificationType, requestId: string | null, error: unknown): void {
    this.logger.error({
      event: 'push-failed',
      requestId,
      type,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
