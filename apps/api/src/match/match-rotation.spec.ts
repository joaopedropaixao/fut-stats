import request from 'supertest';
import { addMember, createGroup, createUser, loginAs } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';

const FORMATION = [
  'GOALKEEPER',
  'DEFENDER',
  'DEFENDER',
  'WINGER',
  'WINGER',
  'MIDFIELDER',
  'FORWARD',
] as const;

describe('rodízio da partida', () => {
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

  async function setup({
    status = 'IN_PROGRESS',
    reserves = true,
  }: { status?: 'IN_PROGRESS' | 'TEAMS_PUBLISHED' | 'POST_MATCH'; reserves?: boolean } = {}) {
    const group = await createGroup(t);
    const adminUser = await createUser(t);
    const admin = await addMember(t, adminUser.id, group.id, { role: 'ADMIN' });
    const round = await t.prisma.round.create({
      data: { groupId: group.id, scheduledAt: new Date(), status },
    });

    const players: { user: { id: string }; membership: { id: string } }[][] = [[], []];
    for (const [teamIndex, team] of (['WHITE', 'BLACK'] as const).entries()) {
      for (const [index, position] of FORMATION.entries()) {
        const user = await createUser(t);
        const membership = await addMember(t, user.id, group.id, {
          nickname: `${teamIndex}-${index}`,
          primaryPosition: position,
        });
        await t.prisma.teamPlayer.create({
          data: { roundId: round.id, membershipId: membership.id, team, position },
        });
        await t.prisma.attendance.create({
          data: { roundId: round.id, membershipId: membership.id, confirmed: true },
        });
        players[teamIndex]!.push({ user, membership });
      }
      if (reserves) {
        const reserveUser = await createUser(t);
        const reserve = await addMember(t, reserveUser.id, group.id, {
          nickname: `${teamIndex}-reserve`,
          primaryPosition: 'FORWARD',
        });
        await t.prisma.teamPlayer.create({
          data: {
            roundId: round.id,
            membershipId: reserve.id,
            team,
            position: 'FORWARD',
            isReserve: true,
          },
        });
        await t.prisma.attendance.create({
          data: { roundId: round.id, membershipId: reserve.id, confirmed: true },
        });
      }
    }
    return { group, adminUser, admin, round, players };
  }

  it('C13: admin inicia o rodízio em jogo com reservas e recebe a visão atualizada', async () => {
    const c = await setup();
    const path = `/api/groups/${c.group.id}/rounds/${c.round.id}/match/rotation`;

    const response = await request(t.app.getHttpServer())
      .post(path)
      .set('Cookie', loginAs(t, c.adminUser.id))
      .send({ minutes: 60 })
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'IN_PROGRESS',
      rotation: { minutes: 60, startedAt: expect.any(String) },
    });
    const saved = await t.prisma.round.findUniqueOrThrow({ where: { id: c.round.id } });
    expect(saved.rotationStartedAt).toEqual(new Date(response.body.rotation.startedAt));
    expect(saved.rotationMinutes).toBe(60);
  });

  it('C14: iniciar sem corpo usa a duração padrão de 60 minutos', async () => {
    const c = await setup();
    const response = await request(t.app.getHttpServer())
      .post(`/api/groups/${c.group.id}/rounds/${c.round.id}/match/rotation`)
      .set('Cookie', loginAs(t, c.adminUser.id))
      .expect(200);

    expect(response.body.rotation.minutes).toBe(60);
  });

  it('C15: reiniciar grava a duração nova e um novo instante', async () => {
    const c = await setup();
    const path = `/api/groups/${c.group.id}/rounds/${c.round.id}/match/rotation`;
    const first = await request(t.app.getHttpServer())
      .post(path)
      .set('Cookie', loginAs(t, c.adminUser.id))
      .send({ minutes: 60 })
      .expect(200);
    const second = await request(t.app.getHttpServer())
      .post(path)
      .set('Cookie', loginAs(t, c.adminUser.id))
      .send({ minutes: 40 })
      .expect(200);

    expect(second.body.rotation.minutes).toBe(40);
    expect(new Date(second.body.rotation.startedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(first.body.rotation.startedAt).getTime(),
    );
  });

  it('C16: parar apaga os dois campos persistidos e devolve rotation nulo', async () => {
    const c = await setup();
    const path = `/api/groups/${c.group.id}/rounds/${c.round.id}/match/rotation`;
    await request(t.app.getHttpServer())
      .post(path)
      .set('Cookie', loginAs(t, c.adminUser.id))
      .send({ minutes: 60 })
      .expect(200);

    const response = await request(t.app.getHttpServer())
      .delete(path)
      .set('Cookie', loginAs(t, c.adminUser.id))
      .expect(200);
    const saved = await t.prisma.round.findUniqueOrThrow({ where: { id: c.round.id } });

    expect(response.body.rotation).toBeNull();
    expect(saved.rotationStartedAt).toBeNull();
    expect(saved.rotationMinutes).toBeNull();
  });

  it.each([17, 125, 'x'])('C17: rejeita duração inválida %s com 400', async (minutes) => {
    const c = await setup();
    await request(t.app.getHttpServer())
      .post(`/api/groups/${c.group.id}/rounds/${c.round.id}/match/rotation`)
      .set('Cookie', loginAs(t, c.adminUser.id))
      .send({ minutes })
      .expect(400);
  });

  it.each(['TEAMS_PUBLISHED', 'POST_MATCH'] as const)(
    'C18: não permite iniciar ou parar fora de IN_PROGRESS (%s)',
    async (status) => {
      const c = await setup({ status });
      const path = `/api/groups/${c.group.id}/rounds/${c.round.id}/match/rotation`;
      for (const response of [
        await request(t.app.getHttpServer())
          .post(path)
          .set('Cookie', loginAs(t, c.adminUser.id))
          .send({ minutes: 60 }),
        await request(t.app.getHttpServer()).delete(path).set('Cookie', loginAs(t, c.adminUser.id)),
      ]) {
        expect(response.status).toBe(409);
        expect(response.body.code).toBe('ROUND_NOT_IN_PROGRESS');
      }
    },
  );

  it('C19: não inicia quando nenhum dos times tem reserva', async () => {
    const c = await setup({ reserves: false });
    const response = await request(t.app.getHttpServer())
      .post(`/api/groups/${c.group.id}/rounds/${c.round.id}/match/rotation`)
      .set('Cookie', loginAs(t, c.adminUser.id))
      .send({ minutes: 60 })
      .expect(409);
    expect(response.body.code).toBe('NO_RESERVES');
    const view = await request(t.app.getHttpServer())
      .get(`/api/groups/${c.group.id}/rounds/${c.round.id}/match`)
      .set('Cookie', loginAs(t, c.adminUser.id))
      .expect(200);
    expect(view.body.permissions.rotate).toBe(false);
  });

  it('C20: jogador comum não pode iniciar nem parar o rodízio', async () => {
    const c = await setup();
    const path = `/api/groups/${c.group.id}/rounds/${c.round.id}/match/rotation`;
    const post = await request(t.app.getHttpServer())
      .post(path)
      .set('Cookie', loginAs(t, c.players[0]![0]!.user.id))
      .send({ minutes: 60 })
      .expect(403);
    const del = await request(t.app.getHttpServer())
      .delete(path)
      .set('Cookie', loginAs(t, c.players[0]![0]!.user.id))
      .expect(403);
    expect(post.body.code).toBe('NOT_ADMIN');
    expect(del.body.code).toBe('NOT_ADMIN');
  });

  it('C21: visão inclui o relógio do servidor e permissões para admin e jogador', async () => {
    const c = await setup();
    const path = `/api/groups/${c.group.id}/rounds/${c.round.id}/match`;
    await request(t.app.getHttpServer())
      .post(`${path}/rotation`)
      .set('Cookie', loginAs(t, c.adminUser.id))
      .send({ minutes: 60 })
      .expect(200);
    const admin = await request(t.app.getHttpServer())
      .get(path)
      .set('Cookie', loginAs(t, c.adminUser.id))
      .expect(200);
    const player = await request(t.app.getHttpServer())
      .get(path)
      .set('Cookie', loginAs(t, c.players[0]![0]!.user.id))
      .expect(200);

    expect(admin.body.rotation.minutes).toBe(60);
    expect(Number.isNaN(Date.parse(admin.body.serverTime))).toBe(false);
    expect(admin.body.permissions.rotate).toBe(true);
    expect(player.body.permissions.rotate).toBe(false);
  });

  it('C22: finalizar preserva os campos e esconde o rodízio fora de IN_PROGRESS', async () => {
    const c = await setup();
    const path = `/api/groups/${c.group.id}/rounds/${c.round.id}/match`;
    await request(t.app.getHttpServer())
      .post(`${path}/rotation`)
      .set('Cookie', loginAs(t, c.adminUser.id))
      .send({ minutes: 60 })
      .expect(200);

    const response = await request(t.app.getHttpServer())
      .post(`${path}/finish`)
      .set('Cookie', loginAs(t, c.adminUser.id))
      .send({ WHITE: 0, BLACK: 0 })
      .expect(200);
    const saved = await t.prisma.round.findUniqueOrThrow({ where: { id: c.round.id } });

    expect(response.body.status).toBe('POST_MATCH');
    expect(response.body.rotation).toBeNull();
    expect(saved.rotationStartedAt).not.toBeNull();
    expect(saved.rotationMinutes).toBe(60);
  });

  it('C23: rodada de outro grupo, não membro e membro inativo recebem 404 sem gravar', async () => {
    const c = await setup();
    const otherGroup = await createGroup(t);
    const otherUser = await createUser(t);
    await addMember(t, otherUser.id, otherGroup.id, { role: 'ADMIN' });
    const otherRound = await t.prisma.round.create({
      data: { groupId: otherGroup.id, scheduledAt: new Date(), status: 'IN_PROGRESS' },
    });
    const inactiveUser = await createUser(t);
    await addMember(t, inactiveUser.id, c.group.id, { active: false });
    const nonMember = await createUser(t);
    const base = `/api/groups/${c.group.id}/rounds/${c.round.id}/match`;

    for (const userId of [otherUser.id, inactiveUser.id, nonMember.id]) {
      await request(t.app.getHttpServer()).get(base).set('Cookie', loginAs(t, userId)).expect(404);
      await request(t.app.getHttpServer())
        .post(`${base}/rotation`)
        .set('Cookie', loginAs(t, userId))
        .send({ minutes: 60 })
        .expect(404);
      await request(t.app.getHttpServer())
        .delete(`${base}/rotation`)
        .set('Cookie', loginAs(t, userId))
        .expect(404);
    }
    const foreignRoundPath = `/api/groups/${c.group.id}/rounds/${otherRound.id}/match`;
    await request(t.app.getHttpServer())
      .get(foreignRoundPath)
      .set('Cookie', loginAs(t, c.adminUser.id))
      .expect(404);
    await request(t.app.getHttpServer())
      .post(`${foreignRoundPath}/rotation`)
      .set('Cookie', loginAs(t, c.adminUser.id))
      .send({ minutes: 60 })
      .expect(404);
    await request(t.app.getHttpServer())
      .delete(`${foreignRoundPath}/rotation`)
      .set('Cookie', loginAs(t, c.adminUser.id))
      .expect(404);
    const saved = await t.prisma.round.findUniqueOrThrow({ where: { id: c.round.id } });
    const foreignSaved = await t.prisma.round.findUniqueOrThrow({ where: { id: otherRound.id } });
    expect(saved.rotationStartedAt).toBeNull();
    expect(saved.rotationMinutes).toBeNull();
    expect(foreignSaved.rotationStartedAt).toBeNull();
    expect(foreignSaved.rotationMinutes).toBeNull();
  });

  it('C24: start e finish concorrentes deixam a rodada fora de jogo sem rodízio visível', async () => {
    const c = await setup();
    const path = `/api/groups/${c.group.id}/rounds/${c.round.id}/match`;
    const cookie = loginAs(t, c.adminUser.id);
    const [start, finish] = await Promise.all([
      request(t.app.getHttpServer())
        .post(`${path}/rotation`)
        .set('Cookie', cookie)
        .send({ minutes: 60 }),
      request(t.app.getHttpServer())
        .post(`${path}/finish`)
        .set('Cookie', cookie)
        .send({ WHITE: 0, BLACK: 0 }),
    ]);

    expect(start.status === 200 || start.status === 409).toBe(true);
    expect(finish.status).toBe(200);
    const view = await request(t.app.getHttpServer()).get(path).set('Cookie', cookie).expect(200);
    expect(view.body.status).toBe('POST_MATCH');
    expect(view.body.rotation).toBeNull();
  });
});
