import {
  ATTENDANCE_ERROR_LABELS,
  ROUND_NOT_DELETABLE_LABEL,
  ROUND_NOT_EDITABLE_LABEL,
  roundDetailSchema,
  roundListSchema,
} from '@fut-stats/shared';
import request from 'supertest';
import type { RoundStatus } from '../generated/prisma/enums';
import { addMember, createGroup, createUser, loginAs } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('rodadas e presença', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
  });

  afterAll(async () => {
    await t.app.close();
  });

  const server = () => t.app.getHttpServer();
  const as = (userId: string) => loginAs(t, userId);

  /** Grupo com um admin e um jogador, cada um com a sua membership. */
  async function setup() {
    const group = await createGroup(t);
    const adminUser = await createUser(t);
    const playerUser = await createUser(t);
    const admin = await addMember(t, adminUser.id, group.id, { role: 'ADMIN' });
    const player = await addMember(t, playerUser.id, group.id);
    return { group, adminUser, playerUser, admin, player };
  }

  function createRound(
    groupId: string,
    data: { status?: RoundStatus; scheduledAt?: Date; location?: string | null } = {},
  ) {
    return t.prisma.round.create({
      data: {
        groupId,
        scheduledAt: data.scheduledAt ?? new Date(Date.now() + DAY_MS),
        location: data.location ?? 'Arena',
        status: data.status ?? 'SCHEDULED',
      },
    });
  }

  const roundsPath = (groupId: string) => `/api/groups/${groupId}/rounds`;
  const attendancePath = (groupId: string, roundId: string, membershipId: string) =>
    `${roundsPath(groupId)}/${roundId}/attendances/${membershipId}`;

  describe('POST /rounds (criar)', () => {
    it('admin cria com data/hora e local; volta o detalhe com todos pendentes', async () => {
      const { group, adminUser } = await setup();

      const res = await request(server())
        .post(roundsPath(group.id))
        .set('Cookie', as(adminUser.id))
        .send({ scheduledAt: '2026-10-29T20:00:00-03:00', location: '  Arena do Zé ' })
        .expect(201);

      expect(roundDetailSchema.safeParse(res.body).success).toBe(true);
      expect(res.body).toMatchObject({
        scheduledAt: '2026-10-29T23:00:00.000Z',
        location: 'Arena do Zé',
        status: 'SCHEDULED',
        confirmedCount: 0,
        myAttendance: null,
      });
      expect(res.body.attendance.pending).toHaveLength(2);

      const round = await t.prisma.round.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(round.groupId).toBe(group.id);
    });

    it('local é opcional; data no passado vale', async () => {
      const { group, adminUser } = await setup();

      const res = await request(server())
        .post(roundsPath(group.id))
        .set('Cookie', as(adminUser.id))
        .send({ scheduledAt: '2020-01-01T10:00:00Z' })
        .expect(201);

      expect(res.body.location).toBeNull();
    });

    it('400 com data inválida ou sem fuso', async () => {
      const { group, adminUser } = await setup();

      for (const scheduledAt of ['amanhã', '2026-10-29T20:00:00', undefined]) {
        await request(server())
          .post(roundsPath(group.id))
          .set('Cookie', as(adminUser.id))
          .send({ scheduledAt })
          .expect(400);
      }
      expect(await t.prisma.round.count()).toBe(0);
    });

    it('jogador → 403; de fora do grupo → 404; sem sessão → 401', async () => {
      const { group, playerUser } = await setup();
      const outsider = await createUser(t);
      const body = { scheduledAt: '2026-10-29T20:00:00Z' };

      await request(server()).post(roundsPath(group.id)).send(body).expect(401);
      await request(server())
        .post(roundsPath(group.id))
        .set('Cookie', as(playerUser.id))
        .send(body)
        .expect(403);
      await request(server())
        .post(roundsPath(group.id))
        .set('Cookie', as(outsider.id))
        .send(body)
        .expect(404);
      expect(await t.prisma.round.count()).toBe(0);
    });

    it('admin de outro grupo não cria aqui (404)', async () => {
      const { group } = await setup();
      const other = await setup();

      await request(server())
        .post(roundsPath(group.id))
        .set('Cookie', as(other.adminUser.id))
        .send({ scheduledAt: '2026-10-29T20:00:00Z' })
        .expect(404);
    });
  });

  describe('GET /rounds (listar)', () => {
    it('separa próximas (mais perto primeiro) e passadas (mais recente primeiro), só do grupo', async () => {
      const { group, playerUser, player } = await setup();
      const now = Date.now();
      const soon = await createRound(group.id, { scheduledAt: new Date(now + DAY_MS) });
      const later = await createRound(group.id, { scheduledAt: new Date(now + 7 * DAY_MS) });
      const lastWeek = await createRound(group.id, {
        scheduledAt: new Date(now - 7 * DAY_MS),
        status: 'CLOSED',
      });
      const yesterday = await createRound(group.id, { scheduledAt: new Date(now - DAY_MS) });
      await createRound((await createGroup(t)).id);
      await t.prisma.attendance.create({
        data: { roundId: soon.id, membershipId: player.id, confirmed: true },
      });

      const res = await request(server())
        .get(roundsPath(group.id))
        .set('Cookie', as(playerUser.id))
        .expect(200);

      expect(roundListSchema.safeParse(res.body).success).toBe(true);
      expect(res.body.upcoming.map((r: { id: string }) => r.id)).toEqual([soon.id, later.id]);
      expect(res.body.past.map((r: { id: string }) => r.id)).toEqual([yesterday.id, lastWeek.id]);
      expect(res.body.upcoming[0].confirmedCount).toBe(1);
      expect(res.body.currentId).toBe(soon.id);
    });

    it('rodada da vez: a em jogo vem antes da próxima; sem rodada, nula', async () => {
      const { group, playerUser } = await setup();
      const list = () =>
        request(server()).get(roundsPath(group.id)).set('Cookie', as(playerUser.id)).expect(200);

      expect((await list()).body.currentId).toBeNull();

      const soon = await createRound(group.id, { scheduledAt: new Date(Date.now() + DAY_MS) });
      expect((await list()).body.currentId).toBe(soon.id);

      const playing = await createRound(group.id, {
        scheduledAt: new Date(Date.now() - 60 * 60 * 1000),
        status: 'IN_PROGRESS',
      });
      expect((await list()).body.currentId).toBe(playing.id);
    });

    it('confirmado que ficou inativo não conta', async () => {
      const { group, playerUser, player } = await setup();
      const round = await createRound(group.id);
      await t.prisma.attendance.create({
        data: { roundId: round.id, membershipId: player.id, confirmed: true },
      });
      const gone = await addMember(t, (await createUser(t)).id, group.id, { active: false });
      await t.prisma.attendance.create({
        data: { roundId: round.id, membershipId: gone.id, confirmed: true },
      });

      const res = await request(server())
        .get(roundsPath(group.id))
        .set('Cookie', as(playerUser.id))
        .expect(200);

      expect(res.body.upcoming[0].confirmedCount).toBe(1);
    });

    it('de fora do grupo → 404', async () => {
      const { group } = await setup();
      const outsider = await createUser(t);

      await request(server()).get(roundsPath(group.id)).set('Cookie', as(outsider.id)).expect(404);
    });
  });

  describe('GET /rounds/:roundId (detalhe)', () => {
    it('lista de presença: confirmados, não vão e não responderam, só membros ativos', async () => {
      const { group, playerUser, admin, player } = await setup();
      const pending = await addMember(t, (await createUser(t)).id, group.id);
      const gone = await addMember(t, (await createUser(t)).id, group.id, { active: false });
      const round = await createRound(group.id);
      await t.prisma.attendance.createMany({
        data: [
          { roundId: round.id, membershipId: admin.id, confirmed: false },
          { roundId: round.id, membershipId: player.id, confirmed: true },
          { roundId: round.id, membershipId: gone.id, confirmed: true },
        ],
      });

      const res = await request(server())
        .get(`${roundsPath(group.id)}/${round.id}`)
        .set('Cookie', as(playerUser.id))
        .expect(200);

      expect(roundDetailSchema.safeParse(res.body).success).toBe(true);
      const ids = (list: { membershipId: string }[]) => list.map((m) => m.membershipId);
      expect(ids(res.body.attendance.confirmed)).toEqual([player.id]);
      expect(ids(res.body.attendance.declined)).toEqual([admin.id]);
      expect(ids(res.body.attendance.pending)).toEqual([pending.id]);
      expect(res.body.confirmedCount).toBe(1);
      expect(res.body.myAttendance).toBe(true);
    });

    it('diz quem é o solicitante e o que ele pode fazer, conforme o papel e o status', async () => {
      const { group, adminUser, playerUser, admin, player } = await setup();
      const scheduled = await createRound(group.id);
      const published = await createRound(group.id, { status: 'TEAMS_PUBLISHED' });
      const playing = await createRound(group.id, { status: 'IN_PROGRESS' });

      const get = async (userId: string, roundId: string) =>
        (
          await request(server())
            .get(`${roundsPath(group.id)}/${roundId}`)
            .set('Cookie', as(userId))
            .expect(200)
        ).body;

      const asPlayer = await get(playerUser.id, scheduled.id);
      expect(asPlayer.myMembershipId).toBe(player.id);
      expect(asPlayer.permissions).toEqual({
        setOwnAttendance: true,
        setAnyAttendance: false,
        edit: false,
        delete: false,
      });
      expect((await get(playerUser.id, published.id)).permissions).toMatchObject({
        setOwnAttendance: false,
      });

      const asAdmin = await get(adminUser.id, published.id);
      expect(asAdmin.myMembershipId).toBe(admin.id);
      expect(asAdmin.permissions).toEqual({
        setOwnAttendance: true,
        setAnyAttendance: true,
        edit: true,
        delete: true,
      });
      expect((await get(adminUser.id, playing.id)).permissions).toEqual({
        setOwnAttendance: false,
        setAnyAttendance: false,
        edit: false,
        delete: false,
      });
    });

    it('rodada de outro grupo → 404, mesmo para admin', async () => {
      const { group, adminUser } = await setup();
      const foreign = await createRound((await createGroup(t)).id);

      await request(server())
        .get(`${roundsPath(group.id)}/${foreign.id}`)
        .set('Cookie', as(adminUser.id))
        .expect(404);
    });

    it('rodada que não existe → 404', async () => {
      const { group, playerUser } = await setup();

      await request(server())
        .get(`${roundsPath(group.id)}/nao-existe`)
        .set('Cookie', as(playerUser.id))
        .expect(404);
    });
  });

  describe('PATCH /rounds/:roundId (editar)', () => {
    it('admin muda data e local antes do jogo; local vazio vira sem local', async () => {
      const { group, adminUser } = await setup();
      for (const status of ['SCHEDULED', 'TEAMS_PUBLISHED'] as const) {
        const round = await createRound(group.id, { status });

        const res = await request(server())
          .patch(`${roundsPath(group.id)}/${round.id}`)
          .set('Cookie', as(adminUser.id))
          .send({ scheduledAt: '2026-11-05T21:00:00-03:00', location: '  ' })
          .expect(200);

        expect(res.body).toMatchObject({ scheduledAt: '2026-11-06T00:00:00.000Z', location: null });
      }
    });

    it('só o que veio muda', async () => {
      const { group, adminUser } = await setup();
      const round = await createRound(group.id, { location: 'Arena' });

      const res = await request(server())
        .patch(`${roundsPath(group.id)}/${round.id}`)
        .set('Cookie', as(adminUser.id))
        .send({ location: 'Society' })
        .expect(200);

      expect(res.body.location).toBe('Society');
      expect(res.body.scheduledAt).toBe(round.scheduledAt.toISOString());
    });

    it('400 sem nada para mudar', async () => {
      const { group, adminUser } = await setup();
      const round = await createRound(group.id);

      await request(server())
        .patch(`${roundsPath(group.id)}/${round.id}`)
        .set('Cookie', as(adminUser.id))
        .send({})
        .expect(400);
    });

    it('do jogo em diante → 409 ROUND_NOT_EDITABLE', async () => {
      const { group, adminUser } = await setup();
      for (const status of ['IN_PROGRESS', 'VOTING', 'CLOSED'] as const) {
        const round = await createRound(group.id, { status, location: 'Arena' });

        const res = await request(server())
          .patch(`${roundsPath(group.id)}/${round.id}`)
          .set('Cookie', as(adminUser.id))
          .send({ location: 'Outro' })
          .expect(409);

        expect(res.body).toMatchObject({
          code: 'ROUND_NOT_EDITABLE',
          message: ROUND_NOT_EDITABLE_LABEL,
        });
        const stored = await t.prisma.round.findUniqueOrThrow({ where: { id: round.id } });
        expect(stored.location).toBe('Arena');
      }
    });

    it('jogador → 403; rodada de outro grupo → 404', async () => {
      const { group, adminUser, playerUser } = await setup();
      const round = await createRound(group.id);
      const foreign = await createRound((await createGroup(t)).id);

      await request(server())
        .patch(`${roundsPath(group.id)}/${round.id}`)
        .set('Cookie', as(playerUser.id))
        .send({ location: 'Outro' })
        .expect(403);
      await request(server())
        .patch(`${roundsPath(group.id)}/${foreign.id}`)
        .set('Cookie', as(adminUser.id))
        .send({ location: 'Outro' })
        .expect(404);
    });
  });

  describe('número da rodada', () => {
    const numbersOf = async (groupId: string) =>
      (
        await t.prisma.round.findMany({
          where: { groupId },
          select: { number: true },
          orderBy: { number: 'asc' },
        })
      ).map((r) => r.number);

    it('cada grupo conta do 1, na ordem de criação (não da data)', async () => {
      const { group, adminUser } = await setup();
      const other = await createGroup(t);

      await createRound(group.id, { scheduledAt: new Date(Date.now() + 7 * DAY_MS) });
      await createRound(other.id);
      const res = await request(server())
        .post(roundsPath(group.id))
        .set('Cookie', as(adminUser.id))
        .send({ scheduledAt: '2020-01-01T10:00:00Z' })
        .expect(201);

      expect(res.body.number).toBe(2);
      expect(await numbersOf(group.id)).toEqual([1, 2]);
      expect(await numbersOf(other.id)).toEqual([1]);
    });

    it('apagar a última libera o número; apagar outra deixa o buraco', async () => {
      const { group } = await setup();
      const first = await createRound(group.id);
      await createRound(group.id);
      const third = await createRound(group.id);

      await t.prisma.round.delete({ where: { id: third.id } });
      expect((await createRound(group.id)).number).toBe(3);

      await t.prisma.round.delete({ where: { id: first.id } });
      expect((await createRound(group.id)).number).toBe(4);
      expect(await numbersOf(group.id)).toEqual([2, 3, 4]);
    });

    it('rodadas criadas ao mesmo tempo ganham números diferentes', async () => {
      const { group } = await setup();

      await Promise.all(Array.from({ length: 8 }, () => createRound(group.id)));

      expect(await numbersOf(group.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('lista e detalhe mostram o número', async () => {
      const { group, playerUser } = await setup();
      const round = await createRound(group.id);

      const list = await request(server())
        .get(roundsPath(group.id))
        .set('Cookie', as(playerUser.id))
        .expect(200);
      const detail = await request(server())
        .get(`${roundsPath(group.id)}/${round.id}`)
        .set('Cookie', as(playerUser.id))
        .expect(200);

      expect(list.body.upcoming[0].number).toBe(1);
      expect(detail.body.number).toBe(1);
    });
  });

  describe('DELETE /rounds/:roundId (apagar)', () => {
    it('admin apaga antes do jogo, junto com as presenças', async () => {
      const { group, adminUser, player } = await setup();
      for (const status of ['SCHEDULED', 'TEAMS_PUBLISHED'] as const) {
        const round = await createRound(group.id, { status });
        await t.prisma.attendance.create({
          data: { roundId: round.id, membershipId: player.id, confirmed: true },
        });

        await request(server())
          .delete(`${roundsPath(group.id)}/${round.id}`)
          .set('Cookie', as(adminUser.id))
          .expect(204);

        expect(await t.prisma.round.findUnique({ where: { id: round.id } })).toBeNull();
        expect(await t.prisma.attendance.count({ where: { roundId: round.id } })).toBe(0);
      }
    });

    it('do jogo em diante → 409 ROUND_NOT_DELETABLE', async () => {
      const { group, adminUser } = await setup();
      for (const status of ['IN_PROGRESS', 'VOTING', 'CLOSED'] as const) {
        const round = await createRound(group.id, { status });

        const res = await request(server())
          .delete(`${roundsPath(group.id)}/${round.id}`)
          .set('Cookie', as(adminUser.id))
          .expect(409);

        expect(res.body).toMatchObject({
          code: 'ROUND_NOT_DELETABLE',
          message: ROUND_NOT_DELETABLE_LABEL,
        });
      }
      expect(await t.prisma.round.count()).toBe(3);
    });

    it('jogador → 403; rodada de outro grupo → 404 e continua lá', async () => {
      const { group, adminUser, playerUser } = await setup();
      const round = await createRound(group.id);
      const foreign = await createRound((await createGroup(t)).id);

      await request(server())
        .delete(`${roundsPath(group.id)}/${round.id}`)
        .set('Cookie', as(playerUser.id))
        .expect(403);
      await request(server())
        .delete(`${roundsPath(group.id)}/${foreign.id}`)
        .set('Cookie', as(adminUser.id))
        .expect(404);
      expect(await t.prisma.round.count()).toBe(2);
    });
  });

  describe('PUT /rounds/:roundId/attendances/:membershipId (presença)', () => {
    it('jogador confirma e desmarca a própria presença', async () => {
      const { group, playerUser, player } = await setup();
      const round = await createRound(group.id);
      const path = attendancePath(group.id, round.id, player.id);

      const going = await request(server())
        .put(path)
        .set('Cookie', as(playerUser.id))
        .send({ confirmed: true })
        .expect(200);
      expect(going.body.myAttendance).toBe(true);
      expect(going.body.confirmedCount).toBe(1);

      const notGoing = await request(server())
        .put(path)
        .set('Cookie', as(playerUser.id))
        .send({ confirmed: false })
        .expect(200);
      expect(notGoing.body.myAttendance).toBe(false);
      expect(notGoing.body.attendance.declined[0].membershipId).toBe(player.id);
      expect(await t.prisma.attendance.count()).toBe(1);
    });

    it('jogador não marca a de outro → 403 NOT_OWN_ATTENDANCE', async () => {
      const { group, playerUser, admin } = await setup();
      const round = await createRound(group.id);

      const res = await request(server())
        .put(attendancePath(group.id, round.id, admin.id))
        .set('Cookie', as(playerUser.id))
        .send({ confirmed: true })
        .expect(403);

      expect(res.body).toMatchObject({
        code: 'NOT_OWN_ATTENDANCE',
        message: ATTENDANCE_ERROR_LABELS.NOT_OWN_ATTENDANCE,
      });
      expect(await t.prisma.attendance.count()).toBe(0);
    });

    it('com os times publicados, jogador → 409 TEAMS_ALREADY_PUBLISHED; admin ainda muda', async () => {
      const { group, adminUser, playerUser, player } = await setup();
      const round = await createRound(group.id, { status: 'TEAMS_PUBLISHED' });
      const path = attendancePath(group.id, round.id, player.id);

      const res = await request(server())
        .put(path)
        .set('Cookie', as(playerUser.id))
        .send({ confirmed: false })
        .expect(409);
      expect(res.body.code).toBe('TEAMS_ALREADY_PUBLISHED');

      const byAdmin = await request(server())
        .put(path)
        .set('Cookie', as(adminUser.id))
        .send({ confirmed: false })
        .expect(200);
      expect(byAdmin.body.attendance.declined[0].membershipId).toBe(player.id);
    });

    it('admin marca a de qualquer membro e a própria', async () => {
      const { group, adminUser, admin, player } = await setup();
      const round = await createRound(group.id);

      await request(server())
        .put(attendancePath(group.id, round.id, player.id))
        .set('Cookie', as(adminUser.id))
        .send({ confirmed: true })
        .expect(200);
      const res = await request(server())
        .put(attendancePath(group.id, round.id, admin.id))
        .set('Cookie', as(adminUser.id))
        .send({ confirmed: true })
        .expect(200);

      expect(res.body.confirmedCount).toBe(2);
      expect(res.body.myAttendance).toBe(true);
    });

    it('do jogo em diante, trava até para o admin → 409 ATTENDANCE_CLOSED', async () => {
      const { group, adminUser, player } = await setup();
      for (const status of ['IN_PROGRESS', 'VOTING', 'CLOSED'] as const) {
        const round = await createRound(group.id, { status });

        const res = await request(server())
          .put(attendancePath(group.id, round.id, player.id))
          .set('Cookie', as(adminUser.id))
          .send({ confirmed: true })
          .expect(409);

        expect(res.body).toMatchObject({
          code: 'ATTENDANCE_CLOSED',
          message: ATTENDANCE_ERROR_LABELS.ATTENDANCE_CLOSED,
        });
      }
      expect(await t.prisma.attendance.count()).toBe(0);
    });

    it('membro inativo ou de outro grupo como alvo → 404', async () => {
      const { group, adminUser } = await setup();
      const round = await createRound(group.id);
      const gone = await addMember(t, (await createUser(t)).id, group.id, { active: false });
      const other = await setup();

      for (const membershipId of [gone.id, other.player.id, 'nao-existe']) {
        await request(server())
          .put(attendancePath(group.id, round.id, membershipId))
          .set('Cookie', as(adminUser.id))
          .send({ confirmed: true })
          .expect(404);
      }
      expect(await t.prisma.attendance.count()).toBe(0);
    });

    it('rodada de outro grupo → 404, mesmo com a própria membership de lá', async () => {
      const { group, playerUser, player } = await setup();
      const otherGroup = await createGroup(t);
      const theirs = await addMember(t, playerUser.id, otherGroup.id);
      const foreign = await createRound(otherGroup.id);

      // Rota do meu grupo apontando para a rodada do outro.
      await request(server())
        .put(attendancePath(group.id, foreign.id, player.id))
        .set('Cookie', as(playerUser.id))
        .send({ confirmed: true })
        .expect(404);
      // Rota do meu grupo com a membership do outro grupo.
      const mine = await createRound(group.id);
      await request(server())
        .put(attendancePath(group.id, mine.id, theirs.id))
        .set('Cookie', as(playerUser.id))
        .send({ confirmed: true })
        .expect(404);
      expect(await t.prisma.attendance.count()).toBe(0);
    });

    it('400 sem `confirmed` booleano; de fora do grupo → 404', async () => {
      const { group, playerUser, player } = await setup();
      const round = await createRound(group.id);
      const outsider = await createUser(t);
      const path = attendancePath(group.id, round.id, player.id);

      await request(server())
        .put(path)
        .set('Cookie', as(playerUser.id))
        .send({ confirmed: 'sim' })
        .expect(400);
      await request(server())
        .put(path)
        .set('Cookie', as(outsider.id))
        .send({ confirmed: true })
        .expect(404);
    });
  });
});
