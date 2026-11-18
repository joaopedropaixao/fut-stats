import {
  ConflictException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  isPushServiceEndpoint,
  type PushConfig,
  type PushPayload,
  type PushSubscriptionInput,
  type PushTestResult,
} from '@fut-stats/shared';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { describePushError, endpointHost } from './push-error';
import { PushSender, type PushTarget } from './push-sender';
import { getRequestId } from '../common/request-context';
import { vapidConfig } from './vapid';

/** O texto do aviso de teste (não é de nenhuma pelada: o título é o do app). */
const TEST_PAYLOAD: PushPayload = {
  type: 'TEST',
  title: 'Fut Stats',
  body: 'Aviso de teste. Está funcionando.',
  url: '/perfil',
  tag: 'TEST',
};

/** Assinaturas de push de cada aparelho do usuário. O envio dos avisos da pelada é do `NotificationsService`. */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: PushSender,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** O push só liga com as três variáveis VAPID (a validação do ambiente garante: as três ou nenhuma). */
  get enabled(): boolean {
    return vapidConfig(this.config) !== null;
  }

  /** A chave pública sai daqui: o web não ganha variável de build e dá para desligar o push só pelo servidor. */
  getConfig(): PushConfig {
    const vapid = vapidConfig(this.config);
    return { enabled: vapid !== null, publicKey: vapid?.publicKey ?? null };
  }

  /**
   * Guarda o aparelho. O `endpoint` identifica a assinatura do navegador: o mesmo usuário de novo atualiza as chaves.
   * Outro usuário só leva a linha se mandar as mesmas chaves guardadas (o mesmo navegador, com outra conta logada);
   * com chaves diferentes é 409: saber o `endpoint` de alguém não basta para tomar os avisos dele.
   * O `endpoint` é conferido de novo aqui (o schema já confere): a API faz pedidos para ele, então só serviço de push.
   */
  async subscribe(
    userId: string,
    input: PushSubscriptionInput,
    userAgent: string | null,
  ): Promise<void> {
    if (!isPushServiceEndpoint(input.endpoint))
      throw new UnprocessableEntityException({
        code: 'PUSH_ENDPOINT_NOT_ALLOWED',
        message: 'Endereço de push desconhecido.',
      });
    const { endpoint, keys } = input;
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.pushSubscription.findUnique({
        where: { endpoint },
        select: { userId: true, p256dh: true, auth: true },
      });
      const data = { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent };
      if (!existing) {
        await tx.pushSubscription.create({ data: { endpoint, ...data } });
        return;
      }
      const sameBrowser = existing.p256dh === keys.p256dh && existing.auth === keys.auth;
      if (existing.userId !== userId && !sameBrowser)
        throw new ConflictException({
          code: 'PUSH_SUBSCRIPTION_TAKEN',
          message: 'Este aparelho já está ligado a outra conta.',
        });
      await tx.pushSubscription.update({ where: { endpoint }, data });
    });
  }

  /** Desliga o aparelho. Só apaga se for do usuário; endpoint de outro ou inexistente passa em silêncio. */
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  /** Manda o aviso de teste para todos os aparelhos do usuário; devolve para quantos o serviço aceitou. */
  async sendTest(userId: string): Promise<PushTestResult> {
    if (!this.enabled) return { sent: 0 };
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
      select: { endpoint: true, p256dh: true, auth: true },
    });
    const { sent, errors } = await this.sendToSubscriptions(subscriptions, TEST_PAYLOAD);
    // O motivo fica no log (nunca na resposta): o usuário só vê quantos aparelhos receberam.
    for (const error of errors)
      this.logger.error({
        event: 'push-test-failed',
        requestId: getRequestId(),
        ...describePushError(error),
      });
    return { sent };
  }

  /**
   * Envia para cada aparelho em paralelo. Só apaga a assinatura quando o serviço de push diz que ela morreu (`gone`);
   * erro de rede não apaga (fica para a próxima) e não impede os outros: volta em `errors` para quem chamou registrar.
   */
  async sendToSubscriptions(
    subscriptions: readonly PushTarget[],
    payload: PushPayload,
  ): Promise<{ sent: number; errors: unknown[] }> {
    const outcomes = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        // A API faz o pedido para o endereço guardado: o que não é de um serviço de push conhecido (uma linha de antes
        // da lista de hosts, ou escrita fora da API) nunca é chamado. A linha fica; só o log avisa.
        if (!isPushServiceEndpoint(subscription.endpoint)) {
          this.logger.warn({
            event: 'push-endpoint-not-allowed',
            host: endpointHost(subscription.endpoint),
          });
          return 'skipped';
        }
        const outcome = await this.sender.send(subscription, payload);
        if (outcome === 'gone')
          await this.prisma.pushSubscription.deleteMany({
            where: { endpoint: subscription.endpoint },
          });
        return outcome;
      }),
    );
    let sent = 0;
    const errors: unknown[] = [];
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') errors.push(outcome.reason);
      else if (outcome.value === 'sent') sent += 1;
    }
    return { sent, errors };
  }
}
