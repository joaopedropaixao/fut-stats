import { tickResultSchema } from '@fut-stats/shared';
import request from 'supertest';
import { AuditAction } from '../generated/prisma/enums';
import { RoundEventsService, type RoundEvent } from '../events/round-events.service';
import { PushSender } from '../push/push-sender';
import { NotificationsService } from '../push/notifications.service';
import { addMember, createGroup, createUser, loginAs } from '../test/auth';
import { disableVapid, enableVapid, FakePushSender } from '../test/fake-push-sender';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';
import { InternalModule } from './internal.module';

const HOUR_MS = 60 * 60 * 1000;
const SECRET = 'segredo-do-despertador-dos-testes-0123456789';
const bearer = `Bearer ${SECRET}`;

/** O despertador (`POST /api/internal/tick`): fecha as votações vencidas, de todos os grupos, sem sessão. */
describe('despertador: POST /api/internal/tick', () => {
  describe('com TICK_SECRET', () => {
    let t: TestApp;
    let sender: FakePushSender;

    beforeAll(async () => {
      enableVapid();
      t = await createTestApp({
        imports: [InternalModule.forEnvironment(SECRET)],
        overrides: [{ provide: PushSender, useClass: FakePushSender }],
      });
      sender = t.app.get<FakePushSender>(PushSender);
    });

    beforeEach(async () => {
      await resetDatabase(t.prisma);
      sender.reset();
    });

    afterAll(async () => {
      await t.app.close();
      disableVapid();
    });

    const server = () => t.app.getHttpServer();
    const tick = () => request(server()).post('/api/internal/tick');
    const settle = () => t.app.get(NotificationsService).whenIdle();

    /** Um grupo com uma rodada em votação (aberta há `openedAgoMs`), 2 de cada lado, e um aparelho por pessoa. */
    async function votingGroup(openedAgoMs: number) {
      const group = await createGroup(t, { name: 'Pelada do Sábado' });
      const roster = [
        { team: 'WHITE', position: 'GOALKEEPER' },
        { team: 'WHITE', position: 'DEFENDER' },
        { team: 'BLACK', position: 'GOALKEEPER' },
        { team: 'BLACK', position: 'DEFENDER' },
      ] as const;
      const members: { userId: string; membershipId: string; endpoint: string }[] = [];
      for (const i of roster.keys()) {
        const user = await createUser(t);
        const member = await addMember(t, user.id, group.id, { nickname: `J${i}` });
        const endpoint = `https://fcm.googleapis.com/fcm/send/${group.id}-${i}`;
        await t.prisma.pushSubscription.create({
          data: { userId: user.id, endpoint, p256dh: 'p', auth: 'a' },
        });
        members.push({ userId: user.id, membershipId: member.id, endpoint });
      }
      const round = await t.prisma.round.create({
        data: {
          groupId: group.id,
          scheduledAt: new Date(Date.now() - 2 * 24 * HOUR_MS),
          status: 'VOTING',
          whiteGoals: 0,
          blackGoals: 0,
          votingOpenedAt: new Date(Date.now() - openedAgoMs),
          teamPlayers: {
            create: roster.map((slot, i) => ({
              membershipId: members[i]!.membershipId,
              team: slot.team,
              position: slot.position,
            })),
          },
        },
      });
      return { group, round, members };
    }

    const roundStatus = async (id: string) =>
      (await t.prisma.round.findUniqueOrThrow({ where: { id } })).status;

    it('C19: com o segredo e sem sessão, fecha só a vencida e devolve a contagem (formato do contrato)', async () => {
      const due = await votingGroup(25 * HOUR_MS);
      const fresh = await votingGroup(HOUR_MS);

      const res = await tick().set('Authorization', bearer).expect(200);

      expect(tickResultSchema.parse(res.body)).toEqual({ closedVotings: 1, failed: 0 });
      expect(res.body).toEqual({ closedVotings: 1, failed: 0 });
      const closed = await t.prisma.round.findUniqueOrThrow({ where: { id: due.round.id } });
      expect(closed.status).toBe('CLOSED');
      expect(await roundStatus(fresh.round.id)).toBe('VOTING');
      // O fechamento gravou o resultado de cada jogador escalado e o motivo no registro da rodada.
      const log = await t.prisma.auditLog.findMany({ where: { roundId: due.round.id } });
      expect(log).toHaveLength(1);
      expect(log[0]).toMatchObject({
        action: AuditAction.VOTING_CLOSED,
        after: { status: 'CLOSED', reason: 'DEADLINE_PASSED' },
      });
      expect(await t.prisma.auditLog.count({ where: { roundId: fresh.round.id } })).toBe(0);
    });

    it('C19: o despertador não depende de sessão e não aceita o corpo de ninguém', async () => {
      await votingGroup(25 * HOUR_MS);
      const res = await tick()
        .set('Authorization', bearer)
        .send({ closedVotings: 99, groupId: 'outro' })
        .expect(200);
      expect(res.body).toEqual({ closedVotings: 1, failed: 0 });
    });

    it('C20: o aviso do resultado (RESULT_OUT) sai para os ativos do grupo, uma vez só', async () => {
      const due = await votingGroup(25 * HOUR_MS);

      await tick().set('Authorization', bearer).expect(200);
      await settle();

      expect(sender.sent.map((s) => s.endpoint).sort()).toEqual(
        due.members.map((m) => m.endpoint).sort(),
      );
      expect(sender.sent.every((s) => s.payload.type === 'RESULT_OUT')).toBe(true);
      expect(sender.sent[0]!.payload).toMatchObject({
        url: `/rodadas/${due.round.id}/resultado?grupo=${due.group.id}`,
        tag: `RESULT_OUT:${due.round.id}`,
      });

      // Um segundo tick não repete o aviso.
      const again = await tick().set('Authorization', bearer).expect(200);
      await settle();
      expect(again.body).toEqual({ closedVotings: 0, failed: 0 });
      expect(sender.sent).toHaveLength(due.members.length);
    });

    it('C21: nada vencido devolve 0 e não escreve nada', async () => {
      const fresh = await votingGroup(HOUR_MS);
      const before = await t.prisma.round.findUniqueOrThrow({ where: { id: fresh.round.id } });

      const res = await tick().set('Authorization', bearer).expect(200);
      await settle();

      expect(res.body).toEqual({ closedVotings: 0, failed: 0 });
      expect(await t.prisma.auditLog.count()).toBe(0);
      expect(sender.sent).toHaveLength(0);
      expect(await t.prisma.round.findUniqueOrThrow({ where: { id: fresh.round.id } })).toEqual(
        before,
      );
    });

    it('C21: sem nenhuma rodada também devolve 0', async () => {
      const res = await tick().set('Authorization', bearer).expect(200);
      expect(res.body).toEqual({ closedVotings: 0, failed: 0 });
    });

    describe('C22: sem o segredo certo é 401, sem dizer o motivo e sem fechar nada', () => {
      const cases: [string, (r: request.Test) => request.Test][] = [
        [
          'segredo errado',
          (r) => r.set('Authorization', 'Bearer segredo-errado-com-tamanho-qualquer'),
        ],
        [
          'segredo com o mesmo tamanho',
          (r) => r.set('Authorization', `Bearer ${'x'.repeat(SECRET.length)}`),
        ],
        ['segredo certo com um caractere a mais', (r) => r.set('Authorization', `${bearer}x`)],
        ['Bearer vazio', (r) => r.set('Authorization', 'Bearer ')],
        ['sem o cabeçalho', (r) => r],
        ['Basic com o segredo', (r) => r.set('Authorization', `Basic ${SECRET}`)],
        ['só o segredo, sem esquema', (r) => r.set('Authorization', SECRET)],
        [
          'segredo na query',
          (r) => r.query({ secret: SECRET, token: SECRET, tick_secret: SECRET }),
        ],
        ['segredo em outro cabeçalho', (r) => r.set('x-tick-secret', SECRET)],
        ['segredo no corpo', (r) => r.send({ secret: SECRET })],
      ];

      it.each(cases)('C22: %s', async (_name, build) => {
        const due = await votingGroup(25 * HOUR_MS);

        const res = await build(tick());

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ statusCode: 401, message: 'Unauthorized' });
        expect(JSON.stringify(res.body)).not.toMatch(/secret|segredo|tick/i);
        expect(await roundStatus(due.round.id)).toBe('VOTING');
        expect(await t.prisma.auditLog.count()).toBe(0);
      });

      it('C22: a resposta de 401 é a mesma para segredo errado e para ausente', async () => {
        const wrong = await tick().set(
          'Authorization',
          'Bearer errado-errado-errado-errado-errado',
        );
        const missing = await tick();
        expect(wrong.body).toEqual(missing.body);
        expect(wrong.status).toBe(missing.status);
      });
    });

    it('C25: sessão de usuário comum, sem o segredo, é 401 (sessão não vale nessa rota)', async () => {
      const due = await votingGroup(25 * HOUR_MS);
      const user = await createUser(t);
      const group = await createGroup(t);
      await addMember(t, user.id, group.id, { role: 'ADMIN' });

      await tick().set('Cookie', loginAs(t, user.id)).expect(401);

      expect(await roundStatus(due.round.id)).toBe('VOTING');
    });

    it('C25: o segredo vale sem sessão, e a sessão não entra no lugar do segredo mesmo com o segredo errado', async () => {
      const user = await createUser(t);
      await tick()
        .set('Cookie', loginAs(t, user.id))
        .set('Authorization', 'Bearer errado-errado-errado-errado-errado')
        .expect(401);
    });

    it('C24: dois ticks ao mesmo tempo com uma votação vencida fecham uma vez só e avisam uma vez só', async () => {
      const due = await votingGroup(25 * HOUR_MS);
      const signals: RoundEvent[] = [];
      const off = t.app.get(RoundEventsService).on((event) => signals.push(event));

      const [a, b] = await Promise.all([
        tick().set('Authorization', bearer),
        tick().set('Authorization', bearer),
      ]);
      await settle();
      off();

      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      expect(a.body.closedVotings + b.body.closedVotings).toBe(1);
      expect(await roundStatus(due.round.id)).toBe('CLOSED');
      expect(await t.prisma.auditLog.count({ where: { roundId: due.round.id } })).toBe(1);
      expect(signals.filter((s) => s.type === 'VOTING_CLOSED')).toHaveLength(1);
      expect(sender.sent).toHaveLength(due.members.length);
    });

    it('C30: o tick fecha pelo mesmo caminho do relógio: linha VOTING_CLOSED sem autor e um sinal único', async () => {
      const due = await votingGroup(25 * HOUR_MS);
      const signals: RoundEvent[] = [];
      const off = t.app.get(RoundEventsService).on((event) => signals.push(event));

      await tick().set('Authorization', bearer).expect(200);
      await settle();
      off();

      const rows = await t.prisma.auditLog.findMany({ where: { roundId: due.round.id } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        action: AuditAction.VOTING_CLOSED,
        groupId: due.group.id,
        actorId: null,
        // Sem autor, sem requestId: o do tick não liga o fechamento a ninguém.
        requestId: null,
        after: { status: 'CLOSED', reason: 'DEADLINE_PASSED', voted: 0, total: 4 },
      });
      expect(signals).toEqual([
        {
          groupId: due.group.id,
          roundId: due.round.id,
          type: 'VOTING_CLOSED',
          scopes: ['voting', 'status'],
          actorMembershipId: null,
        },
      ]);
      // Junto com C20: o push do resultado saiu uma vez para cada aparelho.
      expect(sender.sent.filter((s) => s.payload.type === 'RESULT_OUT')).toHaveLength(
        due.members.length,
      );
    });

    it('C19: fecha de todos os grupos, cada um no seu', async () => {
      const a = await votingGroup(25 * HOUR_MS);
      const b = await votingGroup(30 * HOUR_MS);

      const res = await tick().set('Authorization', bearer).expect(200);

      expect(res.body).toEqual({ closedVotings: 2, failed: 0 });
      expect(await roundStatus(a.round.id)).toBe('CLOSED');
      expect(await roundStatus(b.round.id)).toBe('CLOSED');
    });
  });

  describe('sem TICK_SECRET', () => {
    let t: TestApp;

    beforeAll(async () => {
      t = await createTestApp();
    });

    afterAll(async () => {
      await t.app.close();
    });

    it('C23: sem TICK_SECRET a rota não existe: 404 com ou sem cabeçalho', async () => {
      await request(t.app.getHttpServer()).post('/api/internal/tick').expect(404);
      await request(t.app.getHttpServer())
        .post('/api/internal/tick')
        .set('Authorization', bearer)
        .expect(404);
    });

    it('C23: TICK_SECRET vazio também deixa o módulo desligado', () => {
      expect(InternalModule.forEnvironment('').controllers).toEqual([]);
      expect(InternalModule.forEnvironment(undefined).controllers).toEqual([]);
      expect(InternalModule.forEnvironment(SECRET).controllers).toHaveLength(1);
    });
  });
});
