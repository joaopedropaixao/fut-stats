import { Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { requestContextMiddleware } from '../common/request-context';
import { addMember, createGroup, createUser } from '../test/auth';
import { disableVapid, enableVapid, FakePushSender } from '../test/fake-push-sender';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';
import { NotificationsService } from './notifications.service';
import { PushSender } from './push-sender';

const HOUR_MS = 60 * 60 * 1000;
// sáb 24 out 2026, 9h em Brasília
const SCHEDULED_AT = new Date('2026-10-24T12:00:00.000Z');

describe('push: avisos da pelada (NotificationsService)', () => {
  let t: TestApp;
  let sender: FakePushSender;
  let notifications: NotificationsService;

  beforeAll(async () => {
    enableVapid();
    t = await createTestApp({ overrides: [{ provide: PushSender, useClass: FakePushSender }] });
    sender = t.app.get<FakePushSender>(PushSender);
    notifications = t.app.get(NotificationsService);
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
    sender.reset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await t.app.close();
    disableVapid();
  });

  let seq = 0;
  /** Um membro do grupo com `devices` aparelhos assinados. */
  async function member(
    groupId: string,
    devices = 1,
    data: { active?: boolean; role?: 'ADMIN' } = {},
  ) {
    const user = await createUser(t);
    const membership = await addMember(t, user.id, groupId, data);
    const endpoints: string[] = [];
    for (let i = 0; i < devices; i += 1) {
      seq += 1;
      const endpoint = `https://fcm.googleapis.com/fcm/send/${seq}`;
      endpoints.push(endpoint);
      await t.prisma.pushSubscription.create({
        data: { userId: user.id, endpoint, p256dh: 'p256dh', auth: 'auth' },
      });
    }
    return { user, membership, endpoints };
  }

  async function setup() {
    const group = await createGroup(t, { name: 'Pelada do Sábado' });
    const admin = await member(group.id, 1, { role: 'ADMIN' });
    const round = await t.prisma.round.create({
      data: { groupId: group.id, scheduledAt: SCHEDULED_AT },
    });
    return { group, admin, round };
  }

  async function notify(...args: Parameters<NotificationsService['notify']>) {
    notifications.notify(...args);
    await notifications.whenIdle();
  }

  it('C14: rodada criada vai para os aparelhos dos ativos, não para o inativo nem para o admin', async () => {
    const { group, admin, round } = await setup();
    const a = await member(group.id);
    const b = await member(group.id, 2);
    const c = await member(group.id);
    await member(group.id, 1, { active: false });

    await notify('ROUND_CREATED', {
      groupId: group.id,
      roundId: round.id,
      actorId: admin.membership.id,
    });

    expect(sender.sent.map((s) => s.endpoint).sort()).toEqual(
      [...a.endpoints, ...b.endpoints, ...c.endpoints].sort(),
    );
    expect(sender.sent).toHaveLength(4);
    expect(sender.sent[0]!.payload).toEqual({
      type: 'ROUND_CREATED',
      title: 'Pelada do Sábado',
      body: `Rodada ${round.number} marcada: sáb, 24 out, 9h. Confirme sua presença.`,
      url: `/rodadas/${round.id}?grupo=${group.id}`,
      tag: `ROUND_CREATED:${round.id}`,
    });
  });

  it('C15: times publicados vão só para os escalados; votação aberta, para quem jogou, com o prazo real', async () => {
    const { group, admin, round } = await setup();
    const played = await member(group.id);
    const bench = await member(group.id);
    const out = await member(group.id);
    for (const [who, isReserve] of [
      [played, false],
      [bench, true],
    ] as const) {
      await t.prisma.teamPlayer.create({
        data: {
          roundId: round.id,
          membershipId: who.membership.id,
          team: 'WHITE',
          position: 'MIDFIELDER',
          isReserve,
        },
      });
    }
    await t.prisma.round.update({
      where: { id: round.id },
      data: { status: 'VOTING', votingOpenedAt: new Date(SCHEDULED_AT.getTime() + 12 * HOUR_MS) },
    });

    await notify('TEAMS_PUBLISHED', {
      groupId: group.id,
      roundId: round.id,
      actorId: admin.membership.id,
    });
    expect(sender.sent.map((s) => s.endpoint).sort()).toEqual(
      [...played.endpoints, ...bench.endpoints].sort(),
    );
    expect(sender.sent[0]!.payload.url).toBe(`/times?grupo=${group.id}`);

    sender.reset();
    await notify('VOTING_OPENED', {
      groupId: group.id,
      roundId: round.id,
      actorId: admin.membership.id,
    });
    expect(sender.sent).toHaveLength(2);
    expect(sender.sent.map((s) => s.endpoint)).not.toContain(out.endpoints[0]);
    // aberta às 21h de sáb (Brasília) + 24 h de prazo
    expect(sender.sent[0]!.payload).toMatchObject({
      type: 'VOTING_OPENED',
      body: 'Votação aberta. Dê suas notas até dom às 21h.',
      url: `/rodadas/${round.id}/votar?grupo=${group.id}`,
    });
  });

  it('C15: resultado sem ator vai para todos os ativos, inclusive o admin, e não revela o Craque', async () => {
    const { group, admin, round } = await setup();
    const a = await member(group.id);
    await member(group.id, 1, { active: false });

    await notify('RESULT_OUT', { groupId: group.id, roundId: round.id, actorId: null });

    expect(sender.sent.map((s) => s.endpoint).sort()).toEqual(
      [...admin.endpoints, ...a.endpoints].sort(),
    );
    expect(sender.sent[0]!.payload).toMatchObject({
      type: 'RESULT_OUT',
      body: `O resultado da rodada ${round.number} saiu. Quem foi o craque?`,
      url: `/rodadas/${round.id}/resultado?grupo=${group.id}`,
    });
  });

  it('nunca avisa quem é de outra pelada, nem de rodada que não é do grupo', async () => {
    const { group, admin, round } = await setup();
    const otherGroup = await createGroup(t);
    const stranger = await member(otherGroup.id);

    await notify('ROUND_CREATED', { groupId: group.id, roundId: round.id, actorId: null });
    expect(sender.sent.map((s) => s.endpoint)).toEqual(admin.endpoints);
    expect(sender.sent.map((s) => s.endpoint)).not.toContain(stranger.endpoints[0]);

    // rodada de uma pelada pedida com o groupId de outra: nada sai
    sender.reset();
    await notify('ROUND_CREATED', { groupId: otherGroup.id, roundId: round.id, actorId: null });
    expect(sender.sent).toHaveLength(0);
  });

  it('C17: o serviço de push diz 410 para uma assinatura: a linha é apagada e as outras recebem', async () => {
    const { group, round } = await setup();
    const gone = await member(group.id);
    const ok = await member(group.id);
    sender.answers.set(gone.endpoints[0]!, 'gone');

    await notify('ROUND_CREATED', { groupId: group.id, roundId: round.id, actorId: null });

    expect(sender.sent.map((s) => s.endpoint)).toContain(ok.endpoints[0]);
    expect(await t.prisma.pushSubscription.count({ where: { endpoint: gone.endpoints[0] } })).toBe(
      0,
    );
    expect(await t.prisma.pushSubscription.count({ where: { endpoint: ok.endpoints[0] } })).toBe(1);
  });

  it('C18: erro de rede não derruba o aviso: vai para o log com o requestId, a assinatura fica e as outras recebem', async () => {
    const { group, round } = await setup();
    const broken = await member(group.id);
    const ok = await member(group.id);
    sender.answers.set(broken.endpoints[0]!, 'error');
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await new Promise<void>((resolve) => {
      requestContextMiddleware(
        { headers: { 'x-request-id': 'req-teste-1234' } } as unknown as Request,
        { setHeader: () => undefined } as unknown as Response,
        () => {
          // como o gancho: dispara sem esperar
          expect(() =>
            notifications.notify('ROUND_CREATED', {
              groupId: group.id,
              roundId: round.id,
              actorId: null,
            }),
          ).not.toThrow();
          resolve();
        },
      );
    });
    await notifications.whenIdle();

    expect(logged).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'push-failed',
        requestId: 'req-teste-1234',
        type: 'ROUND_CREATED',
        message: 'rede fora do ar',
      }),
    );
    expect(sender.sent.map((s) => s.endpoint)).toContain(ok.endpoints[0]);
    expect(
      await t.prisma.pushSubscription.count({ where: { endpoint: broken.endpoints[0] } }),
    ).toBe(1);
  });

  it('C18: falha ao carregar os dados (banco) também só vai para o log', async () => {
    const { group, round } = await setup();
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(t.prisma.membership, 'findMany').mockRejectedValueOnce(new Error('banco caiu'));

    await expect(
      notify('ROUND_CREATED', { groupId: group.id, roundId: round.id, actorId: null }),
    ).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalledWith(expect.objectContaining({ message: 'banco caiu' }));
  });

  it('push não grava no AuditLog', async () => {
    const { group, admin, round } = await setup();
    await member(group.id);
    await notify('ROUND_CREATED', {
      groupId: group.id,
      roundId: round.id,
      actorId: admin.membership.id,
    });
    expect(await t.prisma.auditLog.count()).toBe(0);
  });
});

describe('push: avisos sem chaves VAPID', () => {
  let t: TestApp;
  let sender: FakePushSender;

  beforeAll(async () => {
    disableVapid();
    t = await createTestApp({ overrides: [{ provide: PushSender, useClass: FakePushSender }] });
    sender = t.app.get<FakePushSender>(PushSender);
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('C7: com o push desligado nenhuma ação tenta enviar', async () => {
    const group = await createGroup(t);
    const user = await createUser(t);
    await addMember(t, user.id, group.id);
    await t.prisma.pushSubscription.create({
      data: { userId: user.id, endpoint: 'https://fcm.googleapis.com/fcm/x', p256dh: 'a', auth: 'b' },
    });
    const round = await t.prisma.round.create({
      data: { groupId: group.id, scheduledAt: SCHEDULED_AT },
    });
    const notifications = t.app.get(NotificationsService);

    notifications.notify('ROUND_CREATED', { groupId: group.id, roundId: round.id, actorId: null });
    await notifications.whenIdle();

    expect(sender.sent).toHaveLength(0);
  });
});
