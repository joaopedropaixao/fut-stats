import { roundResults, type RoundVote } from '@fut-stats/domain';
import {
  BALLOT_ERROR_LABELS,
  historyListSchema,
  RATING_SHEET_ERROR_LABELS,
  roundListSchema,
  roundResultSchema,
  SCORE_ENTRY_ERROR_LABELS,
  ROUND_TRANSITION_ERROR_LABELS,
  VOTING_ERROR_LABELS,
  votingViewSchema,
  type VotingView,
} from '@fut-stats/shared';
import request from 'supertest';
import type { MatchEventType, Position, RoundStatus, Team } from '../generated/prisma/enums';
import { RoundsService } from '../rounds/rounds.service';
import { addMember, createGroup, createUser, loginAs } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';
import { VotingCloser } from './voting-closer';
import { VotingService } from './voting.service';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const ROSTER = [
  { key: 'w1', nickname: 'Alfa', team: 'WHITE', position: 'GOALKEEPER', isReserve: false },
  { key: 'w2', nickname: 'Bruno', team: 'WHITE', position: 'DEFENDER', isReserve: false },
  { key: 'w3', nickname: 'Caio', team: 'WHITE', position: 'FORWARD', isReserve: false },
  { key: 'w4', nickname: 'Davi', team: 'WHITE', position: 'MIDFIELDER', isReserve: true },
  { key: 'b1', nickname: 'Edu', team: 'BLACK', position: 'GOALKEEPER', isReserve: false },
  { key: 'b2', nickname: 'Fabio', team: 'BLACK', position: 'DEFENDER', isReserve: false },
  { key: 'b3', nickname: 'Gui', team: 'BLACK', position: 'FORWARD', isReserve: false },
  { key: 'b4', nickname: 'Hugo', team: 'BLACK', position: 'MIDFIELDER', isReserve: true },
] as const satisfies readonly {
  key: string;
  nickname: string;
  team: Team;
  position: Position;
  isReserve: boolean;
}[];

type Key = (typeof ROSTER)[number]['key'];
const KEYS = ROSTER.map((p) => p.key);

describe('votação e resultado', () => {
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

  interface Person {
    userId: string;
    membershipId: string;
    cookie: string;
  }

  /**
   * Grupo com 8 que jogaram (o Alfa, goleiro do Branco, é admin; cada time tem um reserva), mais um "Banco"
   * que não jogou e um ex-membro inativo. A rodada nasce em `VOTING`, aberta há `openedAgoMs`.
   */
  async function setup(
    opts: {
      status?: RoundStatus;
      openedAgoMs?: number;
      score?: { WHITE: number; BLACK: number };
    } = {},
  ) {
    const { status = 'VOTING', openedAgoMs = 1 * HOUR_MS, score = { WHITE: 0, BLACK: 0 } } = opts;
    const group = await createGroup(t);
    const people = {} as Record<Key | 'bench', Person>;
    const add = async (key: Key | 'bench', nickname: string, admin = false) => {
      const user = await createUser(t);
      const member = await addMember(t, user.id, group.id, {
        nickname,
        role: admin ? 'ADMIN' : 'PLAYER',
      });
      people[key] = { userId: user.id, membershipId: member.id, cookie: loginAs(t, user.id) };
    };
    for (const p of ROSTER) await add(p.key, p.nickname, p.key === 'w1');
    await add('bench', 'Banco');

    const round = await t.prisma.round.create({
      data: {
        groupId: group.id,
        scheduledAt: new Date(Date.now() - 2 * DAY_MS),
        status,
        whiteGoals: score.WHITE,
        blackGoals: score.BLACK,
        votingOpenedAt: status === 'VOTING' ? new Date(Date.now() - openedAgoMs) : null,
        teamPlayers: {
          create: ROSTER.map((p) => ({
            membershipId: people[p.key].membershipId,
            team: p.team,
            position: p.position,
            isReserve: p.isReserve,
          })),
        },
      },
    });
    return { group, round, people };
  }

  type Ctx = Awaited<ReturnType<typeof setup>>;

  const base = (c: Ctx) => `/api/groups/${c.group.id}/rounds/${c.round.id}/voting`;
  const get = (c: Ctx, who: Person, rest = '') =>
    request(server())
      .get(base(c) + rest)
      .set('Cookie', who.cookie);
  const put = (c: Ctx, who: Person, body: object) =>
    request(server())
      .put(`${base(c)}/vote`)
      .set('Cookie', who.cookie)
      .send(body);
  const closeReq = (c: Ctx, who: Person) =>
    request(server())
      .post(`${base(c)}/close`)
      .set('Cookie', who.cookie)
      .send({});

  /** O pacote de quem vota: nota para todos os outros (6 por padrão; `values` muda alvos), Craque e Perna de Pau. */
  function ballot(
    c: Ctx,
    voter: Key,
    {
      mvp = 'w3',
      flop = 'b2',
      values = {},
    }: { mvp?: Key; flop?: Key; values?: Partial<Record<Key, number>> } = {},
  ) {
    return {
      ratings: KEYS.filter((k) => k !== voter).map((k) => ({
        targetId: c.people[k].membershipId,
        value: values[k] ?? 6,
      })),
      mvpId: c.people[mvp].membershipId,
      flopId: c.people[flop].membershipId,
    };
  }

  /** Quem vota não pode ser o próprio Craque ou Perna de Pau: troca por outros dois. */
  function ballotFor(c: Ctx, voter: Key, opts: Parameters<typeof ballot>[2] = {}) {
    const mvp = opts.mvp ?? (voter === 'w3' ? 'w2' : 'w3');
    const flop = opts.flop ?? (voter === 'b2' ? 'b1' : 'b2');
    return ballot(c, voter, { ...opts, mvp, flop });
  }

  async function vote(c: Ctx, voter: Key, opts: Parameters<typeof ballot>[2] = {}) {
    return put(c, c.people[voter], ballotFor(c, voter, opts)).expect(200);
  }

  const roundOf = (c: Ctx) => t.prisma.round.findUniqueOrThrow({ where: { id: c.round.id } });
  const voteCount = (c: Ctx) => t.prisma.vote.count({ where: { roundId: c.round.id } });

  describe('GET /voting', () => {
    it('C10: devolve a votação com quem jogou (meu time primeiro), progresso, prazo de 24 h e permissões', async () => {
      const c = await setup({ openedAgoMs: 2 * HOUR_MS });
      const before = Date.now();
      const res = await get(c, c.people.b3).expect(200);
      const view = res.body as VotingView;

      expect(votingViewSchema.safeParse(view).success).toBe(true);
      expect(view).toMatchObject({
        roundId: c.round.id,
        status: 'VOTING',
        closedAt: null,
        closeReason: null,
        progress: { voted: 0, total: 8 },
        pending: null,
        me: { membershipId: c.people.b3.membershipId, isAdmin: false, played: true, vote: null },
        permissions: { vote: true, close: false },
      });
      const round = await roundOf(c);
      expect(view.openedAt).toBe(round.votingOpenedAt!.toISOString());
      expect(new Date(view.deadline!).getTime() - new Date(view.openedAt!).getTime()).toBe(
        24 * HOUR_MS,
      );
      expect(new Date(view.serverTime).getTime()).toBeGreaterThanOrEqual(before - 1000);

      // Meu time (Preto) primeiro; titulares do goleiro ao atacante, depois o reserva
      expect(view.players.map((p) => p.nickname)).toEqual([
        'Edu',
        'Fabio',
        'Gui',
        'Hugo',
        'Alfa',
        'Bruno',
        'Caio',
        'Davi',
      ]);
      expect(view.players[0]).toMatchObject({
        team: 'BLACK',
        position: 'GOALKEEPER',
        isReserve: false,
      });
      expect(view.players[3]).toMatchObject({ team: 'BLACK', isReserve: true });
      expect(view.players[0]!.avatar).toEqual({
        skin: expect.any(String),
        hair: expect.any(String),
        hairColor: expect.any(String),
      });
    });

    it('C14: quem não jogou vê a votação, sem poder votar', async () => {
      const c = await setup();
      const res = await get(c, c.people.bench).expect(200);
      expect(res.body).toMatchObject({
        me: { played: false, vote: null },
        permissions: { vote: false, close: false },
        progress: { voted: 0, total: 8 },
      });
      // Sem time: a ordem é a do Branco primeiro
      expect(res.body.players[0].nickname).toBe('Alfa');
    });

    it('C15: antes da votação o GET responde com o status e sem permissão de votar', async () => {
      for (const status of ['SCHEDULED', 'TEAMS_PUBLISHED', 'IN_PROGRESS', 'POST_MATCH'] as const) {
        await resetDatabase(t.prisma);
        const c = await setup({ status });
        const res = await get(c, c.people.w2).expect(200);
        expect(res.body).toMatchObject({
          status,
          openedAt: null,
          deadline: null,
          permissions: { vote: false, close: false },
        });
        await put(c, c.people.w2, ballotFor(c, 'w2'))
          .expect(409)
          .expect(({ body }) =>
            expect(body).toMatchObject({
              code: 'VOTING_NOT_OPEN',
              message: VOTING_ERROR_LABELS.VOTING_NOT_OPEN,
            }),
          );
        expect(await voteCount(c)).toBe(0);
      }
    });

    it('C20: nunca traz voto de outra pessoa; o admin vê quem falta, o jogador vê só a contagem', async () => {
      const c = await setup();
      await vote(c, 'w2');
      await vote(c, 'b3');

      const player = (await get(c, c.people.w3).expect(200)).body as VotingView;
      expect(player.pending).toBeNull();
      expect(player.me.vote).toBeNull();
      expect(player.progress).toEqual({ voted: 2, total: 8 });
      // Nenhum pacote (notas, Craque, Perna de Pau) de ninguém aparece na resposta de quem não votou
      expect(JSON.stringify(player)).not.toMatch(/ratings|mvpId|flopId/);

      const admin = (await get(c, c.people.w1).expect(200)).body as VotingView;
      expect(admin.pending!.map((p) => p.nickname).sort()).toEqual(
        ['Alfa', 'Caio', 'Davi', 'Edu', 'Fabio', 'Hugo'].sort(),
      );
      expect(admin.pending![0]).toMatchObject({ membershipId: expect.any(String), avatar: {} });
      // O admin também não vê o voto dos outros
      expect(admin.me.vote).toBeNull();
      expect(JSON.stringify(admin)).not.toMatch(/mvpId|flopId/);

      // Quem votou vê só o próprio pacote
      const mine = (await get(c, c.people.w2).expect(200)).body as VotingView;
      expect(mine.me.vote).toMatchObject({
        mvpId: c.people.w3.membershipId,
        flopId: c.people.b2.membershipId,
      });
      expect(mine.me.vote!.ratings).toHaveLength(7);
    });
  });

  describe('PUT /voting/vote', () => {
    it('C11: o pacote entra, volta em me.vote e o progresso sobe 1', async () => {
      const c = await setup();
      const body = ballotFor(c, 'w2', { values: { w3: 9, b2: 2.5 } });
      const res = await put(c, c.people.w2, body).expect(200);
      const view = res.body as VotingView;

      expect(votingViewSchema.safeParse(view).success).toBe(true);
      expect(view.progress).toEqual({ voted: 1, total: 8 });
      expect(view.me.vote).toMatchObject({ mvpId: body.mvpId, flopId: body.flopId });
      const sorted = (r: { targetId: string }[]) =>
        [...r].sort((a, b) => a.targetId.localeCompare(b.targetId));
      expect(sorted(view.me.vote!.ratings)).toEqual(sorted(body.ratings));
      expect(view.me.vote!.updatedAt).toEqual(expect.any(String));
      expect(view.status).toBe('VOTING');
      expect(view.permissions.vote).toBe(true);
      expect(await voteCount(c)).toBe(1);
    });

    it('C12: votar de novo substitui o pacote: continua 1 voto e nenhuma nota antiga sobra', async () => {
      const c = await setup();
      await vote(c, 'w2', { mvp: 'w3', flop: 'b2', values: { w3: 9, b2: 2 } });
      const second = ballotFor(c, 'w2', { mvp: 'b3', flop: 'b4', values: { b3: 10, b4: 1 } });
      const res = await put(c, c.people.w2, second).expect(200);

      expect(res.body.progress.voted).toBe(1);
      expect(res.body.me.vote).toMatchObject({ mvpId: second.mvpId, flopId: second.flopId });
      expect(await voteCount(c)).toBe(1);

      const saved = await t.prisma.vote.findFirstOrThrow({
        where: { roundId: c.round.id },
        include: { ratings: true },
      });
      expect(saved.mvpId).toBe(c.people.b3.membershipId);
      expect(saved.ratings).toHaveLength(7);
      const byTarget = new Map(saved.ratings.map((r) => [r.targetId, r.value]));
      expect(byTarget.get(c.people.w3.membershipId)).toBe(6);
      expect(byTarget.get(c.people.b3.membershipId)).toBe(10);
      expect(byTarget.get(c.people.b4.membershipId)).toBe(1);
      expect(await t.prisma.rating.count()).toBe(7);
    });

    it('C13: pacote inválido leva 400 com o code do domain, o texto e a lista; nada é gravado', async () => {
      const c = await setup();
      const good = ballotFor(c, 'w2');
      const outsider = c.people.bench.membershipId;
      const cases: [string, object, keyof typeof RATING_SHEET_ERROR_LABELS][] = [
        ['faltando uma nota', { ...good, ratings: good.ratings.slice(1) }, 'MISSING_RATING'],
        [
          'nota para si',
          {
            ...good,
            ratings: [...good.ratings, { targetId: c.people.w2.membershipId, value: 6 }],
          },
          'SELF_VOTE',
        ],
        [
          'nota 7,3',
          {
            ...good,
            ratings: good.ratings.map((r, i) => (i === 0 ? { ...r, value: 7.3 } : r)),
          },
          'INVALID_STEP',
        ],
        [
          'nota fora da faixa',
          {
            ...good,
            ratings: good.ratings.map((r, i) => (i === 0 ? { ...r, value: 11 } : r)),
          },
          'OUT_OF_RANGE',
        ],
        [
          'alvo que não jogou',
          { ...good, ratings: [{ targetId: outsider, value: 6 }, ...good.ratings] },
          'TARGET_DID_NOT_PLAY',
        ],
        [
          'alvo repetido',
          { ...good, ratings: [...good.ratings, { ...good.ratings[0]! }] },
          'DUPLICATE_TARGET',
        ],
      ];
      for (const [label, body, code] of cases) {
        const res = await put(c, c.people.w2, body).expect(400);
        expect(res.body).toMatchObject({
          code,
          message: RATING_SHEET_ERROR_LABELS[code],
          issues: expect.arrayContaining([expect.objectContaining({ code })]),
        });
        expect(res.body.issues[0]).toEqual({
          path: expect.any(String),
          code,
          message: RATING_SHEET_ERROR_LABELS[code],
        });
        expect([label, await voteCount(c)]).toEqual([label, 0]);
      }

      // Craque = Perna de Pau
      const same = await put(c, c.people.w2, { ...good, flopId: good.mvpId }).expect(400);
      expect(same.body).toMatchObject({
        code: 'SAME_PLAYER_BOTH',
        message: BALLOT_ERROR_LABELS.SAME_PLAYER_BOTH,
      });
      // Craque que não jogou e votar em si
      const out = await put(c, c.people.w2, { ...good, mvpId: outsider }).expect(400);
      expect(out.body.code).toBe('TARGET_DID_NOT_PLAY');
      const self = await put(c, c.people.w2, { ...good, mvpId: c.people.w2.membershipId }).expect(
        400,
      );
      expect(self.body.code).toBe('SELF_VOTE');
      // Vários problemas ao mesmo tempo vêm todos em issues
      const many = await put(c, c.people.w2, {
        ...good,
        ratings: good.ratings.slice(2),
        flopId: good.mvpId,
      }).expect(400);
      expect(many.body.issues.map((i: { code: string }) => i.code)).toEqual([
        'MISSING_RATING',
        'MISSING_RATING',
        'SAME_PLAYER_BOTH',
      ]);
      expect(await voteCount(c)).toBe(0);
    });

    it('C13: corpo com formato errado leva 400 de validação', async () => {
      const c = await setup();
      await put(c, c.people.w2, { ratings: 'x', mvpId: 1 }).expect(400);
      await put(c, c.people.w2, {}).expect(400);
      expect(await voteCount(c)).toBe(0);
    });

    it('C14: membro que não jogou leva 403 VOTER_DID_NOT_PLAY', async () => {
      const c = await setup();
      const res = await put(c, c.people.bench, ballotFor(c, 'w2')).expect(403);
      expect(res.body).toMatchObject({
        code: 'VOTER_DID_NOT_PLAY',
        message: BALLOT_ERROR_LABELS.VOTER_DID_NOT_PLAY,
      });
      expect(await voteCount(c)).toBe(0);
    });

    it('C16: prazo vencido recusa o voto, não grava nada e a rodada passa a CLOSED', async () => {
      const c = await setup({ openedAgoMs: 25 * HOUR_MS });
      const res = await put(c, c.people.w2, ballotFor(c, 'w2')).expect(409);
      expect(res.body).toMatchObject({
        code: 'VOTING_CLOSED',
        message: VOTING_ERROR_LABELS.VOTING_CLOSED,
      });
      expect(await voteCount(c)).toBe(0);
      expect(await roundOf(c)).toMatchObject({
        status: 'CLOSED',
        votingEndReason: 'DEADLINE_PASSED',
      });
    });

    it('C17: o último que faltava vota e a rodada fecha ALL_VOTED, com o resultado gravado', async () => {
      const c = await setup();
      for (const key of KEYS.slice(0, 7)) await vote(c, key);
      expect((await roundOf(c)).status).toBe('VOTING');

      const res = await vote(c, 'b4');
      const view = res.body as VotingView;
      expect(view).toMatchObject({
        status: 'CLOSED',
        closeReason: 'ALL_VOTED',
        permissions: { vote: false, close: false },
        progress: { voted: 8, total: 8 },
      });
      expect(view.closedAt).toEqual(expect.any(String));

      const players = await t.prisma.teamPlayer.findMany({ where: { roundId: c.round.id } });
      const byId = new Map(players.map((p) => [p.membershipId, p]));
      // 8 votos: w3 foi Craque de todos que podiam (7) e de w3 em si, w2; b2 Perna de Pau
      expect(byId.get(c.people.w3.membershipId)).toMatchObject({
        isMvp: true,
        isFlop: false,
        roundScore: 6,
        ratingsCount: 7,
      });
      expect(byId.get(c.people.b2.membershipId)).toMatchObject({ isFlop: true, isMvp: false });
      expect(players.filter((p) => p.isMvp)).toHaveLength(1);
    });

    it('C17: quem jogou e foi desativado não segura a votação, mas recebe nota', async () => {
      const c = await setup();
      await t.prisma.membership.update({
        where: { id: c.people.b4.membershipId },
        data: { active: false },
      });
      for (const key of KEYS.slice(0, 6)) await vote(c, key);
      expect((await roundOf(c)).status).toBe('VOTING');
      const view = (await get(c, c.people.w1).expect(200)).body as VotingView;
      expect(view.progress).toEqual({ voted: 6, total: 7 });
      // O inativo continua na lista de quem recebe nota
      expect(view.players).toHaveLength(8);
      expect(view.pending!.map((p) => p.nickname)).toEqual(['Gui']);

      const last = await vote(c, 'b3');
      expect(last.body).toMatchObject({ status: 'CLOSED', closeReason: 'ALL_VOTED' });
      const hugo = await t.prisma.teamPlayer.findFirstOrThrow({
        where: { roundId: c.round.id, membershipId: c.people.b4.membershipId },
      });
      expect(hugo.ratingsCount).toBe(7);
      expect(hugo.roundScore).toBe(6);
    });

    it('C18: dois PUT do mesmo votante ao mesmo tempo: os dois 200 e um voto só', async () => {
      const c = await setup();
      const a = ballotFor(c, 'w2', { mvp: 'w3', flop: 'b2', values: { w3: 9 } });
      const b = ballotFor(c, 'w2', { mvp: 'b3', flop: 'b4', values: { b3: 10 } });
      const results = await Promise.all([
        put(c, c.people.w2, a),
        put(c, c.people.w2, b),
        put(c, c.people.w2, a),
      ]);
      expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
      expect(await voteCount(c)).toBe(1);
      expect(await t.prisma.rating.count()).toBe(7);
      const saved = await t.prisma.vote.findFirstOrThrow({ where: { roundId: c.round.id } });
      expect([a.mvpId, b.mvpId]).toContain(saved.mvpId);
    });

    it('C19: o último voto e o close do admin ao mesmo tempo: fecha uma vez só, o outro leva 409', async () => {
      const c = await setup();
      for (const key of KEYS.filter((k) => k !== 'b4')) await vote(c, key);
      // 7 votaram; falta o Hugo. Ele vota e o admin encerra no mesmo instante.
      const [voted, closed] = await Promise.all([
        put(c, c.people.b4, ballotFor(c, 'b4')),
        closeReq(c, c.people.w1),
      ]);
      expect([voted.status, closed.status].sort()).toEqual([200, 409]);
      const round = await roundOf(c);
      expect(round.status).toBe('CLOSED');
      expect(['ALL_VOTED', 'ADMIN_CLOSED']).toContain(round.votingEndReason);
      expect(round.closedAt).not.toBeNull();
      // O perdedor leva o código certo e o resultado foi gravado uma vez
      const loser = voted.status === 409 ? voted : closed;
      expect(['VOTING_CLOSED', 'INVALID_TRANSITION']).toContain(loser.body.code);
      expect(
        await t.prisma.teamPlayer.count({ where: { roundId: c.round.id, roundScore: 6 } }),
      ).toBe(8);
    });
  });

  describe('POST /voting/close e GET /voting/result', () => {
    const scored = { w3: 9, b2: 3, w2: 7, b3: 7 } as const;

    /** Cinco votos (nenhum do Craque, do Perna de Pau nem do Gui) e a votação encerrada pelo admin. */
    async function closedWithVotes() {
      const c = await setup({ score: { WHITE: 2, BLACK: 1 } });
      const event = (key: Key, type: MatchEventType) =>
        t.prisma.matchEvent.create({
          data: {
            roundId: c.round.id,
            membershipId: c.people[key].membershipId,
            type,
            createdById: c.people.w1.membershipId,
          },
        });
      await event('w3', 'GOAL');
      await event('b2', 'OWN_GOAL');
      await event('b3', 'GOAL');
      await event('w2', 'ASSIST');
      for (const key of ['w1', 'w2', 'b1', 'b4', 'w4'] as const) {
        await vote(c, key, { mvp: 'w3', flop: 'b2', values: scored });
      }
      const res = await closeReq(c, c.people.w1).expect(200);
      return { c, res };
    }

    it('C21: o admin encerra: CLOSED, ADMIN_CLOSED e o resultado de cada um igual ao roundResults', async () => {
      const c = await setup();
      const voters = ['w1', 'w2', 'w4', 'b1', 'b3', 'b4'] as const;
      const w3Ratings = [9, 8, 10, 4, 8, 9];
      for (const [i, key] of voters.entries()) {
        await vote(c, key, { mvp: 'w3', flop: 'b2', values: { w3: w3Ratings[i]! } });
      }
      const res = await closeReq(c, c.people.w1).expect(200);

      expect(votingViewSchema.safeParse(res.body).success).toBe(true);
      expect(res.body).toMatchObject({
        status: 'CLOSED',
        closeReason: 'ADMIN_CLOSED',
        permissions: { vote: false, close: false },
      });
      expect(res.body.closedAt).toEqual(expect.any(String));
      const round = await roundOf(c);
      expect(round.votingEndReason).toBe('ADMIN_CLOSED');
      expect(round.closedAt!.toISOString()).toBe(res.body.closedAt);

      const votes = await t.prisma.vote.findMany({
        where: { roundId: c.round.id },
        include: { ratings: true },
      });
      const roundVotes: RoundVote[] = votes.map((v) => ({
        voterId: v.voterId,
        mvpId: v.mvpId,
        flopId: v.flopId,
        ratings: v.ratings.map((r) => ({ targetId: r.targetId, value: r.value })),
      }));
      const players = await t.prisma.teamPlayer.findMany({ where: { roundId: c.round.id } });
      const expected = roundResults(
        roundVotes,
        players.map((p) => p.membershipId),
      );
      expect(expected.ok).toBe(true);
      if (!expected.ok) return;
      for (const p of players) {
        expect({
          roundScore: p.roundScore,
          ratingsCount: p.ratingsCount,
          isMvp: expected.value.mvpIds.includes(p.membershipId),
          isFlop: expected.value.flopIds.includes(p.membershipId),
        }).toEqual({
          roundScore: expected.value.players[p.membershipId]!.score,
          ratingsCount: expected.value.players[p.membershipId]!.ratingsCount,
          isMvp: p.isMvp,
          isFlop: p.isFlop,
        });
      }
      // Média aparada das 6 notas do Caio (4, 8, 8, 9, 9, 10): 8,5
      const caio = players.find((p) => p.membershipId === c.people.w3.membershipId)!;
      expect(caio).toMatchObject({ roundScore: 8.5, ratingsCount: 6, isMvp: true, isFlop: false });
    });

    it('C22: jogador comum leva 403 NOT_ADMIN e a votação segue aberta', async () => {
      const c = await setup();
      const res = await closeReq(c, c.people.w2).expect(403);
      expect(res.body).toMatchObject({
        code: 'NOT_ADMIN',
        message: SCORE_ENTRY_ERROR_LABELS.NOT_ADMIN,
      });
      expect((await roundOf(c)).status).toBe('VOTING');
    });

    it('C23: fora de VOTING o close leva 409 INVALID_TRANSITION', async () => {
      for (const status of ['SCHEDULED', 'POST_MATCH', 'CLOSED'] as const) {
        await resetDatabase(t.prisma);
        const c = await setup({ status });
        const res = await closeReq(c, c.people.w1).expect(409);
        expect(res.body).toMatchObject({
          code: 'INVALID_TRANSITION',
          message: ROUND_TRANSITION_ERROR_LABELS.INVALID_TRANSITION,
        });
        expect((await roundOf(c)).status).toBe(status);
      }
    });

    it('C26: o resultado traz placar, Craque, Perna de Pau e a tabela em ordem de nota, com rank e scouts', async () => {
      const { c } = await closedWithVotes();
      const res = await get(c, c.people.w2, '/result').expect(200);
      const result = res.body;

      expect(roundResultSchema.safeParse(result).success).toBe(true);
      expect(result).toMatchObject({
        roundId: c.round.id,
        score: { WHITE: 2, BLACK: 1 },
        winner: 'WHITE',
        closeReason: 'ADMIN_CLOSED',
        votes: { voted: 5, total: 8 },
        me: { membershipId: c.people.w2.membershipId, played: true },
      });
      expect(result.mvps.map((p: { nickname: string }) => p.nickname)).toEqual(['Caio']);
      expect(result.flops.map((p: { nickname: string }) => p.nickname)).toEqual(['Fabio']);

      // Nota, empate dividindo a posição (1, 2, 2, 4, 4, 4, 4, 8), sem nota por último e depois o apelido
      expect(
        result.players.map((p: { nickname: string; score: number; rank: number }) => [
          p.nickname,
          p.score,
          p.rank,
        ]),
      ).toEqual([
        ['Caio', 9, 1],
        ['Bruno', 7, 2],
        ['Gui', 7, 2],
        ['Alfa', 6, 4],
        ['Davi', 6, 4],
        ['Edu', 6, 4],
        ['Hugo', 6, 4],
        ['Fabio', 3, 8],
      ]);
      const by = (nickname: string) =>
        result.players.find((p: { nickname: string }) => p.nickname === nickname);
      expect(by('Caio')).toMatchObject({
        goals: 1,
        assists: 0,
        ownGoals: 0,
        isMvp: true,
        ratingsCount: 5,
      });
      expect(by('Bruno')).toMatchObject({ goals: 0, assists: 1, ownGoals: 0, ratingsCount: 4 });
      expect(by('Fabio')).toMatchObject({ ownGoals: 1, isFlop: true, team: 'BLACK' });
      expect(by('Gui')).toMatchObject({ goals: 1 });
      // Quem não jogou vê o mesmo resultado e a diferença em `me`
      const bench = await get(c, c.people.bench, '/result').expect(200);
      expect(bench.body.me).toEqual({ membershipId: c.people.bench.membershipId, played: false });
    });

    it('C26: o resultado fica como foi gravado, mesmo que o prazo do grupo mude depois', async () => {
      const { c } = await closedWithVotes();
      const before = (await get(c, c.people.w2, '/result').expect(200)).body;
      await t.prisma.group.update({ where: { id: c.group.id }, data: { votingDeadlineHours: 1 } });
      await t.prisma.rating.updateMany({ data: { value: 0 } });
      const after = (await get(c, c.people.w2, '/result').expect(200)).body;
      expect(after).toEqual({ ...before, me: before.me });
    });

    it('C27: a rodada ainda em votação leva 409 RESULT_NOT_READY', async () => {
      const c = await setup();
      const res = await get(c, c.people.w2, '/result').expect(409);
      expect(res.body).toMatchObject({
        code: 'RESULT_NOT_READY',
        message: VOTING_ERROR_LABELS.RESULT_NOT_READY,
      });
      const early = await setup({ status: 'POST_MATCH' });
      await get(early, early.people.w2, '/result').expect(409);
    });

    it('C28: fechou sem voto nenhum: todos sem nota, sem Craque e sem Perna de Pau', async () => {
      const c = await setup();
      await closeReq(c, c.people.w1).expect(200);
      const res = await get(c, c.people.w2, '/result').expect(200);

      expect(roundResultSchema.safeParse(res.body).success).toBe(true);
      expect(res.body.votes).toEqual({ voted: 0, total: 8 });
      expect(res.body.mvps).toEqual([]);
      expect(res.body.flops).toEqual([]);
      expect(res.body.players).toHaveLength(8);
      expect(
        res.body.players.every(
          (p: { score: number | null; rank: number | null; ratingsCount: number }) =>
            p.score === null && p.rank === null && p.ratingsCount === 0,
        ),
      ).toBe(true);
      // Sem nota: pelo apelido
      expect(res.body.players.map((p: { nickname: string }) => p.nickname)).toEqual([
        'Alfa',
        'Bruno',
        'Caio',
        'Davi',
        'Edu',
        'Fabio',
        'Gui',
        'Hugo',
      ]);
    });

    it('C29: fechada, votar e encerrar de novo levam 409 e o resultado não muda', async () => {
      const { c } = await closedWithVotes();
      const before = await t.prisma.teamPlayer.findMany({
        where: { roundId: c.round.id },
        orderBy: { id: 'asc' },
      });

      const voted = await put(c, c.people.w2, ballotFor(c, 'w2')).expect(409);
      expect(voted.body).toMatchObject({
        code: 'VOTING_CLOSED',
        message: VOTING_ERROR_LABELS.VOTING_CLOSED,
      });
      const closed = await closeReq(c, c.people.w1).expect(409);
      expect(closed.body.code).toBe('INVALID_TRANSITION');

      const after = await t.prisma.teamPlayer.findMany({
        where: { roundId: c.round.id },
        orderBy: { id: 'asc' },
      });
      expect(after).toEqual(before);
      expect(await voteCount(c)).toBe(5);
    });
  });

  describe('fechamento pelo prazo', () => {
    it('C24: closeDueVotings(now) fecha as vencidas, de qualquer grupo, e deixa as que têm prazo', async () => {
      const a = await setup({ openedAgoMs: 25 * HOUR_MS });
      const b = await setup({ openedAgoMs: 30 * HOUR_MS });
      const fresh = await t.prisma.round.create({
        data: {
          groupId: a.group.id,
          scheduledAt: new Date(Date.now() - DAY_MS),
          status: 'VOTING',
          whiteGoals: 0,
          blackGoals: 0,
          votingOpenedAt: new Date(Date.now() - 1 * HOUR_MS),
          teamPlayers: {
            create: [
              {
                membershipId: a.people.w1.membershipId,
                team: 'WHITE' as const,
                position: 'GOALKEEPER' as const,
              },
            ],
          },
        },
      });

      const closed = await t.app.get(VotingService).closeDueVotings(new Date());

      expect(closed).toBe(2);
      expect(await roundOf(a)).toMatchObject({
        status: 'CLOSED',
        votingEndReason: 'DEADLINE_PASSED',
      });
      expect(await roundOf(b)).toMatchObject({
        status: 'CLOSED',
        votingEndReason: 'DEADLINE_PASSED',
      });
      expect((await t.prisma.round.findUniqueOrThrow({ where: { id: fresh.id } })).status).toBe(
        'VOTING',
      );
      // Sem voto: nenhuma nota nem prêmio
      expect(await t.prisma.teamPlayer.count({ where: { roundScore: { not: null } } })).toBe(0);
      expect(
        await t.prisma.teamPlayer.count({ where: { OR: [{ isMvp: true }, { isFlop: true }] } }),
      ).toBe(0);
      // De novo, nada para fechar
      expect(await t.app.get(VotingService).closeDueVotings(new Date())).toBe(0);
    });

    it('C24: com o grupo, só as rodadas dele; e com "agora" adiante, fecha as que passam do prazo', async () => {
      const a = await setup({ openedAgoMs: 25 * HOUR_MS });
      const b = await setup({ openedAgoMs: 30 * HOUR_MS });
      const voting = t.app.get(VotingService);
      expect(await voting.closeDueVotings(new Date(), a.group.id)).toBe(1);
      expect((await roundOf(b)).status).toBe('VOTING');

      const c = await setup({ openedAgoMs: 1 * HOUR_MS });
      expect(await voting.closeDueVotings(new Date(Date.now() + 22 * HOUR_MS), c.group.id)).toBe(0);
      expect(
        await voting.closeDueVotings(new Date(Date.now() + 23 * HOUR_MS + 60_000), c.group.id),
      ).toBe(1);
    });

    it('C24: quando todos votaram e a rodada seguia aberta, o fechamento pega o ALL_VOTED', async () => {
      const c = await setup();
      for (const key of KEYS) {
        const voter = c.people[key].membershipId;
        const b = ballotFor(c, key);
        await t.prisma.vote.create({
          data: {
            roundId: c.round.id,
            voterId: voter,
            mvpId: b.mvpId,
            flopId: b.flopId,
            ratings: { create: b.ratings },
          },
        });
      }
      expect(await t.app.get(VotingService).closeDueVotings(new Date())).toBe(1);
      expect(await roundOf(c)).toMatchObject({ status: 'CLOSED', votingEndReason: 'ALL_VOTED' });
    });

    it('C24: o relógio da API (VotingCloser) fecha sozinho de tempos em tempos', async () => {
      const c = await setup({ openedAgoMs: 25 * HOUR_MS });
      const closer = new VotingCloser(t.app.get(VotingService), {
        get: () => 20,
      } as never);
      closer.onModuleInit();
      try {
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline && (await roundOf(c)).status !== 'CLOSED') {
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
      } finally {
        closer.onModuleDestroy();
      }
      expect(await roundOf(c)).toMatchObject({
        status: 'CLOSED',
        votingEndReason: 'DEADLINE_PASSED',
      });
    });

    it('C24: com VOTING_CLOSER_INTERVAL_MS em 0 o relógio fica desligado', async () => {
      const c = await setup({ openedAgoMs: 25 * HOUR_MS });
      const closer = new VotingCloser(t.app.get(VotingService), { get: () => 0 } as never);
      closer.onModuleInit();
      await new Promise((resolve) => setTimeout(resolve, 100));
      closer.onModuleDestroy();
      expect((await roundOf(c)).status).toBe('VOTING');
    });

    it('C25: abrir a lista de rodadas ou a votação depois do prazo já traz a rodada CLOSED', async () => {
      const viaList = await setup({ openedAgoMs: 25 * HOUR_MS });
      const list = await request(server())
        .get(`/api/groups/${viaList.group.id}/rounds`)
        .set('Cookie', viaList.people.w2.cookie)
        .expect(200);
      expect(roundListSchema.safeParse(list.body).success).toBe(true);
      expect(list.body.past[0]).toMatchObject({ id: viaList.round.id, status: 'CLOSED' });
      expect(list.body.votingId).toBeNull();
      expect(list.body.lastResult).toMatchObject({ roundId: viaList.round.id });
      expect(await roundOf(viaList)).toMatchObject({ votingEndReason: 'DEADLINE_PASSED' });

      const viaVoting = await setup({ openedAgoMs: 25 * HOUR_MS });
      const view = await get(viaVoting, viaVoting.people.w2).expect(200);
      expect(view.body).toMatchObject({
        status: 'CLOSED',
        closeReason: 'DEADLINE_PASSED',
        permissions: { vote: false },
      });

      const viaResult = await setup({ openedAgoMs: 25 * HOUR_MS });
      await get(viaResult, viaResult.people.w2, '/result').expect(200);
    });

    it('C16: voto que chega antes do prazo ainda entra e a rodada segue aberta', async () => {
      const c = await setup({ openedAgoMs: 23 * HOUR_MS });
      await vote(c, 'w2');
      expect((await roundOf(c)).status).toBe('VOTING');
    });
  });

  describe('rodadas e histórico', () => {
    it('C30: a lista traz votingId da rodada em votação e lastResult do resultado recente; 8 dias depois, lastResult some', async () => {
      const c = await setup();
      const closedAt = new Date(Date.now() - DAY_MS);
      const yesterday = await t.prisma.round.create({
        data: {
          groupId: c.group.id,
          scheduledAt: new Date(Date.now() - 9 * DAY_MS),
          status: 'CLOSED',
          whiteGoals: 1,
          blackGoals: 0,
          closedAt,
          votingEndReason: 'DEADLINE_PASSED',
          votingOpenedAt: new Date(closedAt.getTime() - DAY_MS),
        },
      });

      const res = await request(server())
        .get(`/api/groups/${c.group.id}/rounds`)
        .set('Cookie', c.people.w2.cookie)
        .expect(200);
      expect(roundListSchema.safeParse(res.body).success).toBe(true);
      expect(res.body.votingId).toBe(c.round.id);
      expect(res.body.lastResult).toEqual({
        roundId: yesterday.id,
        number: yesterday.number,
        closedAt: closedAt.toISOString(),
      });

      // 8 dias depois (a rodada em votação segue com prazo: abriu 1 h antes desse "agora")
      const later = new Date(Date.now() + 8 * DAY_MS);
      await t.prisma.round.update({
        where: { id: c.round.id },
        data: { votingOpenedAt: new Date(later.getTime() - HOUR_MS) },
      });
      const list = await t.app.get(RoundsService).list(c.group.id, later);
      expect(list.votingId).toBe(c.round.id);
      expect(list.lastResult).toBeNull();
    });

    it('C30: sem votação nem resultado, os dois vêm nulos', async () => {
      const group = await createGroup(t);
      const user = await createUser(t);
      await addMember(t, user.id, group.id);
      const res = await request(server())
        .get(`/api/groups/${group.id}/rounds`)
        .set('Cookie', loginAs(t, user.id))
        .expect(200);
      expect(res.body).toMatchObject({ votingId: null, lastResult: null });
    });

    it('C31: o histórico traz o Craque da partida fechada; antes de fechar, lista vazia', async () => {
      const c = await setup();
      const history = () =>
        request(server())
          .get(`/api/groups/${c.group.id}/history`)
          .set('Cookie', c.people.w2.cookie)
          .expect(200);

      const open = await history();
      expect(historyListSchema.safeParse(open.body).success).toBe(true);
      expect(open.body.items[0]).toMatchObject({ status: 'VOTING', mvps: [] });

      for (const key of ['w1', 'w2', 'b1']) await vote(c, key as Key);
      await closeReq(c, c.people.w1).expect(200);

      const closed = await history();
      expect(historyListSchema.safeParse(closed.body).success).toBe(true);
      expect(closed.body.items[0]).toMatchObject({
        status: 'CLOSED',
        me: { team: 'WHITE' },
        mvps: [
          {
            membershipId: c.people.w3.membershipId,
            nickname: 'Caio',
            avatar: {
              skin: expect.any(String),
              hair: expect.any(String),
              hairColor: expect.any(String),
            },
          },
        ],
      });
    });

    it('C31: quem não jogou e é Craque aparece em mvps sem ganhar um "me"; empate de Craque traz os dois', async () => {
      const c = await setup({ status: 'CLOSED' });
      await t.prisma.teamPlayer.updateMany({
        where: {
          roundId: c.round.id,
          membershipId: { in: [c.people.w3.membershipId, c.people.b3.membershipId] },
        },
        data: { isMvp: true },
      });
      const res = await request(server())
        .get(`/api/groups/${c.group.id}/history`)
        .set('Cookie', c.people.bench.cookie)
        .expect(200);
      expect(res.body.items[0].me).toBeNull();
      expect(res.body.items[0].mvps.map((m: { nickname: string }) => m.nickname)).toEqual([
        'Caio',
        'Gui',
      ]);
    });
  });

  describe('acesso', () => {
    it('C32: outro grupo, não membro e membro inativo levam 404 em tudo, sem mudar nada', async () => {
      const c = await setup();
      const other = await setup();
      const stranger = await createUser(t);
      const inactiveUser = await createUser(t);
      await addMember(t, inactiveUser.id, c.group.id, { active: false });
      const outsiders: [string, Person][] = [
        ['de outro grupo', other.people.w1],
        ['sem grupo', { userId: stranger.id, membershipId: 'x', cookie: loginAs(t, stranger.id) }],
        [
          'inativo',
          { userId: inactiveUser.id, membershipId: 'x', cookie: loginAs(t, inactiveUser.id) },
        ],
      ];

      for (const [label, who] of outsiders) {
        const calls = [
          get(c, who),
          get(c, who, '/result'),
          put(c, who, ballotFor(c, 'w2')),
          closeReq(c, who),
        ];
        const statuses = (await Promise.all(calls)).map((r) => [label, r.status]);
        expect(statuses).toEqual([
          [label, 404],
          [label, 404],
          [label, 404],
          [label, 404],
        ]);
      }
      expect(await voteCount(c)).toBe(0);
      expect((await roundOf(c)).status).toBe('VOTING');
    });

    it('C32: a rodada de outro grupo, pedida pelo grupo do usuário, leva 404 (nunca confia no id do cliente)', async () => {
      const mine = await setup();
      const theirs = await setup();
      const crossed = (rest: string) =>
        `/api/groups/${mine.group.id}/rounds/${theirs.round.id}/voting${rest}`;
      const cookie = mine.people.w1.cookie;

      await request(server()).get(crossed('')).set('Cookie', cookie).expect(404);
      await request(server()).get(crossed('/result')).set('Cookie', cookie).expect(404);
      await request(server())
        .put(crossed('/vote'))
        .set('Cookie', cookie)
        .send(ballotFor(theirs, 'w2'))
        .expect(404);
      await request(server()).post(crossed('/close')).set('Cookie', cookie).send({}).expect(404);
      expect(await voteCount(theirs)).toBe(0);
      expect((await roundOf(theirs)).status).toBe('VOTING');
      // Rodada que não existe
      await request(server())
        .get(`/api/groups/${mine.group.id}/rounds/nao-existe/voting`)
        .set('Cookie', cookie)
        .expect(404);
    });

    it('sem sessão a votação responde 401', async () => {
      const c = await setup();
      await request(server()).get(base(c)).expect(401);
      await request(server())
        .put(`${base(c)}/vote`)
        .send(ballotFor(c, 'w2'))
        .expect(401);
    });
  });
});
