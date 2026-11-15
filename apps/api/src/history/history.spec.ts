import { HISTORY_PAGE_DEFAULT, INVALID_CURSOR_LABEL, historyListSchema } from '@fut-stats/shared';
import request from 'supertest';
import type { RoundStatus, Team } from '../generated/prisma/enums';
import { addMember, createGroup, createUser, loginAs } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';

const DAY_MS = 24 * 60 * 60 * 1000;
const ROUND_STATUSES: RoundStatus[] = [
  'SCHEDULED',
  'TEAMS_PUBLISHED',
  'IN_PROGRESS',
  'POST_MATCH',
  'VOTING',
  'CLOSED',
];
const FINISHED: RoundStatus[] = ['POST_MATCH', 'VOTING', 'CLOSED'];

describe('histórico de partidas', () => {
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
  const path = (groupId: string) => `/api/groups/${groupId}/history`;

  async function setup() {
    const group = await createGroup(t);
    const user = await createUser(t);
    const member = await addMember(t, user.id, group.id);
    return { group, user, member, cookie: loginAs(t, user.id) };
  }

  /** Rodada com o placar lançado (por padrão 1x0), marcada `daysAgo` dias atrás. */
  function createRound(
    groupId: string,
    data: {
      status?: RoundStatus;
      daysAgo?: number;
      scheduledAt?: Date;
      score?: [number, number] | null;
      location?: string | null;
    } = {},
  ) {
    const score = data.score === undefined ? [1, 0] : data.score;
    return t.prisma.round.create({
      data: {
        groupId,
        scheduledAt: data.scheduledAt ?? new Date(Date.now() - (data.daysAgo ?? 1) * DAY_MS),
        location: data.location === undefined ? 'Arena' : data.location,
        status: data.status ?? 'CLOSED',
        whiteGoals: score?.[0] ?? null,
        blackGoals: score?.[1] ?? null,
      },
    });
  }

  const play = (roundId: string, membershipId: string, team: Team, isReserve = false) =>
    t.prisma.teamPlayer.create({
      data: { roundId, membershipId, team, position: 'MIDFIELDER', isReserve },
    });

  const list = (groupId: string, cookie: string, query = '') =>
    request(server())
      .get(`${path(groupId)}${query}`)
      .set('Cookie', cookie);

  it('C4: só as partidas finalizadas, da mais recente para a mais antiga, com os campos do contrato', async () => {
    const s = await setup();
    const rounds = new Map<RoundStatus, { id: string; number: number; scheduledAt: Date }>();
    for (const [i, status] of ROUND_STATUSES.entries()) {
      // a ordem de criação é a dos status; a data marcada é invertida para a lista não sair "de graça"
      rounds.set(
        status,
        await createRound(s.group.id, {
          status,
          daysAgo: 10 + i,
          score: status === 'CLOSED' ? [3, 2] : [1, 1],
          location: status === 'VOTING' ? null : 'Arena',
        }),
      );
    }

    const res = await list(s.group.id, s.cookie).expect(200);

    expect(historyListSchema.safeParse(res.body).success).toBe(true);
    // marcada mais recentemente = índice menor em ROUND_STATUSES
    expect(res.body.items.map((i: { status: string }) => i.status)).toEqual([
      'POST_MATCH',
      'VOTING',
      'CLOSED',
    ]);
    expect(res.body.nextCursor).toBeNull();
    const closed = res.body.items[2];
    expect(closed).toEqual({
      roundId: rounds.get('CLOSED')!.id,
      number: rounds.get('CLOSED')!.number,
      scheduledAt: rounds.get('CLOSED')!.scheduledAt.toISOString(),
      location: 'Arena',
      status: 'CLOSED',
      score: { WHITE: 3, BLACK: 2 },
      winner: 'WHITE',
      me: null,
      mvps: [],
    });
    expect(res.body.items[1].location).toBeNull();
    expect(res.body.items[0].winner).toBe('DRAW');
    expect(rounds.get('CLOSED')!.number).toBeGreaterThan(0);
  });

  it('C4: o vencedor sai do placar (Branco, Preto e empate)', async () => {
    const s = await setup();
    await createRound(s.group.id, { daysAgo: 3, score: [3, 2] });
    await createRound(s.group.id, { daysAgo: 2, score: [1, 4] });
    await createRound(s.group.id, { daysAgo: 1, score: [0, 0] });

    const res = await list(s.group.id, s.cookie).expect(200);

    expect(res.body.items.map((i: { winner: string }) => i.winner)).toEqual([
      'DRAW',
      'BLACK',
      'WHITE',
    ]);
  });

  it('C5: me = time e resultado de quem pede (titular ou reserva); null se não jogou', async () => {
    const s = await setup();
    const other = await addMember(t, (await createUser(t)).id, s.group.id);
    const white = await createRound(s.group.id, { daysAgo: 4, score: [3, 2] });
    const black = await createRound(s.group.id, { daysAgo: 3, score: [3, 2] });
    const absent = await createRound(s.group.id, { daysAgo: 2, score: [3, 2] });
    const reserve = await createRound(s.group.id, { daysAgo: 1, score: [2, 2] });
    await play(white.id, s.member.id, 'WHITE');
    await play(black.id, s.member.id, 'BLACK');
    await play(absent.id, other.id, 'WHITE'); // outro jogador jogou, quem pede não
    await play(reserve.id, s.member.id, 'BLACK', true);

    const res = await list(s.group.id, s.cookie).expect(200);

    const meBy = new Map(
      res.body.items.map((i: { roundId: string; me: unknown }) => [i.roundId, i.me]),
    );
    expect(meBy.get(white.id)).toEqual({ team: 'WHITE', result: 'WIN' });
    expect(meBy.get(black.id)).toEqual({ team: 'BLACK', result: 'LOSS' });
    expect(meBy.get(absent.id)).toBeNull();
    expect(meBy.get(reserve.id)).toEqual({ team: 'BLACK', result: 'DRAW' });
  });

  it('C5: o me é de quem pede, não de outro membro do grupo', async () => {
    const s = await setup();
    const otherUser = await createUser(t);
    const other = await addMember(t, otherUser.id, s.group.id);
    const round = await createRound(s.group.id, { score: [3, 2] });
    await play(round.id, s.member.id, 'WHITE');
    await play(round.id, other.id, 'BLACK');

    const mine = await list(s.group.id, s.cookie).expect(200);
    const theirs = await list(s.group.id, loginAs(t, otherUser.id)).expect(200);

    expect(mine.body.items[0].me).toEqual({ team: 'WHITE', result: 'WIN' });
    expect(theirs.body.items[0].me).toEqual({ team: 'BLACK', result: 'LOSS' });
  });

  it('C6: 25 partidas: 20 e nextCursor; depois os 5 restantes e nextCursor null, sem repetir nem pular', async () => {
    const s = await setup();
    // criadas da mais antiga para a mais recente
    const created = [];
    for (let i = 25; i >= 1; i -= 1) created.push(await createRound(s.group.id, { daysAgo: i }));
    const expected = created.map((r) => r.id).reverse();

    const first = await list(s.group.id, s.cookie).expect(200);
    expect(first.body.items).toHaveLength(HISTORY_PAGE_DEFAULT);
    expect(first.body.nextCursor).toBe(expected[19]);

    const second = await list(s.group.id, s.cookie, `?cursor=${first.body.nextCursor}`).expect(200);
    expect(second.body.items).toHaveLength(5);
    expect(second.body.nextCursor).toBeNull();

    const ids = [...first.body.items, ...second.body.items].map(
      (i: { roundId: string }) => i.roundId,
    );
    expect(ids).toEqual(expected);
  });

  it('C6: o limite pedido vale e a última página exata não deixa cursor', async () => {
    const s = await setup();
    for (let i = 4; i >= 1; i -= 1) await createRound(s.group.id, { daysAgo: i });

    const a = await list(s.group.id, s.cookie, '?limit=2').expect(200);
    expect(a.body.items).toHaveLength(2);
    const b = await list(s.group.id, s.cookie, `?limit=2&cursor=${a.body.nextCursor}`).expect(200);
    expect(b.body.items).toHaveLength(2);
    expect(b.body.nextCursor).toBeNull();
    const all = await list(s.group.id, s.cookie, '?limit=50').expect(200);
    expect(all.body.items).toHaveLength(4);
    expect(all.body.nextCursor).toBeNull();
  });

  it('C7: duas partidas na mesma data: paginando de uma em uma as duas aparecem (desempate pelo número)', async () => {
    const s = await setup();
    const when = new Date(Date.now() - DAY_MS);
    const older = await createRound(s.group.id, { scheduledAt: when });
    const newer = await createRound(s.group.id, { scheduledAt: when });
    const earlier = await createRound(s.group.id, { daysAgo: 5 });
    expect(newer.number).toBeGreaterThan(older.number);

    const first = await list(s.group.id, s.cookie, '?limit=1').expect(200);
    const second = await list(
      s.group.id,
      s.cookie,
      `?limit=1&cursor=${first.body.nextCursor}`,
    ).expect(200);
    const third = await list(
      s.group.id,
      s.cookie,
      `?limit=1&cursor=${second.body.nextCursor}`,
    ).expect(200);

    expect(first.body.items[0].roundId).toBe(newer.id);
    expect(second.body.items[0].roundId).toBe(older.id);
    expect(third.body.items[0].roundId).toBe(earlier.id);
    expect(third.body.nextCursor).toBeNull();
  });

  it.each(['limit=0', 'limit=51', 'limit=abc', 'cursor='])(
    'C8: ?%s → 400 de validação',
    async (query) => {
      const s = await setup();
      await createRound(s.group.id);

      await list(s.group.id, s.cookie, `?${query}`).expect(400);
    },
  );

  it('C8: cursor de rodada que não existe → 400 INVALID_CURSOR', async () => {
    const s = await setup();
    await createRound(s.group.id);

    const res = await list(s.group.id, s.cookie, '?cursor=nao-existe').expect(400);

    expect(res.body).toMatchObject({ code: 'INVALID_CURSOR', message: INVALID_CURSOR_LABEL });
  });

  it('C8: cursor de rodada de outro grupo → 400 INVALID_CURSOR', async () => {
    const s = await setup();
    const other = await createGroup(t);
    const foreign = await createRound(other.id);
    await createRound(s.group.id);

    const res = await list(s.group.id, s.cookie, `?cursor=${foreign.id}`).expect(400);

    expect(res.body).toMatchObject({ code: 'INVALID_CURSOR', message: INVALID_CURSOR_LABEL });
  });

  it.each(['SCHEDULED', 'TEAMS_PUBLISHED', 'IN_PROGRESS'] as const)(
    'C8: cursor de rodada %s (não finalizada) → 400 INVALID_CURSOR',
    async (status) => {
      const s = await setup();
      const open = await createRound(s.group.id, { status, score: null });
      await createRound(s.group.id);

      const res = await list(s.group.id, s.cookie, `?cursor=${open.id}`).expect(400);

      expect(res.body).toMatchObject({ code: 'INVALID_CURSOR', message: INVALID_CURSOR_LABEL });
    },
  );

  it('C9: grupo sem partida finalizada → lista vazia', async () => {
    const s = await setup();
    await createRound(s.group.id, { status: 'IN_PROGRESS', score: null });
    await createRound(s.group.id, { status: 'SCHEDULED', score: null });

    const res = await list(s.group.id, s.cookie).expect(200);

    expect(res.body).toEqual({ items: [], nextCursor: null });
  });

  it('C10: rodadas de outro grupo não aparecem', async () => {
    const s = await setup();
    const other = await createGroup(t);
    const mine = await createRound(s.group.id, { daysAgo: 2 });
    for (const status of FINISHED) await createRound(other.id, { status, daysAgo: 1 });

    const res = await list(s.group.id, s.cookie).expect(200);

    expect(res.body.items.map((i: { roundId: string }) => i.roundId)).toEqual([mine.id]);
  });

  describe('C11: quem pode ver', () => {
    it('admin e jogador comum veem a lista (200)', async () => {
      const s = await setup();
      const adminUser = await createUser(t);
      await addMember(t, adminUser.id, s.group.id, { role: 'ADMIN' });
      await createRound(s.group.id);

      await list(s.group.id, loginAs(t, adminUser.id)).expect(200);
      await list(s.group.id, s.cookie).expect(200);
    });

    it('usuário de outro grupo → 404', async () => {
      const s = await setup();
      const otherGroup = await createGroup(t);
      const stranger = await createUser(t);
      await addMember(t, stranger.id, otherGroup.id);
      await createRound(s.group.id);

      await list(s.group.id, loginAs(t, stranger.id)).expect(404);
    });

    it('usuário que não é membro de nenhum grupo → 404', async () => {
      const s = await setup();
      const stranger = await createUser(t);

      await list(s.group.id, loginAs(t, stranger.id)).expect(404);
    });

    it('membro inativo → 404', async () => {
      const s = await setup();
      const user = await createUser(t);
      await addMember(t, user.id, s.group.id, { active: false });

      await list(s.group.id, loginAs(t, user.id)).expect(404);
    });

    it('sem sessão → 401', async () => {
      const s = await setup();

      await request(server()).get(path(s.group.id)).expect(401);
    });
  });
});
