import request from 'supertest';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';

// Exemplo de teste de integração: app real + Postgres de teste (docker compose up -d db-test).
describe('banco de dados', () => {
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

  async function createGroupWithMember() {
    const group = await t.prisma.group.create({
      data: { name: 'Pelada de Quinta', slug: 'quinta' },
    });
    const user = await t.prisma.user.create({
      data: { name: 'Fulano', email: 'fulano@example.com', googleId: 'google-fulano' },
    });
    const membership = await t.prisma.membership.create({
      data: {
        userId: user.id,
        groupId: group.id,
        role: 'ADMIN',
        nickname: 'Fulaninho',
        primaryPosition: 'WINGER',
        secondaryPositions: ['DEFENDER', 'MIDFIELDER'],
        initialRating: 7.5,
      },
    });
    return { group, user, membership };
  }

  it('grava um membro no grupo e lê de volta', async () => {
    const { group } = await createGroupWithMember();

    const found = await t.prisma.group.findUniqueOrThrow({
      where: { slug: 'quinta' },
      include: { memberships: { include: { user: true } } },
    });

    expect(found.id).toBe(group.id);
    expect(found.votingDeadlineHours).toBe(48);
    expect(found.memberships).toHaveLength(1);
    expect(found.memberships[0]).toMatchObject({
      role: 'ADMIN',
      nickname: 'Fulaninho',
      primaryPosition: 'WINGER',
      secondaryPositions: ['DEFENDER', 'MIDFIELDER'],
      initialRating: 7.5,
      isHiredGoalkeeper: false,
      active: true,
      user: { email: 'fulano@example.com' },
    });
  });

  it('não deixa o mesmo usuário entrar duas vezes no mesmo grupo', async () => {
    const { group, user } = await createGroupWithMember();

    await expect(
      t.prisma.membership.create({
        data: {
          userId: user.id,
          groupId: group.id,
          nickname: 'Outro apelido',
          primaryPosition: 'FORWARD',
          initialRating: 6,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('apaga presença, escalação e scouts junto com a rodada', async () => {
    const { group, membership } = await createGroupWithMember();
    const round = await t.prisma.round.create({
      data: {
        groupId: group.id,
        scheduledAt: new Date('2026-10-22T22:00:00Z'),
        attendances: { create: { membershipId: membership.id, confirmed: true } },
        teamPlayers: {
          create: { membershipId: membership.id, team: 'WHITE', position: 'WINGER' },
        },
        matchEvents: {
          create: { membershipId: membership.id, type: 'GOAL', createdById: membership.id },
        },
      },
    });

    await t.prisma.round.delete({ where: { id: round.id } });

    expect(await t.prisma.attendance.count()).toBe(0);
    expect(await t.prisma.teamPlayer.count()).toBe(0);
    expect(await t.prisma.matchEvent.count()).toBe(0);
  });

  it('a app sobe com o banco e responde HTTP', async () => {
    await request(t.app.getHttpServer()).get('/api/health').expect(200);
  });
});
