import {
  LINEUP_DRAFT_ERROR_LABELS,
  BALANCE_TEAMS_ERROR_LABELS,
  LINEUP_NOT_EDITABLE_LABEL,
  lineupSchema,
  lineupSuggestionSchema,
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

  type Setup = Awaited<ReturnType<typeof setup>>;
  const put = (s: Setup, userId: string, body: object) =>
    request(server()).put(lineupPath(s.group.id, s.round.id)).set('Cookie', as(userId)).send(body);
  const get = (s: Setup, userId: string) =>
    request(server()).get(lineupPath(s.group.id, s.round.id)).set('Cookie', as(userId));
  const post = (s: Setup, userId: string, action: 'publish' | 'unpublish') =>
    request(server())
      .post(`${lineupPath(s.group.id, s.round.id)}/${action}`)
      .set('Cookie', as(userId));
  const idsOf = (players: { membershipId: string }[]) => players.map((p) => p.membershipId);
  const statusOf = async (roundId: string) =>
    (await t.prisma.round.findUniqueOrThrow({ where: { id: roundId } })).status;

  /** Rascunho completo salvo e publicado. */
  async function published() {
    const s = await setup();
    await put(s, s.adminUser.id, fullDraft(s.ids)).expect(200);
    await post(s, s.adminUser.id, 'publish').expect(200);
    return s;
  }

  describe('GET /lineup', () => {
    it('C9: admin vê o rascunho vazio com os 16 sem time, o que falta e permissões de montar', async () => {
      const s = await setup();

      const res = await get(s, s.adminUser.id).expect(200);

      expect(lineupSchema.safeParse(res.body).success).toBe(true);
      expect(res.body.status).toBe('SCHEDULED');
      expect(res.body.published).toBe(false);
      expect(res.body.teams.WHITE).toEqual({ starters: [], reserves: [] });
      expect(res.body.teams.BLACK).toEqual({ starters: [], reserves: [] });
      expect(res.body.unassigned).toHaveLength(16);
      expect(res.body.errors).toEqual(['INVALID_LINEUP', 'ATTENDANCE_MISMATCH']);
      expect(res.body.permissions).toEqual({ edit: true, publish: true, unpublish: false });
    });

    it('C10: sem time só lista quem confirmou e segue ativo, fora dos já escalados', async () => {
      const s = await setup();
      await t.prisma.attendance.update({
        where: { roundId_membershipId: { roundId: s.round.id, membershipId: s.ids[3]! } },
        data: { confirmed: false },
      });
      await t.prisma.membership.update({ where: { id: s.ids[4]! }, data: { active: false } });
      await put(s, s.adminUser.id, {
        ...emptyDraft,
        WHITE: { starters: [{ membershipId: s.ids[5], position: 'FORWARD' }], reserves: [] },
      }).expect(200);

      const res = await get(s, s.adminUser.id).expect(200);

      const unassigned = idsOf(res.body.unassigned);
      expect(unassigned).toHaveLength(13);
      for (const excluded of [s.ids[3]!, s.ids[4]!, s.ids[5]!]) {
        expect(unassigned).not.toContain(excluded);
      }
    });

    it('C11: jogador comum não vê o rascunho: vem tudo vazio e sem permissões', async () => {
      const s = await setup();
      await put(s, s.adminUser.id, fullDraft(s.ids)).expect(200);

      const res = await get(s, s.playerUser.id).expect(200);

      expect(lineupSchema.safeParse(res.body).success).toBe(true);
      expect(res.body.published).toBe(false);
      expect(res.body.teams.WHITE).toEqual({ starters: [], reserves: [] });
      expect(res.body.teams.BLACK).toEqual({ starters: [], reserves: [] });
      expect(res.body.unassigned).toEqual([]);
      expect(res.body.errors).toEqual([]);
      expect(res.body.permissions).toEqual({ edit: false, publish: false, unpublish: false });
    });
  });

  describe('PUT /lineup (rascunho)', () => {
    it('C12: rascunho incompleto vale e o segundo substitui o primeiro, com posição e ordem certas', async () => {
      const s = await setup();
      await put(s, s.adminUser.id, fullDraft(s.ids)).expect(200);

      const draft: SaveLineupInput = {
        WHITE: {
          starters: [{ membershipId: s.ids[0]!, position: 'GOALKEEPER' }],
          reserves: [s.ids[15]!, s.ids[14]!],
        },
        BLACK: { starters: [{ membershipId: s.ids[7]!, position: 'FORWARD' }], reserves: [] },
      };
      const res = await put(s, s.adminUser.id, draft).expect(200);

      expect(lineupSchema.safeParse(res.body).success).toBe(true);
      expect(res.body.teams.WHITE.starters.map((p: { position: string }) => p.position)).toEqual([
        'GOALKEEPER',
      ]);
      expect(idsOf(res.body.teams.BLACK.starters)).toEqual([s.ids[7]]);
      // Reserva: ordem enviada e posição principal do jogador (MIDFIELDER em addMember)
      expect(idsOf(res.body.teams.WHITE.reserves)).toEqual([s.ids[15], s.ids[14]]);
      expect(res.body.teams.WHITE.reserves.map((p: { position: string }) => p.position)).toEqual([
        'MIDFIELDER',
        'MIDFIELDER',
      ]);
      expect(res.body.unassigned).toHaveLength(12);
      expect(await t.prisma.teamPlayer.count({ where: { roundId: s.round.id } })).toBe(4);
      expect(await statusOf(s.round.id)).toBe('SCHEDULED');
    });

    it('C12: titulares saem na ordem do 1-2-3-1 com a posição da vaga', async () => {
      const s = await setup();
      const res = await put(s, s.adminUser.id, fullDraft(s.ids)).expect(200);
      expect(res.body.teams.WHITE.starters.map((p: { position: string }) => p.position)).toEqual(
        FORMATION_ORDER,
      );
      expect(res.body.errors).toEqual([]);
    });

    it('C13: recusa o que o domain recusa, com o texto do shared, e não muda nada', async () => {
      const s = await setup();
      await put(s, s.adminUser.id, fullDraft(s.ids)).expect(200);
      const before = await t.prisma.teamPlayer.count({ where: { roundId: s.round.id } });
      const send = (body: object) => put(s, s.adminUser.id, body);

      const repeated = await send({
        ...emptyDraft,
        WHITE: { starters: [{ membershipId: s.ids[0], position: 'GOALKEEPER' }], reserves: [] },
        BLACK: { starters: [{ membershipId: s.ids[0], position: 'GOALKEEPER' }], reserves: [] },
      }).expect(400);
      expect(repeated.body).toEqual({
        code: 'DUPLICATE_PLAYER',
        message: LINEUP_DRAFT_ERROR_LABELS.DUPLICATE_PLAYER,
      });

      const full = await send({
        ...emptyDraft,
        WHITE: {
          starters: [
            { membershipId: s.ids[0], position: 'DEFENDER' },
            { membershipId: s.ids[1], position: 'DEFENDER' },
            { membershipId: s.ids[2], position: 'DEFENDER' },
          ],
          reserves: [],
        },
      }).expect(400);
      expect(full.body).toEqual({
        code: 'POSITION_FULL',
        message: LINEUP_DRAFT_ERROR_LABELS.POSITION_FULL,
      });

      const reserves = await send({
        ...emptyDraft,
        WHITE: { starters: [], reserves: [s.ids[0], s.ids[1], s.ids[2]] },
      }).expect(400);
      expect(reserves.body).toEqual({
        code: 'TOO_MANY_RESERVES',
        message: LINEUP_DRAFT_ERROR_LABELS.TOO_MANY_RESERVES,
      });

      await send({ WHITE: 'x' }).expect(400);
      expect(await t.prisma.teamPlayer.count({ where: { roundId: s.round.id } })).toBe(before);
    });

    it('C14: recusa quem não confirmou, é de outro grupo, está inativo ou não existe', async () => {
      const s = await setup();
      const stranger = await setup();
      const declinedId = s.ids[5]!;
      const inactiveId = s.ids[6]!;
      await t.prisma.attendance.update({
        where: { roundId_membershipId: { roundId: s.round.id, membershipId: declinedId } },
        data: { confirmed: false },
      });
      await t.prisma.membership.update({ where: { id: inactiveId }, data: { active: false } });

      for (const membershipId of [declinedId, inactiveId, stranger.ids[0]!, 'nao-existe']) {
        const res = await put(s, s.adminUser.id, {
          ...emptyDraft,
          WHITE: { starters: [{ membershipId, position: 'FORWARD' }], reserves: [] },
        }).expect(400);
        expect(res.body).toEqual({
          code: 'PLAYER_NOT_CONFIRMED',
          message: PLAYER_NOT_CONFIRMED_LABEL,
        });
      }
      // Também como reserva
      await put(s, s.adminUser.id, {
        ...emptyDraft,
        BLACK: { starters: [], reserves: [declinedId] },
      }).expect(400);
      expect(await t.prisma.teamPlayer.count()).toBe(0);
    });

    it('C15: quem já está no rascunho segue valendo se desconfirmar; o GET mostra confirmed false', async () => {
      const s = await setup();
      await put(s, s.adminUser.id, fullDraft(s.ids)).expect(200);
      await t.prisma.attendance.update({
        where: { roundId_membershipId: { roundId: s.round.id, membershipId: s.ids[3]! } },
        data: { confirmed: false },
      });

      await put(s, s.adminUser.id, fullDraft(s.ids)).expect(200);

      const res = await get(s, s.adminUser.id).expect(200);
      const starters: { membershipId: string; confirmed: boolean }[] =
        res.body.teams.WHITE.starters;
      expect(starters.find((p) => p.membershipId === s.ids[3])?.confirmed).toBe(false);
      expect(starters.filter((p) => p.confirmed)).toHaveLength(6);
      expect(res.body.errors).toContain('ATTENDANCE_MISMATCH');
      // Quem desconfirmou mas segue no rascunho pode ficar, mesmo sozinho, em outro salvamento
      await put(s, s.adminUser.id, {
        ...fullDraft(s.ids),
        BLACK: { starters: [], reserves: [] },
      }).expect(200);
      await put(s, s.adminUser.id, {
        ...emptyDraft,
        WHITE: { starters: [{ membershipId: s.ids[3], position: 'FORWARD' }], reserves: [] },
      }).expect(200);
    });

    it.each<RoundStatus>(['TEAMS_PUBLISHED', 'IN_PROGRESS', 'VOTING', 'CLOSED'])(
      'C16: com a rodada %s não deixa mexer (409)',
      async (status) => {
        const s = await setup(status);
        const res = await put(s, s.adminUser.id, fullDraft(s.ids)).expect(409);
        expect(res.body).toEqual({
          code: 'LINEUP_NOT_EDITABLE',
          message: LINEUP_NOT_EDITABLE_LABEL,
        });
        expect(await t.prisma.teamPlayer.count()).toBe(0);
      },
    );
  });

  describe('POST /lineup/publish', () => {
    it('C17: com 14 + 2 e todos os 16 confirmados vai para TEAMS_PUBLISHED e o jogador passa a ver', async () => {
      const s = await setup();
      await put(s, s.adminUser.id, fullDraft(s.ids)).expect(200);

      const res = await post(s, s.adminUser.id, 'publish').expect(200);

      expect(lineupSchema.safeParse(res.body).success).toBe(true);
      expect(res.body.status).toBe('TEAMS_PUBLISHED');
      expect(res.body.published).toBe(true);
      expect(res.body.errors).toEqual([]);
      expect(res.body.permissions).toEqual({ edit: false, publish: false, unpublish: true });
      expect(await statusOf(s.round.id)).toBe('TEAMS_PUBLISHED');

      const seen = await get(s, s.playerUser.id).expect(200);
      expect(seen.body.published).toBe(true);
      expect(seen.body.teams.WHITE.starters).toHaveLength(7);
      expect(seen.body.teams.BLACK.starters).toHaveLength(7);
      expect(seen.body.teams.BLACK.reserves).toHaveLength(1);
      expect(seen.body.errors).toEqual([]);
      expect(seen.body.permissions).toEqual({ edit: false, publish: false, unpublish: false });
    });

    it('C18: escalação incompleta não publica (409 INVALID_LINEUP) e o status não muda', async () => {
      const s = await setup();
      await put(s, s.adminUser.id, {
        ...emptyDraft,
        WHITE: { starters: [{ membershipId: s.ids[0], position: 'GOALKEEPER' }], reserves: [] },
      }).expect(200);

      const res = await post(s, s.adminUser.id, 'publish').expect(409);

      expect(res.body.code).toBe('INVALID_LINEUP');
      expect(res.body.message).toBe(ROUND_TRANSITION_ERROR_LABELS.INVALID_LINEUP);
      expect(await statusOf(s.round.id)).toBe('SCHEDULED');
    });

    it('C18: confirmado fora dos times não publica (409 ATTENDANCE_MISMATCH)', async () => {
      const s = await setup();
      await put(s, s.adminUser.id, fullDraft(s.ids)).expect(200);
      const late = await addMember(t, (await createUser(t)).id, s.group.id);
      await t.prisma.attendance.create({
        data: { roundId: s.round.id, membershipId: late.id, confirmed: true },
      });

      const res = await post(s, s.adminUser.id, 'publish').expect(409);

      expect(res.body).toEqual({
        code: 'ATTENDANCE_MISMATCH',
        message: ROUND_TRANSITION_ERROR_LABELS.ATTENDANCE_MISMATCH,
      });
      expect(await statusOf(s.round.id)).toBe('SCHEDULED');
    });

    it('C18: escalado que desconfirmou não publica (409 ATTENDANCE_MISMATCH)', async () => {
      const s = await setup();
      await put(s, s.adminUser.id, fullDraft(s.ids)).expect(200);
      await t.prisma.attendance.update({
        where: { roundId_membershipId: { roundId: s.round.id, membershipId: s.ids[2]! } },
        data: { confirmed: false },
      });

      const res = await post(s, s.adminUser.id, 'publish').expect(409);
      expect(res.body.code).toBe('ATTENDANCE_MISMATCH');
    });

    it('C19: rodada já publicada não publica de novo (409 INVALID_TRANSITION)', async () => {
      const s = await published();
      const res = await post(s, s.adminUser.id, 'publish').expect(409);
      expect(res.body).toEqual({
        code: 'INVALID_TRANSITION',
        message: ROUND_TRANSITION_ERROR_LABELS.INVALID_TRANSITION,
      });
    });
  });

  describe('POST /lineup/unpublish', () => {
    it('C20: volta para SCHEDULED com o rascunho intacto; o jogador deixa de ver', async () => {
      const s = await published();

      const res = await post(s, s.adminUser.id, 'unpublish').expect(200);

      expect(res.body.status).toBe('SCHEDULED');
      expect(res.body.published).toBe(false);
      expect(res.body.teams.WHITE.starters).toHaveLength(7);
      expect(res.body.permissions).toEqual({ edit: true, publish: true, unpublish: false });
      expect(await t.prisma.teamPlayer.count({ where: { roundId: s.round.id } })).toBe(16);

      const seen = await get(s, s.playerUser.id).expect(200);
      expect(seen.body.teams.WHITE.starters).toEqual([]);
      expect(seen.body.published).toBe(false);
    });

    it('C21: rodada agendada ou em jogo não despublica (409 INVALID_TRANSITION)', async () => {
      const s = await setup();
      const res = await post(s, s.adminUser.id, 'unpublish').expect(409);
      expect(res.body.code).toBe('INVALID_TRANSITION');

      await t.prisma.round.update({ where: { id: s.round.id }, data: { status: 'IN_PROGRESS' } });
      await post(s, s.adminUser.id, 'unpublish').expect(409);
      expect(await statusOf(s.round.id)).toBe('IN_PROGRESS');
    });
  });

  describe('presença mudou com os times publicados', () => {
    it('C22: desconfirmar um escalado e confirmar alguém novo acusa ATTENDANCE_MISMATCH sem mexer nos times', async () => {
      const s = await published();
      await t.prisma.attendance.update({
        where: { roundId_membershipId: { roundId: s.round.id, membershipId: s.ids[3]! } },
        data: { confirmed: false },
      });
      const late = await addMember(t, (await createUser(t)).id, s.group.id);
      await t.prisma.attendance.create({
        data: { roundId: s.round.id, membershipId: late.id, confirmed: true },
      });

      const res = await get(s, s.adminUser.id).expect(200);

      expect(res.body.status).toBe('TEAMS_PUBLISHED');
      expect(res.body.errors).toContain('ATTENDANCE_MISMATCH');
      const starters: { membershipId: string; confirmed: boolean }[] =
        res.body.teams.WHITE.starters;
      expect(starters).toHaveLength(7);
      expect(starters.find((p) => p.membershipId === s.ids[3])?.confirmed).toBe(false);
      expect(idsOf(res.body.unassigned)).toEqual([late.id]);
      expect(res.body.permissions.unpublish).toBe(true);
      expect(await t.prisma.teamPlayer.count({ where: { roundId: s.round.id } })).toBe(16);

      // Para o jogador, o aviso não aparece
      const seen = await get(s, s.playerUser.id).expect(200);
      expect(seen.body.errors).toEqual([]);
    });
  });

  describe('permissão e grupo', () => {
    it('C23: jogador comum não salva, publica nem despublica (403) e nada muda', async () => {
      const s = await setup();
      await put(s, s.playerUser.id, fullDraft(s.ids)).expect(403);
      await post(s, s.playerUser.id, 'publish').expect(403);
      await post(s, s.playerUser.id, 'unpublish').expect(403);
      expect(await t.prisma.teamPlayer.count()).toBe(0);

      const pub = await published();
      await post(pub, pub.playerUser.id, 'unpublish').expect(403);
      expect(await statusOf(pub.round.id)).toBe('TEAMS_PUBLISHED');
    });

    it('C24: rodada de outro grupo é 404 em todas as rotas e nada muda lá', async () => {
      const mine = await setup();
      const other = await setup();
      const path = lineupPath(mine.group.id, other.round.id);
      const cookie = as(mine.adminUser.id);

      await request(server()).get(path).set('Cookie', cookie).expect(404);
      await request(server())
        .put(path)
        .set('Cookie', cookie)
        .send(fullDraft(other.ids))
        .expect(404);
      await request(server()).post(`${path}/publish`).set('Cookie', cookie).expect(404);
      await request(server()).post(`${path}/unpublish`).set('Cookie', cookie).expect(404);

      expect(await t.prisma.teamPlayer.count({ where: { roundId: other.round.id } })).toBe(0);
      expect(await statusOf(other.round.id)).toBe('SCHEDULED');
    });

    it('C24: grupo em que o usuário não é membro, ou é membro inativo, é 404', async () => {
      const s = await setup();
      const outsider = await createUser(t);
      const path = lineupPath(s.group.id, s.round.id);

      await request(server()).get(path).set('Cookie', as(outsider.id)).expect(404);
      await request(server())
        .put(path)
        .set('Cookie', as(outsider.id))
        .send(fullDraft(s.ids))
        .expect(404);

      await t.prisma.membership.update({ where: { id: s.admin.id }, data: { active: false } });
      await get(s, s.adminUser.id).expect(404);
      await put(s, s.adminUser.id, fullDraft(s.ids)).expect(404);
      await post(s, s.adminUser.id, 'publish').expect(404);
      await post(s, s.adminUser.id, 'unpublish').expect(404);
      expect(await t.prisma.teamPlayer.count()).toBe(0);
    });
  });

  describe('POST /lineup/suggestion (seletor-de-times)', () => {
    /** 2 goleiros (ids 0 e 1), 4 zagueiros, 4 alas, 3 meias e 3 atacantes: fecha o 1-2-3-1 com 16. */
    const POSITIONS_16: Position[] = [
      'GOALKEEPER',
      'GOALKEEPER',
      ...Array<Position>(4).fill('DEFENDER'),
      ...Array<Position>(4).fill('WINGER'),
      ...Array<Position>(3).fill('MIDFIELDER'),
      ...Array<Position>(3).fill('FORWARD'),
    ];

    async function setupSuggest() {
      const s = await setup();
      for (const [i, id] of s.ids.entries()) {
        await t.prisma.membership.update({
          where: { id },
          data: { primaryPosition: POSITIONS_16[i]! },
        });
      }
      return s;
    }

    const suggest = (s: Setup, userId: string, body: object = {}) =>
      request(server())
        .post(`${lineupPath(s.group.id, s.round.id)}/suggestion`)
        .set('Cookie', as(userId))
        .send(body);

    /** Quem está com quem, sem lado nem posição. */
    function divisionOf(teams: SaveLineupInput): string {
      const side = (team: 'WHITE' | 'BLACK') =>
        [...teams[team].starters.map((x) => x.membershipId), ...teams[team].reserves]
          .sort()
          .join(',');
      return [side('WHITE'), side('BLACK')].sort().join('|');
    }

    const suggestedIds = (teams: SaveLineupInput) =>
      (['WHITE', 'BLACK'] as const).flatMap((team) => [
        ...teams[team].starters.map((x) => x.membershipId),
        ...teams[team].reserves,
      ]);

    it('seletor C13: admin recebe os 16 nos times (7 + 7, 1-2-3-1, reservas 1 x 1) e nada é gravado', async () => {
      const s = await setupSuggest();

      const res = await suggest(s, s.adminUser.id).expect(200);

      expect(lineupSuggestionSchema.safeParse(res.body).success).toBe(true);
      const { teams } = res.body as { teams: SaveLineupInput };
      for (const team of ['WHITE', 'BLACK'] as const) {
        expect(teams[team].starters.map((x) => x.position).sort()).toEqual(
          [...FORMATION_ORDER].sort(),
        );
        expect(teams[team].reserves).toHaveLength(1);
      }
      expect(suggestedIds(teams).sort()).toEqual([...s.ids].sort());

      expect(await t.prisma.teamPlayer.count()).toBe(0);
      const lineup = await get(s, s.adminUser.id).expect(200);
      expect(lineup.body.teams.WHITE).toEqual({ starters: [], reserves: [] });
      expect(lineup.body.unassigned).toHaveLength(16);
      expect(await statusOf(s.round.id)).toBe('SCHEDULED');
    });

    it('seletor C14: só entram os confirmados ativos do grupo', async () => {
      const s = await setupSuggest();
      // desconfirma um meia, desativa um atacante e põe um não respondeu: sobram 14
      await t.prisma.attendance.update({
        where: { roundId_membershipId: { roundId: s.round.id, membershipId: s.ids[12]! } },
        data: { confirmed: false },
      });
      await t.prisma.membership.update({ where: { id: s.ids[15]! }, data: { active: false } });
      const noAnswerUser = await createUser(t);
      await addMember(t, noAnswerUser.id, s.group.id);
      // outro grupo, com rodada própria e confirmados
      const other = await setup();

      const res = await suggest(s, s.adminUser.id).expect(200);

      const ids = suggestedIds(res.body.teams);
      expect(ids.sort()).toEqual(s.ids.filter((id) => id !== s.ids[12] && id !== s.ids[15]).sort());
      for (const id of other.ids) expect(ids).not.toContain(id);
    });

    it('seletor C15: com o avoid da sugestão anterior vem outra divisão', async () => {
      const s = await setupSuggest(); // notas iguais: há muitas divisões empatadas
      let previous: SaveLineupInput = (await suggest(s, s.adminUser.id).expect(200)).body.teams;

      for (let i = 0; i < 6; i += 1) {
        const res = await suggest(s, s.adminUser.id, { avoid: previous }).expect(200);
        expect(divisionOf(res.body.teams)).not.toBe(divisionOf(previous));
        previous = res.body.teams;
      }
    });

    it('seletor C16: separa a dupla que venceu de goleada nas rodadas jogadas; agendada e de outro grupo não contam', async () => {
      const s = await setupSuggest();
      const other = await setup();
      const day = (n: number) => new Date(Date.now() - n * DAY_MS);
      const pairRound = (
        groupId: string,
        pair: [string, string],
        status: RoundStatus,
        daysAgo: number,
      ) =>
        t.prisma.round.create({
          data: {
            groupId,
            scheduledAt: day(daysAgo),
            status,
            whiteGoals: 4,
            blackGoals: 0,
            teamPlayers: {
              create: pair.map((membershipId) => ({
                membershipId,
                team: 'WHITE' as const,
                position: 'DEFENDER' as const,
                isReserve: false,
              })),
            },
          },
        });
      // zagueiros 2 e 3: venceram juntos 5 vezes (CLOSED, VOTING e IN_PROGRESS contam)
      const played: RoundStatus[] = ['CLOSED', 'CLOSED', 'CLOSED', 'VOTING', 'IN_PROGRESS'];
      for (const [i, status] of played.entries()) {
        await pairRound(s.group.id, [s.ids[2]!, s.ids[3]!], status, 7 * (i + 1));
      }
      // alas 6 e 7: só em rodadas não jogadas do grupo; alas 8 e 9: só em rodadas de outro grupo
      for (let i = 0; i < 5; i += 1) {
        await pairRound(
          s.group.id,
          [s.ids[6]!, s.ids[7]!],
          i % 2 ? 'TEAMS_PUBLISHED' : 'SCHEDULED',
          40 + i,
        );
        await pairRound(other.group.id, [s.ids[8]!, s.ids[9]!], 'CLOSED', 40 + i);
      }

      const together = (teams: SaveLineupInput, a: string, b: string) =>
        (['WHITE', 'BLACK'] as const).some((team) => {
          const ids = [...teams[team].starters.map((x) => x.membershipId), ...teams[team].reserves];
          return ids.includes(a) && ids.includes(b);
        });
      let notPlayedTogether = 0;
      let otherGroupTogether = 0;
      for (let i = 0; i < 30; i += 1) {
        const { teams } = (await suggest(s, s.adminUser.id).expect(200)).body;
        expect(together(teams, s.ids[2]!, s.ids[3]!)).toBe(false);
        if (together(teams, s.ids[6]!, s.ids[7]!)) notPlayedTogether += 1;
        if (together(teams, s.ids[8]!, s.ids[9]!)) otherGroupTogether += 1;
      }
      expect(notPlayedTogether).toBeGreaterThan(0);
      expect(otherGroupTogether).toBeGreaterThan(0);
    });

    it('seletor C17: 409 com o código e o texto do shared (13 confirmados, 1 goleiro, 3 goleiros, 19)', async () => {
      const expectError = async (s: Setup, code: keyof typeof BALANCE_TEAMS_ERROR_LABELS) => {
        const res = await suggest(s, s.adminUser.id).expect(409);
        expect(res.body).toMatchObject({ code, message: BALANCE_TEAMS_ERROR_LABELS[code] });
        expect(await t.prisma.teamPlayer.count()).toBe(0);
      };

      const few = await setupSuggest();
      await t.prisma.attendance.updateMany({
        where: { roundId: few.round.id, membershipId: { in: few.ids.slice(13) } },
        data: { confirmed: false },
      });
      await expectError(few, 'NOT_ENOUGH_PLAYERS');

      const oneGk = await setupSuggest();
      await t.prisma.membership.update({
        where: { id: oneGk.ids[1]! },
        data: { primaryPosition: 'DEFENDER' },
      });
      await expectError(oneGk, 'NOT_ENOUGH_GOALKEEPERS');

      const threeGk = await setupSuggest();
      await t.prisma.membership.update({
        where: { id: threeGk.ids[2]! },
        data: { primaryPosition: 'GOALKEEPER' },
      });
      await expectError(threeGk, 'TOO_MANY_GOALKEEPERS');

      const many = await setupSuggest();
      for (let i = 0; i < 3; i += 1) {
        const user = await createUser(t);
        const member = await addMember(t, user.id, many.group.id);
        await t.prisma.attendance.create({
          data: { roundId: many.round.id, membershipId: member.id, confirmed: true },
        });
      }
      await expectError(many, 'TOO_MANY_PLAYERS');
    });

    it('seletor C18: rodada com os times publicados (ou depois) é 409 LINEUP_NOT_EDITABLE', async () => {
      const s = await setupSuggest();
      for (const status of ['TEAMS_PUBLISHED', 'IN_PROGRESS', 'VOTING', 'CLOSED'] as const) {
        await t.prisma.round.update({ where: { id: s.round.id }, data: { status } });
        const res = await suggest(s, s.adminUser.id).expect(409);
        expect(res.body).toMatchObject({
          code: 'LINEUP_NOT_EDITABLE',
          message: LINEUP_NOT_EDITABLE_LABEL,
        });
      }
    });

    it('seletor C19: avoid fora do schema é 400', async () => {
      const s = await setupSuggest();
      await suggest(s, s.adminUser.id, { avoid: { WHITE: 'x' } }).expect(400);
      await suggest(s, s.adminUser.id, {
        avoid: {
          ...emptyDraft,
          WHITE: { starters: [{ membershipId: s.ids[0], position: 'GOLEIRO' }], reserves: [] },
        },
      }).expect(400);
    });

    it('seletor C20: jogador comum não gera (403)', async () => {
      const s = await setupSuggest();
      await suggest(s, s.playerUser.id).expect(403);
    });

    it('seletor C21: rodada de outro grupo, não membro e membro inativo são 404', async () => {
      const s = await setupSuggest();
      const other = await setupSuggest();
      await request(server())
        .post(`${lineupPath(s.group.id, other.round.id)}/suggestion`)
        .set('Cookie', as(s.adminUser.id))
        .send({})
        .expect(404);

      const outsider = await createUser(t);
      await suggest(s, outsider.id).expect(404);

      await t.prisma.membership.update({ where: { id: s.admin.id }, data: { active: false } });
      await suggest(s, s.adminUser.id).expect(404);
    });
  });
});
