import { Logger } from '@nestjs/common';
import type { PushPayload } from '@fut-stats/shared';
import { addMember, createGroup, createUser } from '../test/auth';
import { disableVapid, enableVapid } from '../test/fake-push-sender';
import { createTestApp, resetDatabase } from '../test/test-app';
import { NotificationsService } from './notifications.service';
import { PushSender, type PushTarget } from './push-sender';

/** O serviço de push demora e depois diz que a assinatura morreu: o aviso ainda precisa do banco para apagá-la. */
class SlowGoneSender extends PushSender {
  release: (() => void) | null = null;
  private onStart: () => void = () => undefined;
  readonly started = new Promise<void>((resolve) => (this.onStart = resolve));

  send(_target: PushTarget, _payload: PushPayload): Promise<'sent' | 'gone'> {
    this.onStart();
    return new Promise((resolve) => (this.release = () => resolve('gone')));
  }
}

describe('push: desligamento da API', () => {
  beforeAll(() => enableVapid());
  afterAll(() => disableVapid());

  it('espera o aviso em andamento antes de o Prisma desconectar (a assinatura morta ainda é apagada)', async () => {
    const t = await createTestApp({
      overrides: [{ provide: PushSender, useClass: SlowGoneSender }],
    });
    const sender = t.app.get<SlowGoneSender>(PushSender);
    const errors = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const order: string[] = [];
    const disconnect = t.prisma.$disconnect.bind(t.prisma);
    jest.spyOn(t.prisma, '$disconnect').mockImplementation(async () => {
      order.push('prisma desconectou');
      await disconnect();
    });

    await resetDatabase(t.prisma);
    const group = await createGroup(t, { name: 'Pelada do Sábado' });
    const user = await createUser(t);
    await addMember(t, user.id, group.id);
    await t.prisma.pushSubscription.create({
      data: {
        userId: user.id,
        endpoint: 'https://fcm.googleapis.com/fcm/send/1',
        p256dh: 'p',
        auth: 'a',
      },
    });
    const round = await t.prisma.round.create({
      data: { groupId: group.id, scheduledAt: new Date('2026-10-24T12:00:00.000Z') },
    });
    const deleteMany = t.prisma.pushSubscription.deleteMany.bind(t.prisma.pushSubscription);
    jest.spyOn(t.prisma.pushSubscription, 'deleteMany').mockImplementation(((args: never) => {
      order.push('assinatura apagada');
      return deleteMany(args);
    }) as never);

    t.app.get(NotificationsService).notify('ROUND_CREATED', {
      groupId: group.id,
      roundId: round.id,
      actorId: null,
    });
    await sender.started;
    const closing = t.app.close();
    // Dá a vez ao desligamento antes de o serviço de push responder.
    await new Promise((resolve) => setTimeout(resolve, 20));
    sender.release!();
    await closing;

    expect(order).toEqual(['assinatura apagada', 'prisma desconectou']);
    expect(errors).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});
