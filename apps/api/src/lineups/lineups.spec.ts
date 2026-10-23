import {
  LINEUP_DRAFT_ERROR_LABELS,
  LINEUP_NOT_EDITABLE_LABEL,
  lineupSchema,
  PLAYER_NOT_CONFIRMED_LABEL,
  ROUND_TRANSITION_ERROR_LABELS,
  type SaveLineupInput,
} from '@fut-stats/shared';
import request from 'supertest';
import type { Position, RoundStatus } from '../generated/prisma/enums';
import { addMember, createGroup, createUser, loginAs } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';

const DAY_MS = 24 * 60 * 60 * 1000;
const FORMATION_ORDER: Position[] = [
  'GOALKEEPER',
  'DEFENDER',
  'DEFENDER',
  'WINGER',
  'WINGER',
  'MIDFIELDER',
  'FORWARD',
];

describe('times da rodada (escalação)', () => {
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
  const lineupPath = (groupId: string, roundId: string) =>
    `/api/groups/${groupId}/rounds/${roundId}/lineup`;

  /** Grupo com admin, um jogador comum e uma rodada com 16 confirmados (incluindo os dois). */
  async function setup(status: RoundStatus = 'SCHEDULED') {
    const group = await createGroup(t);
    const adminUser = await createUser(t);
    const playerUser = await createUser(t);
    const admin = await addMember(t, adminUser.id, group.id, { role: 'ADMIN' });
    const player = await addMember(t, playerUser.id, group.id);
    const round = await t.prisma.round.create({
      data: { groupId: group.id, scheduledAt: new Date(Date.now() + DAY_MS), status },
    });
    const ids = [admin.id, player.id];
    for (let i = 0; i < 14; i += 1) {
      const user = await createUser(t);
      ids.push((await addMember(t, user.id, group.id)).id);
    }
    await t.prisma.attendance.createMany({
      data: ids.map((membershipId) => ({ roundId: round.id, membershipId, confirmed: true })),
    });
    return { group, adminUser, playerUser, admin, player, round, ids };
  }

  /** Branco = ids[0..6], Preto = ids[7..13], reservas = ids[14] (Branco) e ids[15] (Preto). */
  function fullDraft(ids: string[]): SaveLineupInput {
    const starters = (from: number) =>
      FORMATION_ORDER.map((position, i) => ({ membershipId: ids[from + i]!, position }));
    return {
      WHITE: { starters: starters(0), reserves: [ids[14]!] },
      BLACK: { starters: starters(7), reserves: [ids[15]!] },
    };
  }

  const emptyDraft: SaveLineupInput = {
    WHITE: { starters: [], reserves: [] },
    BLACK: { starters: [], reserves: [] },
  };

  describe('GET /lineup', () => {
    it('admin vê o rascunho vazio com todos os confirmados sem time', async () => {
      const { group, adminUser, round } = await setup();

      const res = await request(server())
        .get(lineupPath(group.id, round.id))
        .set('Cookie', as(adminUser.id))
        .expect(200);

      expect(lineupSchema.safeParse(res.body).success).toBe(true);
      expect(res.body.published).toBe(false);
      expect(res.body.teams.WHITE).toEqual({ starters: [], reserves: [] });
      expect(res.body.unassigned).toHaveLength(16);
      expect(res.body.errors).toEqual(['INVALID_LINEUP']);
    });

    it('só lista como sem time quem confirmou e segue ativo', async () => {
      const { group, adminUser, round, ids } = await setup();
      await t.prisma.attendance.update({
        where: { roundId_membershipId: { roundId: round.id, membershipId: ids[3]! } },
        data: { confirmed: false },
      });
      await t.prisma.membership.update({ where: { id: ids[4]! }, data: { active: false } });

      const res = await request(server())
        .get(lineupPath(group.id, round.id))
        .set('Cookie', as(adminUser.id))
        .expect(200);

      expect(res.body.unassigned).toHaveLength(14);
    });

    it('jogador comum não vê o rascunho: antes de publicar vem tudo vazio', async () => {
      const { group, adminUser, playerUser, round, ids } = await setup();
      await request(server())
        .put(lineupPath(group.id, round.id))
        .set('Cookie', as(adminUser.id))
        .send(fullDraft(ids))
        .expect(200);

      const res = await request(server())
        .get(lineupPath(group.id, round.id))
        .set('Cookie', as(playerUser.id))
        .expect(200);

      expect(res.body.published).toBe(false);
      expect(res.body.teams.WHITE).toEqual({ starters: [], reserves: [] });
      expect(res.body.teams.BLACK).toEqual({ starters: [], reserves: [] });
      expect(res.body.unassigned).toEqual([]);
      expect(res.body.errors).toEqual([]);
    });

    it('rodada de outro grupo é 404 e grupo onde não é membro também (não revela que existe)', async () => {
      const { group, adminUser, round } = await setup();
      const other = await setup();

      await request(server())
        .get(lineupPath(group.id, other.round.id))
        .set('Cookie', as(adminUser.id))
        .expect(404);
      await request(server())
        .get(lineupPath(other.group.id, round.id))
        .set('Cookie', as(adminUser.id))
        .expect(404);
    });
  });

  describe('escrever em rodada de outro grupo', () => {
    it('admin de um grupo não salva, publica nem despublica a rodada do outro (404) e nada muda lá', async () => {
      const { group, adminUser } = await setup();
      const other = await setup();
      const path = lineupPath(group.id, other.round.id);

      await request(server())
        .put(path)
        .set('Cookie', as(adminUser.id))
        .send(fullDraft(other.ids))
        .expect(404);
      await request(server()).post(`${path}/publish`).set('Cookie', as(adminUser.id)).expect(404);
      await request(server()).post(`${path}/unpublish`).set('Cookie', as(adminUser.id)).expect(404);

      expect(await t.prisma.teamPlayer.count({ where: { roundId: other.round.id } })).toBe(0);
      const round = await t.prisma.round.findUniqueOrThrow({ where: { id: other.round.id } });
      expect(round.status).toBe('SCHEDULED');
    });
  });

  describe('PUT /lineup (rascunho)', () => {
    it('admin salva o rascunho; o GET devolve titulares com posição e reservas', async () => {
      const { group, adminUser, round, ids } = await setup();

      const res = await request(server())
        .put(lineupPath(group.id, round.id))
        .set('Cookie', as(adminUser.id))
        .send(fullDraft(ids))
        .expect(200);

      expect(lineupSchema.safeParse(res.body).success).toBe(true);
      expect(res.body.teams.WHITE.starters.map((p: { position: string }) => p.position)).toEqual(
        FORMATION_ORDER,
      );
      expect(
        res.body.teams.WHITE.reserves.map((p: { membershipId: string }) => p.membershipId),
      ).toEqual([ids[14]]);
      expect(res.body.unassigned).toHaveLength(0);
      expect(res.body.errors).toEqual([]);
      expect(await t.prisma.teamPlayer.count({ where: { roundId: round.id } })).toBe(16);
      expect((await t.prisma.round.findUniqueOrThrow({ where: { id: round.id } })).status).toBe(
        'SCHEDULED',
      );
    });

    it('rascunho incompleto vale; salvar de novo troca o anterior', async () => {
      const { group, adminUser, round, ids } = await setup();
      const send = (body: SaveLineupInput) =>
        request(server())
          .put(lineupPath(group.id, round.id))
          .set('Cookie', as(adminUser.id))
          .send(body);

      await send(fullDraft(ids)).expect(200);
      const res = await send({
        ...emptyDraft,
        WHITE: { starters: [{ membershipId: ids[0]!, position: 'GOALKEEPER' }], reserves: [] },
      }).expect(200);

      expect(res.body.teams.WHITE.starters).toHaveLength(1);
      expect(res.body.unassigned).toHaveLength(15);
      expect(res.body.errors).toEqual(['INVALID_LINEUP']);
      expect(await t.prisma.teamPlayer.count({ where: { roundId: round.id } })).toBe(1);
    });

    it('jogador comum não salva (403)', async () => {
      const { group, playerUser, round, ids } = await setup();
      await request(server())
        .put(lineupPath(group.id, round.id))
        .set('Cookie', as(playerUser.id))
        .send(fullDraft(ids))
        .expect(403);
      expect(await t.prisma.teamPlayer.count()).toBe(0);
    });

    it('recusa o que o domain recusa, com o texto do shared, e não salva nada', async () => {
      const { group, adminUser, round, ids } = await setup();
      const put = (body: object) =>
        request(server())
          .put(lineupPath(group.id, round.id))
          .set('Cookie', as(adminUser.id))
          .send(body);

      const repeated = await put({
        ...emptyDraft,
        WHITE: { starters: [{ membershipId: ids[0], position: 'GOALKEEPER' }], reserves: [] },
        BLACK: { starters: [{ membershipId: ids[0], position: 'GOALKEEPER' }], reserves: [] },
      }).expect(400);
      expect(repeated.body).toMatchObject({
        code: 'DUPLICATE_PLAYER',
        message: LINEUP_DRAFT_ERROR_LABELS.DUPLICATE_PLAYER,
      });

      await put({
        ...emptyDraft,
        WHITE: {
          starters: [
            { membershipId: ids[0], position: 'GOALKEEPER' },
            { membershipId: ids[1], position: 'GOALKEEPER' },
          ],
          reserves: [],
        },
      })
        .expect(400)
        .expect(({ body }) => expect(body.code).toBe('POSITION_FULL'));

      await put({ ...emptyDraft, WHITE: { starters: [], reserves: [ids[0], ids[1], ids[2]] } })
        .expect(400)
        .expect(({ body }) => expect(body.code).toBe('TOO_MANY_RESERVES'));

      await put({ WHITE: 'x' }).expect(400);
      expect(await t.prisma.teamPlayer.count()).toBe(0);
    });

    it('só entra quem confirmou presença nesta rodada, do grupo e ativo', async () => {
      const { group, adminUser, round, ids } = await setup();
      const stranger = await setup();
      const declinedId = ids[5]!;
      await t.prisma.attendance.update({
        where: { roundId_membershipId: { roundId: round.id, membershipId: declinedId } },
        data: { confirmed: false },
      });
      const put = (membershipId: string) =>
        request(server())
          .put(lineupPath(group.id, round.id))
          .set('Cookie', as(adminUser.id))
          .send({
            ...emptyDraft,
            WHITE: { starters: [{ membershipId, position: 'FORWARD' }], reserves: [] },
          });

      for (const membershipId of [declinedId, stranger.ids[0]!, 'nao-existe']) {
        const res = await put(membershipId).expect(400);
        expect(res.body).toMatchObject({
          code: 'PLAYER_NOT_CONFIRMED',
          message: PLAYER_NOT_CONFIRMED_LABEL,
        });
      }
    });

    it('quem já está no rascunho continua valendo mesmo se desconfirmar depois', async () => {
      const { group, adminUser, round, ids } = await setup();
      const path = lineupPath(group.id, round.id);
      await request(server())
        .put(path)
        .set('Cookie', as(adminUser.id))
        .send(fullDraft(ids))
        .expect(200);
      await t.prisma.attendance.update({
        where: { roundId_membershipId: { roundId: round.id, membershipId: ids[3]! } },
        data: { confirmed: false },
      });

      await request(server())
        .put(path)
        .set('Cookie', as(adminUser.id))
        .send(fullDraft(ids))
        .expect(200);
    });

    it('mantém a ordem dos reservas salva', async () => {
      const { group, adminUser, round, ids } = await setup();
      const draft = fullDraft(ids);
      draft.WHITE.reserves = [ids[15]!, ids[14]!];
      draft.BLACK.reserves = [];
      const res = await request(server())
        .put(lineupPath(group.id, round.id))
        .set('Cookie', as(adminUser.id))
        .send(draft)
        .expect(200);
      expect(
        res.body.teams.WHITE.reserves.map((p: { membershipId: string }) => p.membershipId),
      ).toEqual([ids[15], ids[14]]);
    });

    it.each<RoundStatus>(['TEAMS_PUBLISHED', 'IN_PROGRESS', 'CLOSED'])(
      'com a rodada %s não deixa mexer (409)',
      async (status) => {
        const { group, adminUser, round, ids } = await setup(status);
        const res = await request(server())
          .put(lineupPath(group.id, round.id))
          .set('Cookie', as(adminUser.id))
          .send(fullDraft(ids))
          .expect(409);
        expect(res.body).toMatchObject({
          code: 'LINEUP_NOT_EDITABLE',
          message: LINEUP_NOT_EDITABLE_LABEL,
        });
      },
    );
  });

  describe('POST /lineup/publish', () => {
    const post = (path: string, userId: string) =>
      request(server()).post(path).set('Cookie', as(userId));

    it('com a escalação válida vai para TEAMS_PUBLISHED e todos passam a ver os times', async () => {
      const { group, adminUser, playerUser, round, ids } = await setup();
      await request(server())
        .put(lineupPath(group.id, round.id))
        .set('Cookie', as(adminUser.id))
        .send(fullDraft(ids))
        .expect(200);

      const res = await post(`${lineupPath(group.id, round.id)}/publish`, adminUser.id).expect(201);
      expect(res.body.published).toBe(true);
      expect((await t.prisma.round.findUniqueOrThrow({ where: { id: round.id } })).status).toBe(
        'TEAMS_PUBLISHED',
      );

      const seen = await request(server())
        .get(lineupPath(group.id, round.id))
        .set('Cookie', as(playerUser.id))
        .expect(200);
      expect(seen.body.published).toBe(true);
      expect(seen.body.teams.BLACK.starters).toHaveLength(7);
      expect(seen.body.teams.BLACK.reserves).toHaveLength(1);
      expect(seen.body.unassigned).toEqual([]);
    });

    it('escalação incompleta não publica (409 com o texto do domain)', async () => {
      const { group, adminUser, round, ids } = await setup();
      await request(server())
        .put(lineupPath(group.id, round.id))
        .set('Cookie', as(adminUser.id))
        .send({
          ...emptyDraft,
          WHITE: { starters: [{ membershipId: ids[0], position: 'GOALKEEPER' }], reserves: [] },
        })
        .expect(200);

      const res = await post(`${lineupPath(group.id, round.id)}/publish`, adminUser.id).expect(409);
      expect(res.body).toMatchObject({
        code: 'INVALID_LINEUP',
        message: ROUND_TRANSITION_ERROR_LABELS.INVALID_LINEUP,
      });
      expect((await t.prisma.round.findUniqueOrThrow({ where: { id: round.id } })).status).toBe(
        'SCHEDULED',
      );
    });

    it('jogador comum não publica (403) e rodada já publicada não publica de novo (409)', async () => {
      const { group, adminUser, playerUser, round, ids } = await setup();
      await request(server())
        .put(lineupPath(group.id, round.id))
        .set('Cookie', as(adminUser.id))
        .send(fullDraft(ids));
      const path = `${lineupPath(group.id, round.id)}/publish`;

      await post(path, playerUser.id).expect(403);
      await post(path, adminUser.id).expect(201);
      const again = await post(path, adminUser.id).expect(409);
      expect(again.body.code).toBe('INVALID_TRANSITION');
    });
  });

  describe('POST /lineup/unpublish', () => {
    it('volta para SCHEDULED mantendo o rascunho; o jogador deixa de ver', async () => {
      const { group, adminUser, playerUser, round, ids } = await setup();
      const base = lineupPath(group.id, round.id);
      await request(server()).put(base).set('Cookie', as(adminUser.id)).send(fullDraft(ids));
      await request(server()).post(`${base}/publish`).set('Cookie', as(adminUser.id)).expect(201);

      const res = await request(server())
        .post(`${base}/unpublish`)
        .set('Cookie', as(adminUser.id))
        .expect(201);
      expect(res.body.published).toBe(false);
      expect(res.body.teams.WHITE.starters).toHaveLength(7);

      const seen = await request(server()).get(base).set('Cookie', as(playerUser.id)).expect(200);
      expect(seen.body.teams.WHITE.starters).toEqual([]);
    });

    it('só despublica quem está publicado (409) e só o admin (403)', async () => {
      const { group, adminUser, playerUser, round } = await setup();
      const path = `${lineupPath(group.id, round.id)}/unpublish`;

      await request(server()).post(path).set('Cookie', as(playerUser.id)).expect(403);
      const res = await request(server()).post(path).set('Cookie', as(adminUser.id)).expect(409);
      expect(res.body.code).toBe('INVALID_TRANSITION');

      await t.prisma.round.update({ where: { id: round.id }, data: { status: 'IN_PROGRESS' } });
      await request(server()).post(path).set('Cookie', as(adminUser.id)).expect(409);
    });
  });
});
