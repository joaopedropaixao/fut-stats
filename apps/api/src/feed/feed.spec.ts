import { feedAlertSchema } from '@fut-stats/shared';
import request from 'supertest';
import type { RoundStatus } from '../generated/prisma/enums';
import { addMember, createGroup, createUser, loginAs } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

describe('feed: avisos', () => {
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

  const alertsPath = (groupId: string) => `/api/groups/${groupId}/feed/alerts`;
  const get = (groupId: string, cookie: string) =>
    request(t.app.getHttpServer()).get(alertsPath(groupId)).set('Cookie', cookie);

  async function setup() {
    const group = await createGroup(t);
    const user = await createUser(t);
    const member = await addMember(t, user.id, group.id);
    return { group, member, cookie: loginAs(t, user.id) };
  }

  function createRound(
    groupId: string,
    status: RoundStatus,
    scheduledAt: Date,
    data: { closedAt?: Date } = {},
  ) {
    return t.prisma.round.create({
      data: {
        groupId,
        status,
        scheduledAt,
        closedAt: data.closedAt,
        // Votação aberta agora: o prazo (24 h) não vence no teste.
        votingOpenedAt: status === 'VOTING' ? new Date() : undefined,
      },
    });
  }

  it('C8: resultado, votação e presença na ordem, com a rodada e o `me` de cada tipo', async () => {
    const { group, member, cookie } = await setup();
    const other = await addMember(t, (await createUser(t)).id, group.id);
    const now = Date.now();
    const closed = await createRound(group.id, 'CLOSED', new Date(now - 3 * DAY_MS), {
      closedAt: new Date(now - DAY_MS),
    });
    const voting = await createRound(group.id, 'VOTING', new Date(now - 2 * DAY_MS));
    const next = await createRound(group.id, 'SCHEDULED', new Date(now + 5 * DAY_MS));
    // quem pede jogou a rodada em votação, não votou e não respondeu a presença; outro jogador votou
    await t.prisma.teamPlayer.create({
      data: { roundId: voting.id, membershipId: member.id, team: 'WHITE', position: 'MIDFIELDER' },
    });
    await t.prisma.teamPlayer.create({
      data: { roundId: voting.id, membershipId: other.id, team: 'BLACK', position: 'MIDFIELDER' },
    });
    await t.prisma.vote.create({
      data: { roundId: voting.id, voterId: other.id, mvpId: member.id, flopId: member.id },
    });
    await t.prisma.attendance.create({
      data: { roundId: next.id, membershipId: other.id, confirmed: true },
    });

    const res = await get(group.id, cookie).expect(200);

    expect(res.body).toEqual([
      {
        type: 'RESULT',
        roundId: closed.id,
        roundNumber: closed.number,
        scheduledAt: closed.scheduledAt.toISOString(),
        me: {},
      },
      {
        type: 'VOTING',
        roundId: voting.id,
        roundNumber: voting.number,
        scheduledAt: voting.scheduledAt.toISOString(),
        me: { played: true, voted: false },
      },
      {
        type: 'PRESENCE',
        roundId: next.id,
        roundNumber: next.number,
        scheduledAt: next.scheduledAt.toISOString(),
        me: { attendance: null },
      },
    ]);
    for (const alert of res.body) feedAlertSchema.parse(alert);
  });

  it('C8: `me` reflete presença confirmada e recusada, o voto dado e o time escalado', async () => {
    const { group, member, cookie } = await setup();
    const now = Date.now();
    const voting = await createRound(group.id, 'VOTING', new Date(now - DAY_MS));
    await t.prisma.teamPlayer.create({
      data: { roundId: voting.id, membershipId: member.id, team: 'BLACK', position: 'DEFENDER' },
    });
    await t.prisma.vote.create({
      data: { roundId: voting.id, voterId: member.id, mvpId: member.id, flopId: member.id },
    });
    // outro jogador ainda não votou: a votação segue aberta
    const other = await addMember(t, (await createUser(t)).id, group.id);
    await t.prisma.teamPlayer.create({
      data: { roundId: voting.id, membershipId: other.id, team: 'WHITE', position: 'FORWARD' },
    });
    const next = await createRound(group.id, 'SCHEDULED', new Date(now + DAY_MS));
    await t.prisma.attendance.create({
      data: { roundId: next.id, membershipId: member.id, confirmed: false },
    });

    const refused = await get(group.id, cookie).expect(200);
    expect(refused.body.map((a: { me: unknown }) => a.me)).toEqual([
      { played: true, voted: true },
      { attendance: false },
    ]);

    await t.prisma.attendance.update({
      where: { roundId_membershipId: { roundId: next.id, membershipId: member.id } },
      data: { confirmed: true },
    });
    const confirmed = await get(group.id, cookie).expect(200);
    expect(confirmed.body[1].me).toEqual({ attendance: true });
  });

  it('C8: jogo rolando e times publicados trazem o meu time (ou null se não escalado)', async () => {
    const { group, member, cookie } = await setup();
    const now = Date.now();
    const playing = await createRound(group.id, 'IN_PROGRESS', new Date(now - HOUR_MS));
    await t.prisma.teamPlayer.create({
      data: { roundId: playing.id, membershipId: member.id, team: 'WHITE', position: 'FORWARD' },
    });
    const first = await get(group.id, cookie).expect(200);
    expect(first.body).toHaveLength(1);
    expect(first.body[0]).toMatchObject({ type: 'IN_PROGRESS', me: { team: 'WHITE' } });

    await t.prisma.round.update({ where: { id: playing.id }, data: { status: 'TEAMS_PUBLISHED' } });
    await t.prisma.teamPlayer.deleteMany({ where: { roundId: playing.id } });
    const second = await get(group.id, cookie).expect(200);
    expect(second.body[0]).toMatchObject({ type: 'TEAMS_PUBLISHED', me: { team: null } });
  });

  it('C8: só olha as rodadas do grupo da rota', async () => {
    const { group, cookie } = await setup();
    const outro = await createGroup(t);
    await createRound(outro.id, 'IN_PROGRESS', new Date(Date.now() - HOUR_MS));
    const res = await get(group.id, cookie).expect(200);
    expect(res.body).toEqual([]);
  });

  it('C8: votação com o prazo vencido fecha antes de calcular: vem o RESULT, não a VOTING', async () => {
    const { group, cookie } = await setup();
    // Times completos como no teste da votação (o fechamento confere a escalação), prazo de 24 h vencido.
    const lineup = [
      ['WHITE', 'GOALKEEPER', false],
      ['WHITE', 'DEFENDER', false],
      ['WHITE', 'FORWARD', false],
      ['WHITE', 'MIDFIELDER', true],
      ['BLACK', 'GOALKEEPER', false],
      ['BLACK', 'DEFENDER', false],
      ['BLACK', 'FORWARD', false],
      ['BLACK', 'MIDFIELDER', true],
    ] as const;
    const players = [];
    for (const [team, position, isReserve] of lineup) {
      const member = await addMember(t, (await createUser(t)).id, group.id);
      players.push({ membershipId: member.id, team, position, isReserve });
    }
    const round = await t.prisma.round.create({
      data: {
        groupId: group.id,
        status: 'VOTING',
        scheduledAt: new Date(Date.now() - 2 * DAY_MS),
        whiteGoals: 0,
        blackGoals: 0,
        votingOpenedAt: new Date(Date.now() - 25 * HOUR_MS),
        teamPlayers: { create: players },
      },
    });

    const res = await get(group.id, cookie).expect(200);

    expect(res.body.map((a: { type: string; roundId: string }) => [a.type, a.roundId])).toEqual([
      ['RESULT', round.id],
    ]);
    expect(await t.prisma.round.findUniqueOrThrow({ where: { id: round.id } })).toMatchObject({
      status: 'CLOSED',
    });
  });

  it('C24: não membro, membro inativo e usuário de outro grupo recebem 404', async () => {
    const { group } = await setup();
    const stranger = await createUser(t);
    await request(t.app.getHttpServer())
      .get(alertsPath(group.id))
      .set('Cookie', loginAs(t, stranger.id))
      .expect(404);

    const inactive = await createUser(t);
    await addMember(t, inactive.id, group.id, { active: false });
    await get(group.id, loginAs(t, inactive.id)).expect(404);

    const outro = await createGroup(t);
    const outsider = await createUser(t);
    await addMember(t, outsider.id, outro.id, { role: 'ADMIN' });
    await get(group.id, loginAs(t, outsider.id)).expect(404);
  });

  it('sem sessão: 401', async () => {
    const { group } = await setup();
    await request(t.app.getHttpServer()).get(alertsPath(group.id)).expect(401);
  });
});
