import { historyDetailSchema, historyListSchema } from '@fut-stats/shared';
import request from 'supertest';
import type { MatchEventType, Position, RoundStatus, Team } from '../generated/prisma/enums';
import { addMember, createGroup, createUser, loginAs } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('histórico de rodadas e partidas', () => {
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

  async function setup() {
    const group = await createGroup(t);
    const user = await createUser(t);
    const member = await addMember(t, user.id, group.id);
    return { group, user, member, cookie: loginAs(t, user.id) };
  }

  function createRound(
    groupId: string,
    data: {
      status?: RoundStatus;
      daysAgo?: number;
      score?: [number, number];
      location?: string | null;
    } = {},
  ) {
    return t.prisma.round.create({
      data: {
        groupId,
        scheduledAt: new Date(Date.now() - (data.daysAgo ?? 1) * DAY_MS),
        location: data.location === undefined ? 'Arena' : data.location,
        status: data.status ?? 'CLOSED',
        whiteGoals: data.score?.[0] ?? null,
        blackGoals: data.score?.[1] ?? null,
      },
    });
  }

  async function lineup(
    groupId: string,
    roundId: string,
    team: Team,
    nickname: string,
    position: Position,
    isReserve = false,
  ) {
    const user = await createUser(t);
    const member = await addMember(t, user.id, groupId);
    await t.prisma.membership.update({ where: { id: member.id }, data: { nickname } });
    await t.prisma.teamPlayer.create({
      data: { roundId, membershipId: member.id, team, position, isReserve },
    });
    return member;
  }

  function event(roundId: string, membershipId: string, type: MatchEventType, by: string) {
    return t.prisma.matchEvent.create({
      data: { roundId, membershipId, type, createdById: by },
    });
  }

  const listPath = (groupId: string) => `/api/groups/${groupId}/history`;

  describe('GET /history (lista)', () => {
    it('lista só rodadas jogadas, mais recente primeiro, com placar e vencedor', async () => {
      const { group, cookie } = await setup();
      const old = await createRound(group.id, { daysAgo: 14, score: [3, 1] });
      const recent = await createRound(group.id, { daysAgo: 7, score: [2, 2], status: 'VOTING' });
      const live = await createRound(group.id, { daysAgo: 0, status: 'IN_PROGRESS' });
      const black = await createRound(group.id, { daysAgo: 10, score: [0, 1] });
      await createRound(group.id, { daysAgo: -3, status: 'SCHEDULED' });
      await createRound(group.id, { daysAgo: -1, status: 'TEAMS_PUBLISHED' });

      const res = await request(server()).get(listPath(group.id)).set('Cookie', cookie).expect(200);

      const body = historyListSchema.parse(res.body);
      expect(body.items.map((i) => i.roundId)).toEqual([live.id, recent.id, black.id, old.id]);
      expect(body.items.map((i) => i.winner)).toEqual([null, 'DRAW', 'BLACK', 'WHITE']);
      expect(body.items[0]).toMatchObject({ score: null, status: 'IN_PROGRESS' });
      expect(body.items[3]).toMatchObject({ score: { white: 3, black: 1 }, location: 'Arena' });
      expect(body.nextCursor).toBeNull();
    });

    it('rodada agendada que já tem placar também entra', async () => {
      const { group, cookie } = await setup();
      const round = await createRound(group.id, { status: 'SCHEDULED', score: [1, 0] });

      const res = await request(server()).get(listPath(group.id)).set('Cookie', cookie).expect(200);

      expect(historyListSchema.parse(res.body).items.map((i) => i.roundId)).toEqual([round.id]);
    });

    it('pagina com limit e nextCursor, sem repetir nem pular rodada', async () => {
      const { group, cookie } = await setup();
      const rounds = [];
      for (let days = 1; days <= 5; days++)
        rounds.push(await createRound(group.id, { daysAgo: days, score: [1, 0] }));

      const first = await request(server())
        .get(`${listPath(group.id)}?limit=2`)
        .set('Cookie', cookie)
        .expect(200);
      const page1 = historyListSchema.parse(first.body);
      expect(page1.items.map((i) => i.roundId)).toEqual([rounds[0]!.id, rounds[1]!.id]);
      expect(page1.nextCursor).not.toBeNull();

      const second = await request(server())
        .get(`${listPath(group.id)}?limit=2&cursor=${page1.nextCursor}`)
        .set('Cookie', cookie)
        .expect(200);
      const page2 = historyListSchema.parse(second.body);
      expect(page2.items.map((i) => i.roundId)).toEqual([rounds[2]!.id, rounds[3]!.id]);

      const third = await request(server())
        .get(`${listPath(group.id)}?limit=2&cursor=${page2.nextCursor}`)
        .set('Cookie', cookie)
        .expect(200);
      const page3 = historyListSchema.parse(third.body);
      expect(page3.items.map((i) => i.roundId)).toEqual([rounds[4]!.id]);
      expect(page3.nextCursor).toBeNull();
    });

    it('limit inválido é 400', async () => {
      const { group, cookie } = await setup();
      await request(server())
        .get(`${listPath(group.id)}?limit=0`)
        .set('Cookie', cookie)
        .expect(400);
      await request(server())
        .get(`${listPath(group.id)}?limit=999`)
        .set('Cookie', cookie)
        .expect(400);
    });

    it('não mostra rodadas de outro grupo', async () => {
      const { group, cookie } = await setup();
      const other = await createGroup(t);
      await createRound(other.id, { score: [1, 0] });

      const res = await request(server()).get(listPath(group.id)).set('Cookie', cookie).expect(200);

      expect(historyListSchema.parse(res.body).items).toEqual([]);
    });

    it('cursor de rodada de outro grupo não vaza dados', async () => {
      const { group, cookie } = await setup();
      const other = await createGroup(t);
      const foreign = await createRound(other.id, { score: [1, 0] });
      await createRound(group.id, { daysAgo: 3, score: [2, 0] });

      const res = await request(server())
        .get(`${listPath(group.id)}?cursor=${foreign.id}`)
        .set('Cookie', cookie);

      expect(res.status).toBeLessThan(500);
      const ids = (res.body.items ?? []).map((i: { roundId: string }) => i.roundId);
      expect(ids).not.toContain(foreign.id);
    });

    it('sem login é 401; quem não é do grupo é 404', async () => {
      const { group } = await setup();
      const stranger = await createUser(t);

      await request(server()).get(listPath(group.id)).expect(401);
      await request(server())
        .get(listPath(group.id))
        .set('Cookie', loginAs(t, stranger.id))
        .expect(404);
    });
  });

  describe('GET /history/:roundId (detalhe)', () => {
    it('devolve placar, os dois times (titulares por posição e reservas) e gols/assistências', async () => {
      const { group, member, cookie } = await setup();
      const round = await createRound(group.id, { score: [2, 1] });
      const wFwd = await lineup(group.id, round.id, 'WHITE', 'Artilheiro', 'FORWARD');
      const wGk = await lineup(group.id, round.id, 'WHITE', 'Paredão', 'GOALKEEPER');
      const wDef = await lineup(group.id, round.id, 'WHITE', 'Zagueirão', 'DEFENDER');
      await lineup(group.id, round.id, 'WHITE', 'Banco', 'MIDFIELDER', true);
      const bFwd = await lineup(group.id, round.id, 'BLACK', 'Matador', 'FORWARD');
      await lineup(group.id, round.id, 'BLACK', 'Goleiro', 'GOALKEEPER');
      await event(round.id, wFwd.id, 'GOAL', member.id);
      await event(round.id, wFwd.id, 'GOAL', member.id);
      await event(round.id, wDef.id, 'ASSIST', member.id);
      await event(round.id, wGk.id, 'ASSIST', member.id);
      await event(round.id, bFwd.id, 'GOAL', member.id);

      const res = await request(server())
        .get(`${listPath(group.id)}/${round.id}`)
        .set('Cookie', cookie)
        .expect(200);

      const body = historyDetailSchema.parse(res.body);
      expect(body).toMatchObject({
        roundId: round.id,
        winner: 'WHITE',
        score: { white: 2, black: 1 },
      });
      expect(body.teams.WHITE.starters.map((p) => p.nickname)).toEqual([
        'Paredão',
        'Zagueirão',
        'Artilheiro',
      ]);
      expect(body.teams.WHITE.starters.find((p) => p.nickname === 'Artilheiro')).toMatchObject({
        goals: 2,
        assists: 0,
        position: 'FORWARD',
      });
      expect(body.teams.WHITE.starters.find((p) => p.nickname === 'Zagueirão')).toMatchObject({
        goals: 0,
        assists: 1,
      });
      expect(body.teams.WHITE.reserves.map((p) => p.nickname)).toEqual(['Banco']);
      expect(body.teams.BLACK.starters).toHaveLength(2);
      expect(body.teams.BLACK.reserves).toEqual([]);
    });

    it('rodada sem escalação volta com times vazios', async () => {
      const { group, cookie } = await setup();
      const round = await createRound(group.id, { status: 'IN_PROGRESS' });

      const res = await request(server())
        .get(`${listPath(group.id)}/${round.id}`)
        .set('Cookie', cookie)
        .expect(200);

      const body = historyDetailSchema.parse(res.body);
      expect(body.score).toBeNull();
      expect(body.teams.WHITE).toEqual({ starters: [], reserves: [] });
    });

    it('rodada que não foi jogada, de outro grupo ou inexistente é 404', async () => {
      const { group, cookie } = await setup();
      const other = await createGroup(t);
      const foreign = await createRound(other.id, { score: [1, 0] });
      const future = await createRound(group.id, { status: 'SCHEDULED', daysAgo: -2 });

      for (const id of [future.id, foreign.id, 'nao-existe']) {
        await request(server())
          .get(`${listPath(group.id)}/${id}`)
          .set('Cookie', cookie)
          .expect(404);
      }
    });

    it('quem não é do grupo é 404', async () => {
      const { group } = await setup();
      const round = await createRound(group.id, { score: [1, 0] });
      const stranger = await createUser(t);

      await request(server())
        .get(`${listPath(group.id)}/${round.id}`)
        .set('Cookie', loginAs(t, stranger.id))
        .expect(404);
    });
  });
});
