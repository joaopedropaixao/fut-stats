import {
  MATCH_EVENT_ERROR_LABELS,
  matchViewSchema,
  ROUND_TRANSITION_ERROR_LABELS,
  SCORE_ENTRY_ERROR_LABELS,
} from '@fut-stats/shared';
import request from 'supertest';
import type { MatchEventType, Position, RoundStatus } from '../generated/prisma/enums';
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

  interface Person {
    user: { id: string };
    membership: { id: string };
  }

  /**
   * Grupo com admin (que não joga), 14 escalados (7 por time, todos confirmados), um membro que não jogou
   * e um membro inativo. `white[0]` e `black[0]` são os goleiros.
   */
  async function setup(status: RoundStatus = 'IN_PROGRESS') {
    const group = await createGroup(t);
    const adminUser = await createUser(t);
    const admin = await addMember(t, adminUser.id, group.id, { role: 'ADMIN' });
    const round = await t.prisma.round.create({
      data: { groupId: group.id, scheduledAt: new Date(), status },
    });

    const white: Person[] = [];
    const black: Person[] = [];
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
            photoUrl: `https://example.com/${team}${i}.png`,
            primaryPosition: position,
            secondaryPositions: [],
            initialRating: 6,
          },
        });
        await t.prisma.teamPlayer.create({
          data: { roundId: round.id, membershipId: membership.id, team, position },
        });
        await t.prisma.attendance.create({
          data: { roundId: round.id, membershipId: membership.id, confirmed: true },
        });
        list.push({ user, membership });
      }
    }
    const benchUser = await createUser(t);
    const bench = await addMember(t, benchUser.id, group.id);
    const inactiveUser = await createUser(t);
    await addMember(t, inactiveUser.id, group.id, { active: false });
    return { group, adminUser, admin, round, white, black, benchUser, bench, inactiveUser };
  }

  type Ctx = Awaited<ReturnType<typeof setup>>;

  const path = (c: Ctx, rest = '') => `/api/groups/${c.group.id}/rounds/${c.round.id}/match${rest}`;

  const get = (c: Ctx, userId: string) => request(server()).get(path(c)).set('Cookie', as(userId));
  const post = (c: Ctx, userId: string, rest: string, body?: object) =>
    request(server())
      .post(path(c, rest))
      .set('Cookie', as(userId))
      .send(body ?? {});
  const putScore = (c: Ctx, userId: string, body: object) =>
    request(server()).put(path(c, '/score')).set('Cookie', as(userId)).send(body);
  const postEvent = (c: Ctx, userId: string, membershipId: string, type: MatchEventType) =>
    post(c, userId, '/events', { membershipId, type });
  const delEvent = (c: Ctx, userId: string, eventId: string) =>
    request(server())
      .delete(path(c, `/events/${eventId}`))
      .set('Cookie', as(userId));

  const setScore = (c: Ctx, WHITE: number, BLACK: number) =>
    t.prisma.round.update({
      where: { id: c.round.id },
      data: { whiteGoals: WHITE, blackGoals: BLACK },
    });

  const addEvent = (c: Ctx, membershipId: string, type: MatchEventType, createdById?: string) =>
    t.prisma.matchEvent.create({
      data: { roundId: c.round.id, membershipId, type, createdById: createdById ?? c.admin.id },
    });

  const eventCount = (c: Ctx) => t.prisma.matchEvent.count({ where: { roundId: c.round.id } });
  const statusOf = async (c: Ctx) =>
    (await t.prisma.round.findUniqueOrThrow({ where: { id: c.round.id } })).status;

  const rule = (code: string, message: string) => ({ code, message });

  describe('GET /match', () => {
    it('C14: membro vê times, lances com o time que ganhou o lance, tally, me, permissions e canRemove', async () => {
      const c = await setup('POST_MATCH');
      await setScore(c, 3, 2);
      const goal = await addEvent(c, c.white[6]!.membership.id, 'GOAL');
      const assist = await addEvent(
        c,
        c.white[5]!.membership.id,
        'ASSIST',
        c.white[5]!.membership.id,
      );
      const ownGoal = await addEvent(c, c.black[1]!.membership.id, 'OWN_GOAL');

      const res = await get(c, c.white[5]!.user.id).expect(200);

      expect(matchViewSchema.safeParse(res.body).success).toBe(true);
      expect(res.body).toMatchObject({
        roundId: c.round.id,
        number: 1,
        scheduledAt: c.round.scheduledAt.toISOString(),
        status: 'POST_MATCH',
        score: { WHITE: 3, BLACK: 2 },
        tally: { goals: { WHITE: 2, BLACK: 0 }, assists: { WHITE: 1, BLACK: 0 } },
        me: {
          membershipId: c.white[5]!.membership.id,
          isAdmin: false,
          team: 'WHITE',
          result: 'WIN',
        },
        errors: [],
        permissions: {
          start: false,
          setScore: false,
          finish: false,
          openVoting: false,
          launchOwn: true,
          launchAny: false,
        },
      });
      expect(res.body.players).toHaveLength(14);
      expect(res.body.players[0]).toMatchObject({
        team: 'WHITE',
        position: 'GOALKEEPER',
        isReserve: false,
        photoUrl: expect.any(String),
      });
      expect(res.body.events).toEqual([
        expect.objectContaining({
          id: goal.id,
          type: 'GOAL',
          nickname: 'B6',
          playerTeam: 'WHITE',
          team: 'WHITE',
          createdByNickname: 'Apelido',
          canRemove: false,
        }),
        expect.objectContaining({
          id: assist.id,
          type: 'ASSIST',
          playerTeam: 'WHITE',
          team: 'WHITE',
          canRemove: true,
        }),
        // Gol contra do Preto: o anel é do Preto, mas o lance aparece na lista do Branco
        expect.objectContaining({
          id: ownGoal.id,
          type: 'OWN_GOAL',
          playerTeam: 'BLACK',
          team: 'WHITE',
          canRemove: false,
        }),
      ]);
    });

    it('C14: o admin vê as permissões de cada etapa e o que trava o próximo passo', async () => {
      const cases: [RoundStatus, Record<string, boolean>, string[]][] = [
        [
          'TEAMS_PUBLISHED',
          { start: true, setScore: false, finish: false, openVoting: false, launchAny: false },
          [],
        ],
        [
          'IN_PROGRESS',
          { start: false, setScore: true, finish: true, openVoting: false, launchAny: true },
          [],
        ],
        [
          'POST_MATCH',
          { start: false, setScore: true, finish: false, openVoting: true, launchAny: true },
          ['SCORE_MISSING'],
        ],
        [
          'VOTING',
          { start: false, setScore: false, finish: false, openVoting: false, launchAny: false },
          [],
        ],
      ];
      for (const [status, permissions, errors] of cases) {
        await resetDatabase(t.prisma);
        const c = await setup(status);
        const res = await get(c, c.adminUser.id).expect(200);
        expect(res.body.permissions).toMatchObject(permissions);
        expect(res.body.errors).toEqual(errors);
        expect(res.body.me).toMatchObject({ isAdmin: true, team: null, result: null });
      }
    });

    it('C14: em jogo o jogador não lança (launchOwn falso) e nenhum lance é dele para apagar', async () => {
      const c = await setup('IN_PROGRESS');
      await addEvent(c, c.white[6]!.membership.id, 'GOAL');

      const res = await get(c, c.white[6]!.user.id).expect(200);

      expect(res.body.permissions).toMatchObject({ launchOwn: false, launchAny: false });
      expect(res.body.events[0].canRemove).toBe(false);
      const admin = await get(c, c.adminUser.id).expect(200);
      expect(admin.body.events[0].canRemove).toBe(true);
    });

    it('C14: quem não jogou vê a rodada, sem time e sem poder lançar', async () => {
      const c = await setup('POST_MATCH');
      const res = await get(c, c.benchUser.id).expect(200);
      expect(res.body.me).toMatchObject({ team: null, result: null });
      expect(res.body.permissions.launchOwn).toBe(false);
    });

    it('C14: rodada sem times devolve jogadores vazios e tally zerado', async () => {
      const c = await setup('SCHEDULED');
      await t.prisma.teamPlayer.deleteMany({ where: { roundId: c.round.id } });
      const res = await get(c, c.adminUser.id).expect(200);
      expect(res.body.players).toEqual([]);
      expect(res.body.tally).toEqual({
        goals: { WHITE: 0, BLACK: 0 },
        assists: { WHITE: 0, BLACK: 0 },
      });
    });

    it('C28: me.result é WIN, LOSS ou null (não jogou) com a rodada em POST_MATCH', async () => {
      const c = await setup('POST_MATCH');
      await setScore(c, 3, 2);

      const win = await get(c, c.white[1]!.user.id).expect(200);
      const loss = await get(c, c.black[1]!.user.id).expect(200);
      const none = await get(c, c.benchUser.id).expect(200);

      expect(win.body.me).toMatchObject({ team: 'WHITE', result: 'WIN' });
      expect(loss.body.me).toMatchObject({ team: 'BLACK', result: 'LOSS' });
      expect(none.body.me).toMatchObject({ team: null, result: null });
    });

    it('C28: empate dá DRAW; sem placar ou antes do POST_MATCH, null', async () => {
      const c = await setup('POST_MATCH');
      await setScore(c, 2, 2);
      expect((await get(c, c.white[1]!.user.id)).body.me.result).toBe('DRAW');

      await t.prisma.round.update({
        where: { id: c.round.id },
        data: { status: 'IN_PROGRESS' },
      });
      expect((await get(c, c.white[1]!.user.id)).body.me.result).toBeNull();

      await t.prisma.round.update({
        where: { id: c.round.id },
        data: { status: 'POST_MATCH', whiteGoals: null, blackGoals: null },
      });
      expect((await get(c, c.white[1]!.user.id)).body.me.result).toBeNull();

      await t.prisma.round.update({
        where: { id: c.round.id },
        data: { status: 'VOTING', whiteGoals: 2, blackGoals: 1 },
      });
      expect((await get(c, c.white[1]!.user.id)).body.me.result).toBe('WIN');
    });
  });

  describe('POST /match/start', () => {
    it('C15: admin começa o jogo com os times válidos', async () => {
      const c = await setup('TEAMS_PUBLISHED');
      const res = await post(c, c.adminUser.id, '/start').expect(200);
      expect(res.body.status).toBe('IN_PROGRESS');
      expect(await statusOf(c)).toBe('IN_PROGRESS');
    });

    it('C16: confirmados diferentes dos escalados dão 409 ATTENDANCE_MISMATCH e o status não muda', async () => {
      const c = await setup('TEAMS_PUBLISHED');
      await t.prisma.attendance.update({
        where: {
          roundId_membershipId: { roundId: c.round.id, membershipId: c.white[1]!.membership.id },
        },
        data: { confirmed: false },
      });

      const res = await post(c, c.adminUser.id, '/start').expect(409);

      expect(res.body).toMatchObject(
        rule('ATTENDANCE_MISMATCH', ROUND_TRANSITION_ERROR_LABELS.ATTENDANCE_MISMATCH),
      );
      expect(await statusOf(c)).toBe('TEAMS_PUBLISHED');
    });
  });

  describe('em jogo (IN_PROGRESS)', () => {
    it('C17: admin lança o placar e lances de qualquer um, dos 3 tipos, como createdBy', async () => {
      const c = await setup();

      await putScore(c, c.adminUser.id, { WHITE: 3, BLACK: 2 }).expect(200);
      for (const [person, type] of [
        [c.white[6]!, 'GOAL'],
        [c.black[5]!, 'ASSIST'],
        [c.black[1]!, 'OWN_GOAL'],
      ] as const) {
        await postEvent(c, c.adminUser.id, person.membership.id, type).expect(200);
      }

      const round = await t.prisma.round.findUniqueOrThrow({ where: { id: c.round.id } });
      expect([round.whiteGoals, round.blackGoals]).toEqual([3, 2]);
      const events = await t.prisma.matchEvent.findMany({ where: { roundId: c.round.id } });
      expect(events).toHaveLength(3);
      expect(events.every((e) => e.createdById === c.admin.id)).toBe(true);
    });

    it('C17: a resposta já traz a rodada atualizada', async () => {
      const c = await setup();
      const res = await postEvent(c, c.adminUser.id, c.white[6]!.membership.id, 'GOAL').expect(200);
      expect(matchViewSchema.safeParse(res.body).success).toBe(true);
      expect(res.body.tally.goals).toEqual({ WHITE: 1, BLACK: 0 });
      expect(res.body.events).toHaveLength(1);
    });

    it('C18: jogador comum lançando o próprio gol leva 403 ADMIN_ONLY_IN_MATCH e nada é gravado', async () => {
      const c = await setup();
      const res = await postEvent(c, c.white[6]!.user.id, c.white[6]!.membership.id, 'GOAL').expect(
        403,
      );
      expect(res.body).toEqual(
        expect.objectContaining(
          rule('ADMIN_ONLY_IN_MATCH', MATCH_EVENT_ERROR_LABELS.ADMIN_ONLY_IN_MATCH),
        ),
      );
      expect(await eventCount(c)).toBe(0);
    });

    it('C18: jogador comum também não apaga o próprio lance durante o jogo', async () => {
      const c = await setup();
      const event = await addEvent(c, c.white[6]!.membership.id, 'GOAL');
      const res = await delEvent(c, c.white[6]!.user.id, event.id).expect(403);
      expect(res.body.code).toBe('ADMIN_ONLY_IN_MATCH');
      expect(await eventCount(c)).toBe(1);
    });

    it('C19: finish com o placar informado grava o placar e vai para POST_MATCH', async () => {
      const c = await setup();
      await addEvent(c, c.white[6]!.membership.id, 'GOAL');
      await addEvent(c, c.white[5]!.membership.id, 'GOAL');
      await addEvent(c, c.black[6]!.membership.id, 'GOAL');

      const res = await post(c, c.adminUser.id, '/finish', { WHITE: 3, BLACK: 1 }).expect(200);

      expect(res.body).toMatchObject({ status: 'POST_MATCH', score: { WHITE: 3, BLACK: 1 } });
      const round = await t.prisma.round.findUniqueOrThrow({ where: { id: c.round.id } });
      expect(round).toMatchObject({ status: 'POST_MATCH', whiteGoals: 3, blackGoals: 1 });
    });

    it('C20: finish abaixo dos gols lançados dá 409 SCORE_BELOW_GOALS e nada muda', async () => {
      const c = await setup();
      await addEvent(c, c.white[6]!.membership.id, 'GOAL');
      await addEvent(c, c.white[5]!.membership.id, 'GOAL');
      await addEvent(c, c.black[6]!.membership.id, 'GOAL');

      const res = await post(c, c.adminUser.id, '/finish', { WHITE: 1, BLACK: 1 }).expect(409);

      expect(res.body).toMatchObject(
        rule('SCORE_BELOW_GOALS', SCORE_ENTRY_ERROR_LABELS.SCORE_BELOW_GOALS),
      );
      const round = await t.prisma.round.findUniqueOrThrow({ where: { id: c.round.id } });
      expect(round).toMatchObject({ status: 'IN_PROGRESS', whiteGoals: null, blackGoals: null });
    });

    it('placar com corpo inválido leva 400, em PUT e em finish', async () => {
      const c = await setup();
      await putScore(c, c.adminUser.id, { WHITE: -1, BLACK: 0 }).expect(400);
      await post(c, c.adminUser.id, '/finish', { WHITE: 1.5, BLACK: 0 }).expect(400);
      await post(c, c.adminUser.id, '/finish', {}).expect(400);
      await postEvent(c, c.adminUser.id, c.white[1]!.membership.id, 'RED_CARD' as never).expect(
        400,
      );
    });

    it('C26: open-voting em IN_PROGRESS leva 409 INVALID_TRANSITION', async () => {
      const c = await setup('IN_PROGRESS');
      const res = await post(c, c.adminUser.id, '/open-voting').expect(409);
      expect(res.body).toMatchObject(
        rule('INVALID_TRANSITION', ROUND_TRANSITION_ERROR_LABELS.INVALID_TRANSITION),
      );
      expect(await statusOf(c)).toBe('IN_PROGRESS');
    });
  });

  describe('Resenha pós-jogo (POST_MATCH)', () => {
    it('C21: jogador lança e apaga os próprios lances, dos 3 tipos', async () => {
      const c = await setup('POST_MATCH');
      await setScore(c, 3, 2);
      const me = c.white[6]!;

      for (const type of ['GOAL', 'ASSIST', 'OWN_GOAL'] as const) {
        const res = await postEvent(c, me.user.id, me.membership.id, type).expect(200);
        expect(res.body.events.at(-1)).toMatchObject({ type, canRemove: true });
      }
      const events = await t.prisma.matchEvent.findMany({ where: { roundId: c.round.id } });
      expect(events.every((e) => e.createdById === me.membership.id)).toBe(true);

      for (const event of events) await delEvent(c, me.user.id, event.id).expect(200);
      expect(await eventCount(c)).toBe(0);
    });

    it('C21: lance de outro jogador leva 403 NOT_OWN_EVENT, ao lançar e ao apagar', async () => {
      const c = await setup('POST_MATCH');
      await setScore(c, 3, 2);
      const other = await addEvent(c, c.white[5]!.membership.id, 'GOAL');

      const launch = await postEvent(
        c,
        c.white[6]!.user.id,
        c.white[5]!.membership.id,
        'GOAL',
      ).expect(403);
      const remove = await delEvent(c, c.white[6]!.user.id, other.id).expect(403);

      for (const res of [launch, remove]) {
        expect(res.body).toMatchObject(
          rule('NOT_OWN_EVENT', MATCH_EVENT_ERROR_LABELS.NOT_OWN_EVENT),
        );
      }
      expect(await eventCount(c)).toBe(1);
    });

    it('C21: passar do placar leva 409 GOALS_EXCEED_SCORE / ASSISTS_EXCEED_SCORE', async () => {
      const c = await setup('POST_MATCH');
      await setScore(c, 1, 0);
      await addEvent(c, c.white[5]!.membership.id, 'GOAL');
      const me = c.white[6]!;

      const goal = await postEvent(c, me.user.id, me.membership.id, 'GOAL').expect(409);
      expect(goal.body).toMatchObject(
        rule('GOALS_EXCEED_SCORE', MATCH_EVENT_ERROR_LABELS.GOALS_EXCEED_SCORE),
      );

      await addEvent(c, c.white[4]!.membership.id, 'ASSIST');
      const assist = await postEvent(c, me.user.id, me.membership.id, 'ASSIST').expect(409);
      expect(assist.body).toMatchObject(
        rule('ASSISTS_EXCEED_SCORE', MATCH_EVENT_ERROR_LABELS.ASSISTS_EXCEED_SCORE),
      );
      expect(await eventCount(c)).toBe(2);
    });

    it('C21: gol contra do Branco passando do placar do Preto leva 409 GOALS_EXCEED_SCORE', async () => {
      const c = await setup('POST_MATCH');
      await setScore(c, 2, 1);
      await addEvent(c, c.black[6]!.membership.id, 'GOAL');
      const me = c.white[6]!;
      const res = await postEvent(c, me.user.id, me.membership.id, 'OWN_GOAL').expect(409);
      expect(res.body.code).toBe('GOALS_EXCEED_SCORE');
    });

    it('C21: quem não jogou leva 409 PLAYER_DID_NOT_PLAY, também com o membership de outro grupo', async () => {
      const c = await setup('POST_MATCH');
      const other = await setup('POST_MATCH');

      const bench = await postEvent(c, c.benchUser.id, c.bench.id, 'GOAL').expect(409);
      expect(bench.body).toMatchObject(
        rule('PLAYER_DID_NOT_PLAY', MATCH_EVENT_ERROR_LABELS.PLAYER_DID_NOT_PLAY),
      );
      const foreign = await postEvent(
        c,
        c.adminUser.id,
        other.white[1]!.membership.id,
        'GOAL',
      ).expect(409);
      expect(foreign.body.code).toBe('PLAYER_DID_NOT_PLAY');
      expect(await eventCount(c)).toBe(0);
      expect(await eventCount(other)).toBe(0);
    });

    it('admin corrige o placar e lança e apaga de qualquer um', async () => {
      const c = await setup('POST_MATCH');
      await putScore(c, c.adminUser.id, { WHITE: 4, BLACK: 4 }).expect(200);
      const res = await postEvent(c, c.adminUser.id, c.black[3]!.membership.id, 'GOAL').expect(200);
      await delEvent(c, c.adminUser.id, res.body.events[0].id).expect(200);
      expect(await eventCount(c)).toBe(0);
    });

    it('placar abaixo dos gols lançados na Resenha leva 409 SCORE_BELOW_GOALS', async () => {
      const c = await setup('POST_MATCH');
      await setScore(c, 1, 0);
      await addEvent(c, c.white[6]!.membership.id, 'GOAL');
      const res = await putScore(c, c.adminUser.id, { WHITE: 0, BLACK: 0 }).expect(409);
      expect(res.body.code).toBe('SCORE_BELOW_GOALS');
    });

    it('C22: open-voting com gols diferentes do placar leva 409 GOALS_MISMATCH e o status não muda', async () => {
      const c = await setup('POST_MATCH');
      await setScore(c, 3, 2);
      await addEvent(c, c.white[6]!.membership.id, 'GOAL');

      const res = await post(c, c.adminUser.id, '/open-voting').expect(409);

      expect(res.body).toMatchObject(
        rule('GOALS_MISMATCH', ROUND_TRANSITION_ERROR_LABELS.GOALS_MISMATCH),
      );
      const round = await t.prisma.round.findUniqueOrThrow({ where: { id: c.round.id } });
      expect(round.status).toBe('POST_MATCH');
      expect(round.votingOpenedAt).toBeNull();
    });

    it('C23: open-voting com gols batendo vai para VOTING e grava votingOpenedAt', async () => {
      const c = await setup('POST_MATCH');
      await setScore(c, 2, 1);
      await addEvent(c, c.white[6]!.membership.id, 'GOAL');
      await addEvent(c, c.black[1]!.membership.id, 'OWN_GOAL');
      await addEvent(c, c.black[6]!.membership.id, 'GOAL');
      const before = Date.now();

      const res = await post(c, c.adminUser.id, '/open-voting').expect(200);

      expect(res.body.status).toBe('VOTING');
      const round = await t.prisma.round.findUniqueOrThrow({ where: { id: c.round.id } });
      expect(round.status).toBe('VOTING');
      expect(round.votingOpenedAt).not.toBeNull();
      expect(round.votingOpenedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(round.votingOpenedAt!.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('congelado na votação', () => {
    it('C24: lance, apagar lance e placar levam 409 ROUND_NOT_OPEN em VOTING e CLOSED', async () => {
      for (const status of ['VOTING', 'CLOSED'] as const) {
        await resetDatabase(t.prisma);
        const c = await setup(status);
        await setScore(c, 1, 0);
        const event = await addEvent(c, c.white[6]!.membership.id, 'GOAL');

        const launch = await postEvent(c, c.adminUser.id, c.white[5]!.membership.id, 'GOAL').expect(
          409,
        );
        const remove = await delEvent(c, c.adminUser.id, event.id).expect(409);
        const score = await putScore(c, c.adminUser.id, { WHITE: 2, BLACK: 0 }).expect(409);

        expect(launch.body).toMatchObject(
          rule('ROUND_NOT_OPEN', MATCH_EVENT_ERROR_LABELS.ROUND_NOT_OPEN),
        );
        expect(remove.body.code).toBe('ROUND_NOT_OPEN');
        expect(score.body).toMatchObject(
          rule('ROUND_NOT_OPEN', SCORE_ENTRY_ERROR_LABELS.ROUND_NOT_OPEN),
        );
        expect(await eventCount(c)).toBe(1);
      }
    });
  });

  describe('permissões e etapas', () => {
    it('C25: jogador comum leva 403 em start, score, finish e open-voting', async () => {
      const c = await setup('TEAMS_PUBLISHED');
      const me = c.white[1]!.user.id;
      await post(c, me, '/start').expect(403);
      await putScore(c, me, { WHITE: 1, BLACK: 0 }).expect(403);
      await post(c, me, '/finish', { WHITE: 1, BLACK: 0 }).expect(403);
      await post(c, me, '/open-voting').expect(403);
      expect(await statusOf(c)).toBe('TEAMS_PUBLISHED');
    });

    it('C25: o placar de jogador comum devolve NOT_ADMIN e nada é gravado', async () => {
      const c = await setup('POST_MATCH');
      const res = await putScore(c, c.white[1]!.user.id, { WHITE: 1, BLACK: 0 }).expect(403);
      expect(res.body).toMatchObject(rule('NOT_ADMIN', SCORE_ENTRY_ERROR_LABELS.NOT_ADMIN));
      const round = await t.prisma.round.findUniqueOrThrow({ where: { id: c.round.id } });
      expect(round.whiteGoals).toBeNull();
    });

    it('C26: transição fora de ordem leva 409 INVALID_TRANSITION', async () => {
      const scheduled = await setup('SCHEDULED');
      const start = await post(scheduled, scheduled.adminUser.id, '/start').expect(409);
      expect(start.body).toMatchObject(
        rule('INVALID_TRANSITION', ROUND_TRANSITION_ERROR_LABELS.INVALID_TRANSITION),
      );

      const postMatch = await setup('POST_MATCH');
      await setScore(postMatch, 0, 0);
      const finish = await post(postMatch, postMatch.adminUser.id, '/finish', {
        WHITE: 1,
        BLACK: 0,
      }).expect(409);
      expect(finish.body.code).toBe('INVALID_TRANSITION');
      expect(await statusOf(postMatch)).toBe('POST_MATCH');

      const inGame = await setup('IN_PROGRESS');
      const open = await post(inGame, inGame.adminUser.id, '/open-voting').expect(409);
      expect(open.body.code).toBe('INVALID_TRANSITION');

      const voting = await setup('VOTING');
      const again = await post(voting, voting.adminUser.id, '/start').expect(409);
      expect(again.body.code).toBe('INVALID_TRANSITION');
    });
  });

  describe('isolamento entre grupos', () => {
    it('C27: outro grupo, não membro, inativo e lance de outra rodada levam 404 e nada muda', async () => {
      const c = await setup('POST_MATCH');
      await setScore(c, 1, 0);
      const event = await addEvent(c, c.white[6]!.membership.id, 'GOAL');
      const other = await setup('POST_MATCH');
      const otherEvent = await addEvent(other, other.white[6]!.membership.id, 'GOAL');

      // Admin de outro grupo, olhando a rodada deste pela URL do grupo dele
      const foreignAdmin = other.adminUser.id;
      const foreignPath = `/api/groups/${other.group.id}/rounds/${c.round.id}/match`;
      await request(server()).get(foreignPath).set('Cookie', as(foreignAdmin)).expect(404);
      await request(server())
        .post(`${foreignPath}/open-voting`)
        .set('Cookie', as(foreignAdmin))
        .expect(404);
      await request(server())
        .delete(`${foreignPath}/events/${event.id}`)
        .set('Cookie', as(foreignAdmin))
        .expect(404);

      // Admin de outro grupo na URL do grupo deste: não é membro
      await get(c, foreignAdmin).expect(404);
      await post(c, foreignAdmin, '/open-voting').expect(404);
      await putScore(c, foreignAdmin, { WHITE: 5, BLACK: 5 }).expect(404);
      await postEvent(c, foreignAdmin, c.white[5]!.membership.id, 'GOAL').expect(404);
      await delEvent(c, foreignAdmin, event.id).expect(404);

      // Membro inativo
      await get(c, c.inactiveUser.id).expect(404);
      await postEvent(c, c.inactiveUser.id, c.white[5]!.membership.id, 'GOAL').expect(404);

      // Lance de outra rodada (e de outro grupo) pela rota desta rodada
      await delEvent(c, c.adminUser.id, otherEvent.id).expect(404);

      const round = await t.prisma.round.findUniqueOrThrow({ where: { id: c.round.id } });
      expect(round).toMatchObject({ status: 'POST_MATCH', whiteGoals: 1, blackGoals: 0 });
      expect(await eventCount(c)).toBe(1);
      expect(await eventCount(other)).toBe(1);
    });

    it('C27: rodada que não existe leva 404', async () => {
      const c = await setup();
      await request(server())
        .get(`/api/groups/${c.group.id}/rounds/inexistente/match`)
        .set('Cookie', as(c.adminUser.id))
        .expect(404);
    });
  });

  it('sem login leva 401', async () => {
    const c = await setup();
    await request(server()).get(path(c)).expect(401);
  });
});
