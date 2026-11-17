import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PushConfig,
  PushPayload,
  PushSubscriptionInput,
  PushTestResult,
} from '@fut-stats/shared';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { PushSender } from './push-sender';
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
   * Guarda o aparelho. O `endpoint` identifica o aparelho: o mesmo de novo atualiza as chaves, e se outro usuário
   * entrou naquele aparelho a linha passa para ele.
   */
  async subscribe(
    userId: string,
    input: PushSubscriptionInput,
    userAgent: string | null,
  ): Promise<void> {
    const data = {
      userId,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent,
    };
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: { endpoint: input.endpoint, ...data },
      update: data,
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
    let sent = 0;
    for (const subscription of subscriptions) {
      try {
        const outcome = await this.sender.send(subscription, TEST_PAYLOAD);
        if (outcome === 'sent') sent += 1;
        else
          await this.prisma.pushSubscription.deleteMany({
            where: { endpoint: subscription.endpoint },
          });
      } catch {
        // Aviso de teste é cortesia: um aparelho fora do ar não derruba os outros.
      }
    }
    return { sent };
  }
}
