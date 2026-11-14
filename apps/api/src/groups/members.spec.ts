import { DEFAULT_AVATAR, type PlayerAvatar } from '@fut-stats/domain';
import {
  groupResponseSchema,
  MEMBER_ADMIN_CHANGE_ERROR_LABELS,
  memberSchema,
  meResponseSchema,
  NICKNAME_TAKEN_LABEL,
  NOT_OWN_PROFILE_LABEL,
  PLAYER_POSITIONS_ERROR_LABELS,
  rosterMemberSchema,
  type RosterMember,
} from '@fut-stats/shared';
import request from 'supertest';
import { addMember, createGroup, createUser, loginAs } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';

const ROSE: PlayerAvatar = { skin: 'DARK', hair: 'AFRO', hairColor: 'RED' };
const BLOND: PlayerAvatar = { skin: 'LIGHT', hair: 'MOHAWK', hairColor: 'BLOND' };

describe('perfil do jogador e elenco', () => {
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

  /** Um grupo com um admin, dois jogadores (Zé e Beto) e um inativo (Sumido). Cada um com o seu usuário. */
  async function setup() {
    const group = await createGroup(t);
    const make = async (
      nickname: string,
      data: Parameters<typeof addMember>[3] = {},
      groupId = group.id,
    ) => {
      const user = await createUser(t);
      const membership = await addMember(t, user.id, groupId, { nickname, ...data });
      return { user, membership };
    };
    const admin = await make('Admin', { role: 'ADMIN' });
    const ze = await make('Zé');
    const beto = await make('Beto');
    const sumido = await make('Sumido', { active: false });
    return { group, admin, ze, beto, sumido, make };
  }

  const patchUrl = (groupId: string, membershipId: string) =>
    `/api/groups/${groupId}/members/${membershipId}`;

  async function stored(membershipId: string) {
    return t.prisma.membership.findUniqueOrThrow({ where: { id: membershipId } });
  }

  describe('bonequinho ao criar e entrar', () => {
    it('C9: criar a pelada com avatar; o /me traz apelido e avatar iguais aos enviados', async () => {
      const user = await createUser(t);

      const res = await request(server())
        .post('/api/groups')
        .set('Cookie', as(user.id))
        .send({ name: 'Pelada', nickname: 'Zé', primaryPosition: 'FORWARD', avatar: ROSE })
        .expect(201);
      expect(groupResponseSchema.safeParse(res.body).success).toBe(true);

      const me = await request(server()).get('/api/me').set('Cookie', as(user.id)).expect(200);
      expect(meResponseSchema.safeParse(me.body).success).toBe(true);
      expect(me.body.groups).toEqual([
        expect.objectContaining({
          id: res.body.id,
          membershipId: res.body.membershipId,
          nickname: 'Zé',
          avatar: ROSE,
        }),
      ]);
      expect(await stored(res.body.membershipId)).toMatchObject({
        avatarSkin: 'DARK',
        avatarHair: 'AFRO',
        avatarHairColor: 'RED',
      });
    });

    it('C9: criar sem avatar usa o DEFAULT_AVATAR', async () => {
      const user = await createUser(t);

      await request(server())
        .post('/api/groups')
        .set('Cookie', as(user.id))
        .send({ name: 'Pelada', nickname: 'Zé', primaryPosition: 'FORWARD' })
        .expect(201);

      const me = await request(server()).get('/api/me').set('Cookie', as(user.id)).expect(200);
      expect(me.body.groups[0].avatar).toEqual(DEFAULT_AVATAR);
    });

    it('C9: avatar fora das listas → 400 e nada criado', async () => {
      const user = await createUser(t);

      await request(server())
        .post('/api/groups')
        .set('Cookie', as(user.id))
        .send({
          name: 'Pelada',
          nickname: 'Zé',
          primaryPosition: 'FORWARD',
          avatar: { ...ROSE, skin: 'GREEN' },
        })
        .expect(400);

      expect(await t.prisma.group.count()).toBe(0);
    });

    it('C10: entrar pelo convite sem avatar grava o DEFAULT_AVATAR', async () => {
      const { group } = await setup();
      const user = await createUser(t);

      const res = await request(server())
        .post(`/api/invites/${group.inviteCode}/join`)
        .set('Cookie', as(user.id))
        .send({ nickname: 'Novato', primaryPosition: 'DEFENDER' })
        .expect(201);

      const row = await stored(res.body.membershipId);
      expect({
        skin: row.avatarSkin,
        hair: row.avatarHair,
        hairColor: row.avatarHairColor,
      }).toEqual(DEFAULT_AVATAR);
      const me = await request(server()).get('/api/me').set('Cookie', as(user.id)).expect(200);
      expect(me.body.groups[0]).toMatchObject({ nickname: 'Novato', avatar: DEFAULT_AVATAR });
    });

    it('C10: entrar com avatar grava o escolhido', async () => {
      const { group } = await setup();
      const user = await createUser(t);

      const res = await request(server())
        .post(`/api/invites/${group.inviteCode}/join`)
        .set('Cookie', as(user.id))
        .send({ nickname: 'Novato', primaryPosition: 'DEFENDER', avatar: BLOND })
        .expect(201);

      const me = await request(server()).get('/api/me').set('Cookie', as(user.id)).expect(200);
      expect(me.body.groups[0].avatar).toEqual(BLOND);
      expect((await stored(res.body.membershipId)).avatarHair).toBe('MOHAWK');
    });

    it('C11: apelido de um ativo (ignora maiúscula e acento) → 409 NICKNAME_TAKEN, nada criado', async () => {
      const { group, make } = await setup();
      await make('Álvaro');
      const before = await t.prisma.membership.count();

      for (const nickname of ['beto', 'BETO ', 'alvaro']) {
        const user = await createUser(t);
        const res = await request(server())
          .post(`/api/invites/${group.inviteCode}/join`)
          .set('Cookie', as(user.id))
          .send({ nickname, primaryPosition: 'DEFENDER' })
          .expect(409);
        expect(res.body).toEqual({ code: 'NICKNAME_TAKEN', message: NICKNAME_TAKEN_LABEL });
      }
      expect(await t.prisma.membership.count()).toBe(before);
    });

    it('C11: em outro grupo o mesmo apelido passa, e apelido de inativo não prende', async () => {
      const { group } = await setup();
      const otherGroup = await createGroup(t);
      const user = await createUser(t);

      await request(server())
        .post(`/api/invites/${otherGroup.inviteCode}/join`)
        .set('Cookie', as(user.id))
        .send({ nickname: 'Beto', primaryPosition: 'DEFENDER' })
        .expect(201);

      const other = await createUser(t);
      await request(server())
        .post(`/api/invites/${group.inviteCode}/join`)
        .set('Cookie', as(other.id))
        .send({ nickname: 'Sumido', primaryPosition: 'DEFENDER' })
        .expect(201);
    });

    it('C11: quem já é membro ativo e entra de novo com apelido igual ao seu segue com 200', async () => {
      const { group, ze } = await setup();

      await request(server())
        .post(`/api/invites/${group.inviteCode}/join`)
        .set('Cookie', as(ze.user.id))
        .send({ nickname: 'Zé', primaryPosition: 'DEFENDER' })
        .expect(200);
    });

    it('C12: dois joins ao mesmo tempo com o mesmo apelido → um 201 e um 409 NICKNAME_TAKEN', async () => {
      const { group } = await setup();
      const [a, b] = [await createUser(t), await createUser(t)];
      const before = await t.prisma.membership.count();

      const join = (userId: string) =>
        request(server())
          .post(`/api/invites/${group.inviteCode}/join`)
          .set('Cookie', as(userId))
          .send({ nickname: 'Gêmeo', primaryPosition: 'DEFENDER' });
      const results = await Promise.all([join(a.id), join(b.id)]);

      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      const conflict = results.find((r) => r.status === 409)!;
      expect(conflict.body).toEqual({ code: 'NICKNAME_TAKEN', message: NICKNAME_TAKEN_LABEL });
      expect(await t.prisma.membership.count()).toBe(before + 1);
    });
  });

  describe('PATCH /groups/:groupId/members/:membershipId', () => {
    it('401 sem sessão', async () => {
      const { group, ze } = await setup();

      await request(server())
        .patch(patchUrl(group.id, ze.membership.id))
        .send({ nickname: 'Novo' })
        .expect(401);
    });

    it('C13: o próprio edita apelido, avatar, principal e secundárias; as listas já mostram o novo', async () => {
      const { group, admin, ze } = await setup();
      const round = await t.prisma.round.create({
        data: { groupId: group.id, scheduledAt: new Date('2026-12-01T23:00:00Z') },
      });

      const res = await request(server())
        .patch(patchUrl(group.id, ze.membership.id))
        .set('Cookie', as(ze.user.id))
        .send({
          nickname: 'Zezinho',
          avatar: ROSE,
          primaryPosition: 'FORWARD',
          secondaryPositions: ['WINGER', 'MIDFIELDER'],
        })
        .expect(200);

      expect(memberSchema.safeParse(res.body).success).toBe(true);
      expect(res.body).toEqual({
        id: ze.membership.id,
        nickname: 'Zezinho',
        photoUrl: null,
        role: 'PLAYER',
        primaryPosition: 'FORWARD',
        secondaryPositions: ['WINGER', 'MIDFIELDER'],
        isHiredGoalkeeper: false,
        avatar: ROSE,
      });
      // jogador comum não recebe o que é do admin
      expect(res.body).not.toHaveProperty('initialRating');
      expect(res.body).not.toHaveProperty('active');

      const list = await request(server())
        .get(`/api/groups/${group.id}/members`)
        .set('Cookie', as(admin.user.id))
        .expect(200);
      expect(list.body.find((m: { id: string }) => m.id === ze.membership.id)).toEqual(res.body);

      const detail = await request(server())
        .get(`/api/groups/${group.id}/rounds/${round.id}`)
        .set('Cookie', as(admin.user.id))
        .expect(200);
      const attendance = [
        ...detail.body.attendance.pending,
        ...detail.body.attendance.confirmed,
        ...detail.body.attendance.declined,
      ];
      expect(
        attendance.find((m: { membershipId: string }) => m.membershipId === ze.membership.id),
      ).toMatchObject({ nickname: 'Zezinho', avatar: ROSE, primaryPosition: 'FORWARD' });
    });

    it('C13: muda só o que veio (o resto fica)', async () => {
      const { group, ze } = await setup();
      await t.prisma.membership.update({
        where: { id: ze.membership.id },
        data: { secondaryPositions: ['DEFENDER'] },
      });

      await request(server())
        .patch(patchUrl(group.id, ze.membership.id))
        .set('Cookie', as(ze.user.id))
        .send({ avatar: BLOND })
        .expect(200);

      expect(await stored(ze.membership.id)).toMatchObject({
        nickname: 'Zé',
        primaryPosition: 'MIDFIELDER',
        secondaryPositions: ['DEFENDER'],
        avatarSkin: 'LIGHT',
        avatarHair: 'MOHAWK',
        avatarHairColor: 'BLOND',
      });
    });

    it('C13: corpo vazio, campo inválido e avatar fora da lista → 400', async () => {
      const { group, ze } = await setup();
      const patch = (body: object) =>
        request(server())
          .patch(patchUrl(group.id, ze.membership.id))
          .set('Cookie', as(ze.user.id))
          .send(body);

      await patch({}).expect(400);
      await patch({ nickname: 'a'.repeat(11) }).expect(400);
      await patch({ avatar: { ...ROSE, hair: 'MULLET' } }).expect(400);
      await patch({ avatar: { skin: 'DARK' } }).expect(400);
      await patch({ primaryPosition: 'ZAGUEIRO' }).expect(400);
      expect((await stored(ze.membership.id)).nickname).toBe('Zé');
    });

    it('C14: apelido de outro ativo → 409 NICKNAME_TAKEN; mudar só a maiúscula do próprio → 200', async () => {
      const { group, ze } = await setup();

      const taken = await request(server())
        .patch(patchUrl(group.id, ze.membership.id))
        .set('Cookie', as(ze.user.id))
        .send({ nickname: 'bETO' })
        .expect(409);
      expect(taken.body).toEqual({ code: 'NICKNAME_TAKEN', message: NICKNAME_TAKEN_LABEL });
      expect((await stored(ze.membership.id)).nickname).toBe('Zé');

      await request(server())
        .patch(patchUrl(group.id, ze.membership.id))
        .set('Cookie', as(ze.user.id))
        .send({ nickname: 'ZÉ' })
        .expect(200);
      expect((await stored(ze.membership.id)).nickname).toBe('ZÉ');
    });

    it('C14: apelido de inativo e de outro grupo não bloqueiam', async () => {
      const { group, ze, make } = await setup();
      const otherGroup = await createGroup(t);
      await make('Fora', {}, otherGroup.id);

      await request(server())
        .patch(patchUrl(group.id, ze.membership.id))
        .set('Cookie', as(ze.user.id))
        .send({ nickname: 'Sumido' })
        .expect(200);
      await request(server())
        .patch(patchUrl(group.id, ze.membership.id))
        .set('Cookie', as(ze.user.id))
        .send({ nickname: 'fora' })
        .expect(200);
    });

    it.each([
      [
        'secundária igual à principal',
        { primaryPosition: 'DEFENDER', secondaryPositions: ['DEFENDER'] },
        'SECONDARY_IS_PRIMARY',
      ],
      [
        'secundária repetida',
        { primaryPosition: 'DEFENDER', secondaryPositions: ['WINGER', 'WINGER'] },
        'DUPLICATE_SECONDARY',
      ],
      [
        'goleiro como secundária',
        { primaryPosition: 'DEFENDER', secondaryPositions: ['GOALKEEPER'] },
        'GOALKEEPER_AS_SECONDARY',
      ],
      [
        'três secundárias',
        { primaryPosition: 'DEFENDER', secondaryPositions: ['WINGER', 'MIDFIELDER', 'FORWARD'] },
        'TOO_MANY_SECONDARIES',
      ],
      [
        'goleiro com secundária',
        { primaryPosition: 'GOALKEEPER', secondaryPositions: ['DEFENDER'] },
        'GOALKEEPER_HAS_SECONDARY',
      ],
      // O estado final conta: a principal sozinha, com as secundárias que já estavam
      [
        'virar goleiro tendo secundárias salvas',
        { primaryPosition: 'GOALKEEPER' },
        'GOALKEEPER_HAS_SECONDARY',
      ],
      [
        'secundária nova igual à principal salva',
        { secondaryPositions: ['MIDFIELDER'] },
        'SECONDARY_IS_PRIMARY',
      ],
    ] as const)('C15: %s → 400 com o texto do shared', async (_case, body, code) => {
      const { group, ze } = await setup();
      await t.prisma.membership.update({
        where: { id: ze.membership.id },
        data: { secondaryPositions: ['WINGER'] },
      });

      const res = await request(server())
        .patch(patchUrl(group.id, ze.membership.id))
        .set('Cookie', as(ze.user.id))
        .send(body)
        .expect(400);

      expect(res.body.issues.map((i: { message: string }) => i.message)).toContain(
        PLAYER_POSITIONS_ERROR_LABELS[code],
      );
      expect((await stored(ze.membership.id)).secondaryPositions).toEqual(['WINGER']);
    });

    it('C15: vários problemas vêm todos na mesma resposta', async () => {
      const { group, ze } = await setup();

      const res = await request(server())
        .patch(patchUrl(group.id, ze.membership.id))
        .set('Cookie', as(ze.user.id))
        .send({
          primaryPosition: 'DEFENDER',
          secondaryPositions: ['DEFENDER', 'GOALKEEPER', 'WINGER'],
        })
        .expect(400);

      expect(res.body.issues.map((i: { message: string }) => i.message)).toEqual([
        PLAYER_POSITIONS_ERROR_LABELS.SECONDARY_IS_PRIMARY,
        PLAYER_POSITIONS_ERROR_LABELS.GOALKEEPER_AS_SECONDARY,
        PLAYER_POSITIONS_ERROR_LABELS.TOO_MANY_SECONDARIES,
      ]);
    });

    it('C16: jogador comum editando outro membro → 403 NOT_OWN_PROFILE, nada muda', async () => {
      const { group, ze, beto } = await setup();

      const res = await request(server())
        .patch(patchUrl(group.id, beto.membership.id))
        .set('Cookie', as(ze.user.id))
        .send({ nickname: 'Invasor', avatar: ROSE })
        .expect(403);

      expect(res.body).toEqual({ code: 'NOT_OWN_PROFILE', message: NOT_OWN_PROFILE_LABEL });
      expect(await stored(beto.membership.id)).toMatchObject({
        nickname: 'Beto',
        avatarSkin: 'TAN',
      });
    });

    it.each([
      ['initialRating', { initialRating: 9 }],
      ['isHiredGoalkeeper', { isHiredGoalkeeper: true }],
      ['role', { role: 'ADMIN' }],
      ['active', { active: false }],
    ])(
      'C17: jogador comum com %s no próprio perfil → 403 NOT_ADMIN, nem o resto do pedido muda',
      async (_field, extra) => {
        const { group, ze } = await setup();

        const res = await request(server())
          .patch(patchUrl(group.id, ze.membership.id))
          .set('Cookie', as(ze.user.id))
          .send({ nickname: 'Novo', ...extra })
          .expect(403);

        expect(res.body.code).toBe('NOT_ADMIN');
        expect(typeof res.body.message).toBe('string');
        expect(await stored(ze.membership.id)).toMatchObject({
          nickname: 'Zé',
          initialRating: 6,
          isHiredGoalkeeper: false,
          role: 'PLAYER',
          active: true,
        });
      },
    );

    it('C18: admin muda nota inicial e goleiro contratado de outro; a presença e o ranking mostram', async () => {
      const { group, admin, ze, beto } = await setup();
      const round = await t.prisma.round.create({
        data: { groupId: group.id, scheduledAt: new Date('2026-12-01T23:00:00Z') },
      });

      const res = await request(server())
        .patch(patchUrl(group.id, ze.membership.id))
        .set('Cookie', as(admin.user.id))
        .send({ initialRating: 7.5, isHiredGoalkeeper: true })
        .expect(200);

      const body = res.body as RosterMember;
      expect(rosterMemberSchema.safeParse(body).success).toBe(true);
      expect(body).toMatchObject({
        id: ze.membership.id,
        initialRating: 7.5,
        isHiredGoalkeeper: true,
        active: true,
        role: 'PLAYER',
      });

      const detail = await request(server())
        .get(`/api/groups/${group.id}/rounds/${round.id}`)
        .set('Cookie', as(admin.user.id))
        .expect(200);
      const byId = new Map<string, { rating: number; rank: number; isHiredGoalkeeper: boolean }>(
        detail.body.attendance.pending.map((m: { membershipId: string }) => [m.membershipId, m]),
      );
      expect(byId.get(ze.membership.id)).toMatchObject({
        rating: 7.5,
        rank: 1,
        isHiredGoalkeeper: true,
      });
      expect(byId.get(beto.membership.id)).toMatchObject({ rating: 6, rank: 2 });
    });

    it('C18: admin edita o perfil de outro (apelido, avatar, posições) e responde RosterMember', async () => {
      const { group, admin, beto } = await setup();

      const res = await request(server())
        .patch(patchUrl(group.id, beto.membership.id))
        .set('Cookie', as(admin.user.id))
        .send({ nickname: 'Betão', avatar: BLOND, primaryPosition: 'GOALKEEPER' })
        .expect(200);

      expect(rosterMemberSchema.safeParse(res.body).success).toBe(true);
      expect(res.body).toMatchObject({ nickname: 'Betão', avatar: BLOND, initialRating: 6 });
    });

    it.each([7.3, 11, -0.5, '7'])(
      'C19: nota inicial %p → 400, nada muda',
      async (initialRating) => {
        const { group, admin, ze } = await setup();

        await request(server())
          .patch(patchUrl(group.id, ze.membership.id))
          .set('Cookie', as(admin.user.id))
          .send({ initialRating })
          .expect(400);

        expect((await stored(ze.membership.id)).initialRating).toBe(6);
      },
    );

    it('C20: admin torna outro membro admin; o novo admin passa numa rota de admin', async () => {
      const { group, admin, ze } = await setup();
      await request(server())
        .get(`/api/groups/${group.id}/invite`)
        .set('Cookie', as(ze.user.id))
        .expect(403);

      const res = await request(server())
        .patch(patchUrl(group.id, ze.membership.id))
        .set('Cookie', as(admin.user.id))
        .send({ role: 'ADMIN' })
        .expect(200);
      expect(res.body.role).toBe('ADMIN');

      await request(server())
        .get(`/api/groups/${group.id}/invite`)
        .set('Cookie', as(ze.user.id))
        .expect(200);
    });

    it('C20: admin tira o admin de outro admin', async () => {
      const { group, admin, make } = await setup();
      const other = await make('Outro', { role: 'ADMIN' });

      await request(server())
        .patch(patchUrl(group.id, other.membership.id))
        .set('Cookie', as(admin.user.id))
        .send({ role: 'PLAYER' })
        .expect(200);

      expect((await stored(other.membership.id)).role).toBe('PLAYER');
    });

    it.each([
      ['o próprio papel', { role: 'PLAYER' }],
      ['desativar a si mesmo', { active: false }],
      ['papel e ativo juntos', { role: 'PLAYER', active: false }],
    ])('C21: admin mudando %s → 409 SELF_CHANGE, nada muda', async (_case, change) => {
      const { group, admin } = await setup();

      const res = await request(server())
        .patch(patchUrl(group.id, admin.membership.id))
        .set('Cookie', as(admin.user.id))
        .send({ nickname: 'Chefe', ...change })
        .expect(409);

      expect(res.body).toEqual({
        code: 'SELF_CHANGE',
        message: MEMBER_ADMIN_CHANGE_ERROR_LABELS.SELF_CHANGE,
      });
      expect(await stored(admin.membership.id)).toMatchObject({
        nickname: 'Admin',
        role: 'ADMIN',
        active: true,
      });
    });

    it('C21: admin muda a própria nota e o próprio goleiro contratado; repetir o papel atual não é mudança', async () => {
      const { group, admin } = await setup();

      await request(server())
        .patch(patchUrl(group.id, admin.membership.id))
        .set('Cookie', as(admin.user.id))
        .send({ initialRating: 8, isHiredGoalkeeper: true, role: 'ADMIN', active: true })
        .expect(200);

      expect(await stored(admin.membership.id)).toMatchObject({
        initialRating: 8,
        isHiredGoalkeeper: true,
        role: 'ADMIN',
        active: true,
      });
    });

    it('C21: dois admins se tirando o admin ao mesmo tempo: um passa e o outro já não é admin', async () => {
      const { group, admin, make } = await setup();
      const other = await make('Outro', { role: 'ADMIN' });

      const demote = (actor: string, target: string) =>
        request(server())
          .patch(patchUrl(group.id, target))
          .set('Cookie', as(actor))
          .send({ role: 'PLAYER' });
      const results = await Promise.all([
        demote(admin.user.id, other.membership.id),
        demote(other.user.id, admin.membership.id),
      ]);

      expect(results.map((r) => r.status).sort()).toEqual([200, 403]);
      // o que perdeu o admin na fila já é jogador comum mexendo em outro membro
      expect(results.find((r) => r.status === 403)!.body.code).toBe('NOT_OWN_PROFILE');
      expect(await t.prisma.membership.count({ where: { groupId: group.id, role: 'ADMIN' } })).toBe(
        1,
      );
    });

    it('C22: admin desativa outro: some da lista, perde o acesso e não volta pelo convite, mas segue no elenco', async () => {
      const { group, admin, ze } = await setup();

      const res = await request(server())
        .patch(patchUrl(group.id, ze.membership.id))
        .set('Cookie', as(admin.user.id))
        .send({ active: false })
        .expect(200);
      expect(res.body.active).toBe(false);

      const members = await request(server())
        .get(`/api/groups/${group.id}/members`)
        .set('Cookie', as(admin.user.id))
        .expect(200);
      expect(members.body.map((m: { id: string }) => m.id)).not.toContain(ze.membership.id);

      for (const path of [
        `/api/groups/${group.id}`,
        `/api/groups/${group.id}/members`,
        `/api/groups/${group.id}/rounds`,
      ]) {
        await request(server()).get(path).set('Cookie', as(ze.user.id)).expect(404);
      }
      const join = await request(server())
        .post(`/api/invites/${group.inviteCode}/join`)
        .set('Cookie', as(ze.user.id))
        .send({ nickname: 'Zé', primaryPosition: 'DEFENDER' })
        .expect(409);
      expect(join.body.code).toBe('MEMBERSHIP_INACTIVE');

      const roster = await request(server())
        .get(`/api/groups/${group.id}/roster`)
        .set('Cookie', as(admin.user.id))
        .expect(200);
      expect(roster.body.find((m: { id: string }) => m.id === ze.membership.id)).toMatchObject({
        active: false,
      });
      // a participação continua no banco (o histórico aponta para ela)
      expect(await stored(ze.membership.id)).toMatchObject({ active: false, nickname: 'Zé' });
    });

    it('C23: reativar com o apelido tomado → 409; com apelido novo no mesmo pedido → 200', async () => {
      const { group, admin, sumido, make } = await setup();
      // outro ativo pega o apelido do inativo depois
      await make('sumido');

      const taken = await request(server())
        .patch(patchUrl(group.id, sumido.membership.id))
        .set('Cookie', as(admin.user.id))
        .send({ active: true })
        .expect(409);
      expect(taken.body).toEqual({ code: 'NICKNAME_TAKEN', message: NICKNAME_TAKEN_LABEL });
      expect((await stored(sumido.membership.id)).active).toBe(false);

      const ok = await request(server())
        .patch(patchUrl(group.id, sumido.membership.id))
        .set('Cookie', as(admin.user.id))
        .send({ active: true, nickname: 'Voltei' })
        .expect(200);
      expect(ok.body).toMatchObject({ active: true, nickname: 'Voltei' });
      expect(await stored(sumido.membership.id)).toMatchObject({
        active: true,
        nickname: 'Voltei',
      });
    });

    it('C23: reativar sem conflito e depois entrar pelo convite funciona', async () => {
      const { group, admin, sumido } = await setup();

      await request(server())
        .patch(patchUrl(group.id, sumido.membership.id))
        .set('Cookie', as(admin.user.id))
        .send({ active: true })
        .expect(200);

      await request(server())
        .post(`/api/invites/${group.inviteCode}/join`)
        .set('Cookie', as(sumido.user.id))
        .send({ nickname: 'Sumido', primaryPosition: 'DEFENDER' })
        .expect(200);
    });

    it('C23: dois pedidos ao mesmo tempo para ativar e trocar apelidos para o mesmo valor: um passa e um leva 409', async () => {
      const { group, admin, ze, beto } = await setup();

      const rename = (target: string) =>
        request(server())
          .patch(patchUrl(group.id, target))
          .set('Cookie', as(admin.user.id))
          .send({ nickname: 'Mesmo' });
      const results = await Promise.all([rename(ze.membership.id), rename(beto.membership.id)]);

      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(
        await t.prisma.membership.count({ where: { groupId: group.id, nickname: 'Mesmo' } }),
      ).toBe(1);
    });
  });

  describe('GET /groups/:groupId/roster', () => {
    it('C24: admin vê todos, ativos primeiro, cada bloco por apelido, com os campos do elenco', async () => {
      const { group, admin, make } = await setup();
      await make('álvaro', { avatarSkin: 'DARK', avatarHair: 'AFRO', avatarHairColor: 'RED' });
      await make('Carlos', { active: false, initialRating: 8.5, isHiredGoalkeeper: true });
      const other = await createGroup(t);
      await make('Estranho', {}, other.id);

      const res = await request(server())
        .get(`/api/groups/${group.id}/roster`)
        .set('Cookie', as(admin.user.id))
        .expect(200);

      expect(res.body.every((m: unknown) => rosterMemberSchema.safeParse(m).success)).toBe(true);
      expect(res.body.map((m: { nickname: string }) => m.nickname)).toEqual([
        'Admin',
        'álvaro',
        'Beto',
        'Zé',
        'Carlos',
        'Sumido',
      ]);
      expect(res.body.map((m: { active: boolean }) => m.active)).toEqual([
        true,
        true,
        true,
        true,
        false,
        false,
      ]);
      expect(res.body[1]).toMatchObject({
        role: 'PLAYER',
        initialRating: 6,
        isHiredGoalkeeper: false,
        avatar: { skin: 'DARK', hair: 'AFRO', hairColor: 'RED' },
      });
      expect(res.body[0].role).toBe('ADMIN');
      expect(res.body[4]).toMatchObject({ initialRating: 8.5, isHiredGoalkeeper: true });
    });

    it('C25: jogador comum → 403', async () => {
      const { group, ze } = await setup();

      await request(server())
        .get(`/api/groups/${group.id}/roster`)
        .set('Cookie', as(ze.user.id))
        .expect(403);
    });
  });

  describe('GET /groups/:groupId/members/:membershipId', () => {
    it('C26: membro vê um ativo (Member, sem nota) com o avatar', async () => {
      const { group, ze, beto } = await setup();
      await t.prisma.membership.update({
        where: { id: beto.membership.id },
        data: { avatarSkin: 'DARK', avatarHair: 'AFRO', avatarHairColor: 'RED' },
      });

      const res = await request(server())
        .get(patchUrl(group.id, beto.membership.id))
        .set('Cookie', as(ze.user.id))
        .expect(200);

      expect(memberSchema.safeParse(res.body).success).toBe(true);
      expect(res.body).toMatchObject({ id: beto.membership.id, nickname: 'Beto', avatar: ROSE });
      expect(res.body).not.toHaveProperty('initialRating');
    });

    it('C26: um inativo → 404 para o jogador e 200 para o admin', async () => {
      const { group, admin, ze, sumido } = await setup();

      await request(server())
        .get(patchUrl(group.id, sumido.membership.id))
        .set('Cookie', as(ze.user.id))
        .expect(404);
      const res = await request(server())
        .get(patchUrl(group.id, sumido.membership.id))
        .set('Cookie', as(admin.user.id))
        .expect(200);
      expect(res.body).toMatchObject({ id: sumido.membership.id, nickname: 'Sumido' });
    });

    it('C26: id que não existe → 404', async () => {
      const { group, admin } = await setup();

      await request(server())
        .get(patchUrl(group.id, 'nao-existe'))
        .set('Cookie', as(admin.user.id))
        .expect(404);
    });
  });

  describe('isolamento entre grupos', () => {
    it('C27: quem não é membro leva 404 em tudo e nada muda', async () => {
      const { group, ze } = await setup();
      const outsider = await createUser(t);
      const as_ = as(outsider.id);

      await request(server()).get(`/api/groups/${group.id}/roster`).set('Cookie', as_).expect(404);
      await request(server())
        .get(patchUrl(group.id, ze.membership.id))
        .set('Cookie', as_)
        .expect(404);
      await request(server())
        .patch(patchUrl(group.id, ze.membership.id))
        .set('Cookie', as_)
        .send({ nickname: 'Invasor' })
        .expect(404);

      expect((await stored(ze.membership.id)).nickname).toBe('Zé');
    });

    it('C27: membro inativo leva 404 em tudo, até no próprio perfil', async () => {
      const { group, sumido, ze } = await setup();
      const cookie = as(sumido.user.id);

      await request(server())
        .get(`/api/groups/${group.id}/roster`)
        .set('Cookie', cookie)
        .expect(404);
      await request(server())
        .get(patchUrl(group.id, ze.membership.id))
        .set('Cookie', cookie)
        .expect(404);
      await request(server())
        .patch(patchUrl(group.id, sumido.membership.id))
        .set('Cookie', cookie)
        .send({ nickname: 'Volto' })
        .expect(404);

      expect((await stored(sumido.membership.id)).nickname).toBe('Sumido');
    });

    it('C27: admin de outro grupo não vê nem mexe em membro daqui', async () => {
      const { group, ze, make } = await setup();
      const otherGroup = await createGroup(t);
      const foreignAdmin = await make('Chefão', { role: 'ADMIN' }, otherGroup.id);

      // usa o grupo dele com o id de membro de outro grupo
      await request(server())
        .get(patchUrl(otherGroup.id, ze.membership.id))
        .set('Cookie', as(foreignAdmin.user.id))
        .expect(404);
      await request(server())
        .patch(patchUrl(otherGroup.id, ze.membership.id))
        .set('Cookie', as(foreignAdmin.user.id))
        .send({ nickname: 'Invasor', role: 'ADMIN', active: false })
        .expect(404);
      // e o grupo daqui não abre para ele
      await request(server())
        .patch(patchUrl(group.id, ze.membership.id))
        .set('Cookie', as(foreignAdmin.user.id))
        .send({ nickname: 'Invasor' })
        .expect(404);

      expect(await stored(ze.membership.id)).toMatchObject({
        nickname: 'Zé',
        role: 'PLAYER',
        active: true,
      });
    });

    it('C27: roster de outro grupo não mistura membros', async () => {
      const { group, admin, make } = await setup();
      const otherGroup = await createGroup(t);
      await make('Fora', {}, otherGroup.id);

      const res = await request(server())
        .get(`/api/groups/${group.id}/roster`)
        .set('Cookie', as(admin.user.id))
        .expect(200);

      expect(res.body.map((m: { nickname: string }) => m.nickname)).not.toContain('Fora');
    });
  });
});
