import {
  MATCH_EVENT_ERROR_LABELS,
  matchViewSchema,
  ROUND_TRANSITION_ERROR_LABELS,
  SCORE_ENTRY_ERROR_LABELS,
} from '@fut-stats/shared';
import request from 'supertest';
import type { Position, RoundStatus } from '../generated/prisma/enums';
import { addMember, createGroup, createUser, loginAs } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';

/** 1-2-3-1: goleiro, 2 zagueiros, 2 alas, 1 meio, 1 atacante. */
const FORMATION: Position[] = [
  'GOALKEEPER',
  'DEFENDER',
  'DEFENDER',
  'WINGER',
  'WINGER',
  'MIDFIELDER',
  'FORWARD',
];

describe('placar e lances da rodada', () => {
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

  /** Grupo com admin, 14 jogadores escalados (7 por time) e um membro que não jogou. */
  async function setup(status: RoundStatus = 'IN_PROGRESS') {
    const group = await createGroup(t);
    const adminUser = await createUser(t);
    const admin = await addMember(t, adminUser.id, group.id, { role: 'ADMIN' });
    const round = await t.prisma.round.create({
      data: { groupId: group.id, scheduledAt: new Date(), status },
    });

    const white: { user: { id: string }; membership: { id: string } }[] = [];
    const black: { user: { id: string }; membership: { id: string } }[] = [];
    for (const [team, list] of [
      ['WHITE', white],
      ['BLACK', black],
    ] as const) {
      for (const [i, position] of FORMATION.entries()) {
        const user = await createUser(t);
        const membership = await t.prisma.membership.create({
          data: {
            userId: user.id,
            groupId: group.id,
            nickname: `${team === 'WHITE' ? 'B' : 'P'}${i}`,
            primaryPosition: position,
            secondaryPositions: [],
            initialRating: 6,
          },
        });
        await t.prisma.teamPlayer.create({
          data: { roundId: round.id, membershipId: membership.id, team, position },
        });
        list.push({ user, membership });
      }
    }
    const benchUser = await createUser(t);
    const bench = await addMember(t, benchUser.id, group.id);
    return { group, adminUser, admin, round, white, black, benchUser, bench };
  }

  const matchPath = (groupId: string, roundId: string, rest = '') =>
    `/api/groups/${groupId}/rounds/${roundId}/match${rest}`;

  type Ctx = Awaited<ReturnType<typeof setup>>;

  const putScore = (c: Ctx, userId: string, body: object) =>
    request(server())
      .put(matchPath(c.group.id, c.round.id, '/score'))
      .set('Cookie', as(userId))
      .send(body);

  const postEvent = (c: Ctx, userId: string, body: object) =>
    request(server())
      .post(matchPath(c.group.id, c.round.id, '/events'))
      .set('Cookie', as(userId))
      .send(body);

  const patchStatus = (c: Ctx, userId: string, to: string) =>
    request(server())
      .patch(matchPath(c.group.id, c.round.id, '/status'))
      .set('Cookie', as(userId))
      .send({ to });

  describe('GET /match', () => {
    it('membro vê status, placar, quem jogou e os lances, com o que ele pode fazer', async () => {
      const c = await setup();
      await t.prisma.round.update({
        where: { id: c.round.id },
        data: { whiteGoals: 1, blackGoals: 0 },
      });
      await t.prisma.matchEvent.create({
        data: {
          roundId: c.round.id,
          membershipId: c.white[1]!.membership.id,
          type: 'GOAL',
          createdById: c.admin.id,
        },
      });

      const res = await request(server())
        .get(matchPath(c.group.id, c.round.id))
        .set('Cookie', as(c.white[0]!.user.id))
        .expect(200);

      expect(matchViewSchema.safeParse(res.body).success).toBe(true);
      expect(res.body).toMatchObject({
        scheduledAt: c.round.scheduledAt.toISOString(),
        status: 'IN_PROGRESS',
        score: { WHITE: 1, BLACK: 0 },
        isOpen: true,
        me: { membershipId: c.white[0]!.membership.id, isAdmin: false },
      });
      expect(res.body.players).toHaveLength(14);
      expect(res.body.events).toEqual([
        expect.objectContaining({
          nickname: 'B1',
          team: 'WHITE',
          type: 'GOAL',
          createdByNickname: 'Apelido',
          canRemove: false,
        }),
      ]);
    });

    it('canRemove: o admin e o dono do lance podem; os outros não; encerrada ninguém', async () => {
      const c = await setup();
      await t.prisma.matchEvent.create({
        data: {
          roundId: c.round.id,
          membershipId: c.white[1]!.membership.id,
          type: 'GOAL',
          createdById: c.admin.id,
        },
      });
      const canRemove = async (userId: string) =>
        (await request(server()).get(matchPath(c.group.id, c.round.id)).set('Cookie', as(userId)))
          .body.events[0].canRemove;

      expect(await canRemove(c.adminUser.id)).toBe(true);
      expect(await canRemove(c.white[1]!.user.id)).toBe(true);
      expect(await canRemove(c.white[0]!.user.id)).toBe(false);

      await t.prisma.round.update({ where: { id: c.round.id }, data: { status: 'CLOSED' } });
      expect(await canRemove(c.adminUser.id)).toBe(false);
    });

    it('sem placar lançado, score é null; sem times montados, players é vazio', async () => {
      const group = await createGroup(t);
      const user = await createUser(t);
      await addMember(t, user.id, group.id);
      const round = await t.prisma.round.create({
        data: { groupId: group.id, scheduledAt: new Date() },
      });

      const res = await request(server())
        .get(matchPath(group.id, round.id))
        .set('Cookie', as(user.id))
        .expect(200);

      expect(res.body).toMatchObject({ score: null, players: [], events: [], isOpen: false });
    });

    it('next: começar (TEAMS_PUBLISHED), encerrar com placar faltando (IN_PROGRESS), nada depois', async () => {
      const published = await setup('TEAMS_PUBLISHED');
      const a = await request(server())
        .get(matchPath(published.group.id, published.round.id))
        .set('Cookie', as(published.adminUser.id))
        .expect(200);
      expect(a.body.next).toEqual({ to: 'IN_PROGRESS', allowed: true, reason: null });

      const running = await setup('IN_PROGRESS');
      const b = await request(server())
        .get(matchPath(running.group.id, running.round.id))
        .set('Cookie', as(running.adminUser.id))
        .expect(200);
      expect(b.body.next).toEqual({
        to: 'VOTING',
        allowed: false,
        reason: ROUND_TRANSITION_ERROR_LABELS.SCORE_MISSING,
      });

      const voting = await setup('VOTING');
      const c = await request(server())
        .get(matchPath(voting.group.id, voting.round.id))
        .set('Cookie', as(voting.adminUser.id))
        .expect(200);
      expect(c.body.next).toBeNull();
    });

    it('não-membro e rodada de outro grupo → 404', async () => {
      const c = await setup();
      const other = await createGroup(t);
      const stranger = await createUser(t);
      await addMember(t, stranger.id, other.id);

      await request(server())
        .get(matchPath(c.group.id, c.round.id))
        .set('Cookie', as(stranger.id))
        .expect(404);
      await request(server())
        .get(matchPath(other.id, c.round.id))
        .set('Cookie', as(stranger.id))
        .expect(404);
    });

    it('sem sessão → 401', async () => {
      const c = await setup();
      await request(server()).get(matchPath(c.group.id, c.round.id)).expect(401);
    });
  });

  describe('PATCH /match/status', () => {
    it('admin começa o jogo (TEAMS_PUBLISHED → IN_PROGRESS)', async () => {
      const c = await setup('TEAMS_PUBLISHED');
      const res = await patchStatus(c, c.adminUser.id, 'IN_PROGRESS').expect(200);
      expect(res.body.status).toBe('IN_PROGRESS');
      const round = await t.prisma.round.findUniqueOrThrow({ where: { id: c.round.id } });
      expect(round.status).toBe('IN_PROGRESS');
    });

    it('não começa sem times montados (INVALID_LINEUP) nem com a rodada agendada', async () => {
      const group = await createGroup(t);
      const adminUser = await createUser(t);
      await addMember(t, adminUser.id, group.id, { role: 'ADMIN' });
      const round = await t.prisma.round.create({
        data: { groupId: group.id, scheduledAt: new Date(), status: 'TEAMS_PUBLISHED' },
      });
      const noTeams = await request(server())
        .patch(matchPath(group.id, round.id, '/status'))
        .set('Cookie', as(adminUser.id))
        .send({ to: 'IN_PROGRESS' })
        .expect(409);
      expect(noTeams.body).toMatchObject({
        code: 'INVALID_LINEUP',
        message: ROUND_TRANSITION_ERROR_LABELS.INVALID_LINEUP,
      });

      const scheduled = await setup('SCHEDULED');
      const res = await patchStatus(scheduled, scheduled.adminUser.id, 'IN_PROGRESS').expect(409);
      expect(res.body.code).toBe('INVALID_TRANSITION');
    });

    it('admin encerra o jogo com placar batendo com os gols (IN_PROGRESS → VOTING)', async () => {
      const c = await setup();
      await putScore(c, c.adminUser.id, { WHITE: 1, BLACK: 0 }).expect(200);
      await postEvent(c, c.adminUser.id, {
        membershipId: c.white[1]!.membership.id,
        type: 'GOAL',
      }).expect(201);

      const res = await patchStatus(c, c.adminUser.id, 'VOTING').expect(200);
      expect(res.body.status).toBe('VOTING');
    });

    it('não encerra sem placar (SCORE_MISSING) nem com gols diferentes do placar (GOALS_MISMATCH)', async () => {
      const c = await setup();
      const missing = await patchStatus(c, c.adminUser.id, 'VOTING').expect(409);
      expect(missing.body.code).toBe('SCORE_MISSING');

      await putScore(c, c.adminUser.id, { WHITE: 2, BLACK: 0 }).expect(200);
      await postEvent(c, c.adminUser.id, {
        membershipId: c.white[1]!.membership.id,
        type: 'GOAL',
      }).expect(201);
      const mismatch = await patchStatus(c, c.adminUser.id, 'VOTING').expect(409);
      expect(mismatch.body.code).toBe('GOALS_MISMATCH');
    });

    it('jogador comum → 403; destino fora de IN_PROGRESS/VOTING → 400', async () => {
      const c = await setup('TEAMS_PUBLISHED');
      await patchStatus(c, c.white[0]!.user.id, 'IN_PROGRESS').expect(403);
      await patchStatus(c, c.adminUser.id, 'CLOSED').expect(400);
      const round = await t.prisma.round.findUniqueOrThrow({ where: { id: c.round.id } });
      expect(round.status).toBe('TEAMS_PUBLISHED');
    });
  });

  describe('PUT /match/score', () => {
    it('admin lança e corrige o placar durante o jogo', async () => {
      const c = await setup();
      const first = await putScore(c, c.adminUser.id, { WHITE: 3, BLACK: 1 }).expect(200);
      expect(first.body.score).toEqual({ WHITE: 3, BLACK: 1 });

      await putScore(c, c.adminUser.id, { WHITE: 2, BLACK: 1 }).expect(200);
      const round = await t.prisma.round.findUniqueOrThrow({ where: { id: c.round.id } });
      expect([round.whiteGoals, round.blackGoals]).toEqual([2, 1]);
    });

    it('também corrige na votação; encerrada → 409 ROUND_NOT_OPEN', async () => {
      const voting = await setup('VOTING');
      await putScore(voting, voting.adminUser.id, { WHITE: 1, BLACK: 1 }).expect(200);

      const closed = await setup('CLOSED');
      const res = await putScore(closed, closed.adminUser.id, { WHITE: 1, BLACK: 1 }).expect(409);
      expect(res.body).toMatchObject({
        code: 'ROUND_NOT_OPEN',
        message: SCORE_ENTRY_ERROR_LABELS.ROUND_NOT_OPEN,
      });
    });

    it('antes de começar o jogo → 409 ROUND_NOT_OPEN', async () => {
      const c = await setup('TEAMS_PUBLISHED');
      const res = await putScore(c, c.adminUser.id, { WHITE: 1, BLACK: 0 }).expect(409);
      expect(res.body.code).toBe('ROUND_NOT_OPEN');
    });

    it('jogador comum → 403 NOT_ADMIN', async () => {
      const c = await setup();
      const res = await putScore(c, c.white[0]!.user.id, { WHITE: 1, BLACK: 0 }).expect(403);
      expect(res.body.code).toBe('NOT_ADMIN');
    });

    it('não deixa o placar abaixo dos gols já lançados (SCORE_BELOW_GOALS)', async () => {
      const c = await setup();
      await postEvent(c, c.adminUser.id, {
        membershipId: c.white[1]!.membership.id,
        type: 'GOAL',
      }).expect(201);
      const res = await putScore(c, c.adminUser.id, { WHITE: 0, BLACK: 0 }).expect(409);
      expect(res.body.code).toBe('SCORE_BELOW_GOALS');
    });

    it('placar inválido (negativo, quebrado, faltando time) → 400', async () => {
      const c = await setup();
      await putScore(c, c.adminUser.id, { WHITE: -1, BLACK: 0 }).expect(400);
      await putScore(c, c.adminUser.id, { WHITE: 1.5, BLACK: 0 }).expect(400);
      await putScore(c, c.adminUser.id, { WHITE: 1 }).expect(400);
    });
  });

  describe('POST /match/events', () => {
    it('jogador lança o próprio gol e a própria assistência (createdById = ele)', async () => {
      const c = await setup();
      const me = c.white[2]!;
      const goal = await postEvent(c, me.user.id, {
        membershipId: me.membership.id,
        type: 'GOAL',
      }).expect(201);
      expect(matchViewSchema.safeParse(goal.body).success).toBe(true);

      const res = await postEvent(c, me.user.id, {
        membershipId: me.membership.id,
        type: 'ASSIST',
      }).expect(201);
      expect(res.body.events).toHaveLength(2);

      const rows = await t.prisma.matchEvent.findMany({ where: { roundId: c.round.id } });
      expect(rows.map((r) => [r.membershipId, r.type, r.createdById])).toEqual(
        expect.arrayContaining([
          [me.membership.id, 'GOAL', me.membership.id],
          [me.membership.id, 'ASSIST', me.membership.id],
        ]),
      );
    });

    it('jogador lançando o de outro → 403 NOT_OWN_EVENT', async () => {
      const c = await setup();
      const res = await postEvent(c, c.white[0]!.user.id, {
        membershipId: c.white[1]!.membership.id,
        type: 'GOAL',
      }).expect(403);
      expect(res.body).toMatchObject({
        code: 'NOT_OWN_EVENT',
        message: MATCH_EVENT_ERROR_LABELS.NOT_OWN_EVENT,
      });
    });

    it('admin lança de qualquer um que jogou; createdById = admin', async () => {
      const c = await setup();
      await postEvent(c, c.adminUser.id, {
        membershipId: c.black[3]!.membership.id,
        type: 'GOAL',
      }).expect(201);
      const [row] = await t.prisma.matchEvent.findMany({ where: { roundId: c.round.id } });
      expect(row).toMatchObject({
        membershipId: c.black[3]!.membership.id,
        createdById: c.admin.id,
      });
    });

    it('quem não jogou, ou não é do grupo → 409 PLAYER_DID_NOT_PLAY', async () => {
      const c = await setup();
      const bench = await postEvent(c, c.adminUser.id, {
        membershipId: c.bench.id,
        type: 'GOAL',
      }).expect(409);
      expect(bench.body.code).toBe('PLAYER_DID_NOT_PLAY');

      const other = await createGroup(t);
      const foreignUser = await createUser(t);
      const foreign = await addMember(t, foreignUser.id, other.id);
      const res = await postEvent(c, c.adminUser.id, {
        membershipId: foreign.id,
        type: 'GOAL',
      }).expect(409);
      expect(res.body.code).toBe('PLAYER_DID_NOT_PLAY');
    });

    it('não passa do placar do time (GOALS_EXCEED_SCORE, ASSISTS_EXCEED_SCORE)', async () => {
      const c = await setup();
      await putScore(c, c.adminUser.id, { WHITE: 1, BLACK: 0 }).expect(200);
      const player = c.white[1]!.membership.id;
      await postEvent(c, c.adminUser.id, { membershipId: player, type: 'GOAL' }).expect(201);
      const goal = await postEvent(c, c.adminUser.id, {
        membershipId: player,
        type: 'GOAL',
      }).expect(409);
      expect(goal.body.code).toBe('GOALS_EXCEED_SCORE');

      await postEvent(c, c.adminUser.id, {
        membershipId: c.white[2]!.membership.id,
        type: 'ASSIST',
      }).expect(201);
      const assist = await postEvent(c, c.adminUser.id, {
        membershipId: c.white[3]!.membership.id,
        type: 'ASSIST',
      }).expect(409);
      expect(assist.body.code).toBe('ASSISTS_EXCEED_SCORE');
    });

    it('fora do jogo (antes ou depois) → 409 ROUND_NOT_OPEN', async () => {
      for (const status of ['TEAMS_PUBLISHED', 'CLOSED'] as const) {
        const c = await setup(status);
        const res = await postEvent(c, c.adminUser.id, {
          membershipId: c.white[1]!.membership.id,
          type: 'GOAL',
        }).expect(409);
        expect(res.body.code).toBe('ROUND_NOT_OPEN');
      }
    });

    it('gol contra e gol sofrido não são lances (OWN_GOAL → 400); corpo inválido → 400', async () => {
      const c = await setup();
      await postEvent(c, c.adminUser.id, {
        membershipId: c.white[1]!.membership.id,
        type: 'OWN_GOAL',
      }).expect(400);
      await postEvent(c, c.adminUser.id, { type: 'GOAL' }).expect(400);
      expect(await t.prisma.matchEvent.count()).toBe(0);
    });
  });

  describe('DELETE /match/events/:eventId', () => {
    async function withEvent() {
      const c = await setup();
      const owner = c.white[1]!;
      const event = await t.prisma.matchEvent.create({
        data: {
          roundId: c.round.id,
          membershipId: owner.membership.id,
          type: 'GOAL',
          createdById: c.admin.id,
        },
      });
      return { c, owner, event };
    }

    const del = (c: Ctx, userId: string, eventId: string) =>
      request(server())
        .delete(matchPath(c.group.id, c.round.id, `/events/${eventId}`))
        .set('Cookie', as(userId));

    it('o próprio jogador remove o seu lance (mesmo se o admin lançou)', async () => {
      const { c, owner, event } = await withEvent();
      const res = await del(c, owner.user.id, event.id).expect(200);
      expect(res.body.events).toEqual([]);
      expect(await t.prisma.matchEvent.count()).toBe(0);
    });

    it('admin remove o de qualquer um', async () => {
      const { c, event } = await withEvent();
      await del(c, c.adminUser.id, event.id).expect(200);
      expect(await t.prisma.matchEvent.count()).toBe(0);
    });

    it('jogador removendo o de outro → 403 NOT_OWN_EVENT', async () => {
      const { c, event } = await withEvent();
      const res = await del(c, c.white[0]!.user.id, event.id).expect(403);
      expect(res.body.code).toBe('NOT_OWN_EVENT');
      expect(await t.prisma.matchEvent.count()).toBe(1);
    });

    it('rodada encerrada congela: 409 ROUND_NOT_OPEN', async () => {
      const { c, event } = await withEvent();
      await t.prisma.round.update({ where: { id: c.round.id }, data: { status: 'CLOSED' } });
      const res = await del(c, c.adminUser.id, event.id).expect(409);
      expect(res.body.code).toBe('ROUND_NOT_OPEN');
    });

    it('lance inexistente ou de outra rodada → 404', async () => {
      const { c } = await withEvent();
      await del(c, c.adminUser.id, 'nao-existe').expect(404);

      const otherRound = await t.prisma.round.create({
        data: { groupId: c.group.id, scheduledAt: new Date(), status: 'IN_PROGRESS' },
      });
      const foreign = await t.prisma.matchEvent.create({
        data: {
          roundId: otherRound.id,
          membershipId: c.white[1]!.membership.id,
          type: 'GOAL',
          createdById: c.admin.id,
        },
      });
      await del(c, c.adminUser.id, foreign.id).expect(404);
    });
  });

  it('admin de outro grupo não mexe na rodada pela rota do grupo dele → 404, nada muda', async () => {
    const c = await setup();
    const event = await t.prisma.matchEvent.create({
      data: {
        roundId: c.round.id,
        membershipId: c.white[1]!.membership.id,
        type: 'GOAL',
        createdById: c.admin.id,
      },
    });
    const other = await createGroup(t);
    const otherAdmin = await createUser(t);
    await addMember(t, otherAdmin.id, other.id, { role: 'ADMIN' });
    const path = (rest: string) => matchPath(other.id, c.round.id, rest);
    const cookie = as(otherAdmin.id);

    await request(server())
      .patch(path('/status'))
      .set('Cookie', cookie)
      .send({ to: 'VOTING' })
      .expect(404);
    await request(server())
      .put(path('/score'))
      .set('Cookie', cookie)
      .send({ WHITE: 9, BLACK: 9 })
      .expect(404);
    await request(server())
      .post(path('/events'))
      .set('Cookie', cookie)
      .send({ membershipId: c.white[2]!.membership.id, type: 'GOAL' })
      .expect(404);
    await request(server())
      .delete(path(`/events/${event.id}`))
      .set('Cookie', cookie)
      .expect(404);

    const round = await t.prisma.round.findUniqueOrThrow({ where: { id: c.round.id } });
    expect(round).toMatchObject({ status: 'IN_PROGRESS', whiteGoals: null, blackGoals: null });
    expect(await t.prisma.matchEvent.count()).toBe(1);
  });
});
