import { DEFAULT_INITIAL_RATING } from '@fut-stats/domain';
import {
  groupResponseSchema,
  invitePreviewSchema,
  inviteSchema,
  JOIN_GROUP_ERROR_LABELS,
  memberSchema,
} from '@fut-stats/shared';
import request from 'supertest';
import { addMember, createGroup, createUser, loginAs } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';

describe('grupos e convite', () => {
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

  const entry = { nickname: 'Baixinho', primaryPosition: 'DEFENDER' };

  describe('POST /api/groups (criar grupo)', () => {
    it('401 sem sessão', async () => {
      await request(server())
        .post('/api/groups')
        .send({ ...entry, name: 'Pelada' })
        .expect(401);
    });

    it('cria o grupo e quem cria vira ADMIN, com nota inicial padrão', async () => {
      const user = await createUser(t);

      const res = await request(server())
        .post('/api/groups')
        .set('Cookie', as(user.id))
        .send({ name: '  Pelada do Zé ', nickname: ' Zé ', primaryPosition: 'FORWARD' })
        .expect(201);

      expect(groupResponseSchema.safeParse(res.body).success).toBe(true);
      expect(res.body).toMatchObject({
        name: 'Pelada do Zé',
        slug: 'pelada-do-ze',
        role: 'ADMIN',
        memberCount: 1,
      });

      const membership = await t.prisma.membership.findUniqueOrThrow({
        where: { userId_groupId: { userId: user.id, groupId: res.body.id } },
      });
      expect(membership).toMatchObject({
        role: 'ADMIN',
        nickname: 'Zé',
        primaryPosition: 'FORWARD',
        secondaryPositions: [],
        initialRating: DEFAULT_INITIAL_RATING,
        active: true,
      });
    });

    it('slug repetido ganha sufixo', async () => {
      const user = await createUser(t);
      const create = () =>
        request(server())
          .post('/api/groups')
          .set('Cookie', as(user.id))
          .send({ ...entry, name: 'Pelada' })
          .expect(201);

      expect((await create()).body.slug).toBe('pelada');
      expect((await create()).body.slug).toBe('pelada-2');
      expect((await create()).body.slug).toBe('pelada-3');
    });

    it.each([
      ['nome vazio', { ...entry, name: '   ' }],
      ['nome longo', { ...entry, name: 'a'.repeat(51) }],
      [
        'apelido com mais de 10 caracteres',
        { name: 'Pelada', nickname: 'a'.repeat(11), primaryPosition: 'DEFENDER' },
      ],
      ['apelido vazio', { name: 'Pelada', nickname: ' ', primaryPosition: 'DEFENDER' }],
      ['posição inválida', { name: 'Pelada', nickname: 'Zé', primaryPosition: 'ZAGUEIRO' }],
      ['sem posição', { name: 'Pelada', nickname: 'Zé' }],
    ])('400 com %s', async (_case, body) => {
      const user = await createUser(t);

      await request(server()).post('/api/groups').set('Cookie', as(user.id)).send(body).expect(400);

      expect(await t.prisma.group.count()).toBe(0);
    });
  });

  describe('GET /api/groups/:groupId (ver grupo)', () => {
    it('membro vê o grupo, o papel dele e o nº de membros ativos', async () => {
      const group = await createGroup(t, { name: 'Pelada X' });
      const player = await createUser(t);
      await addMember(t, player.id, group.id);
      await addMember(t, (await createUser(t)).id, group.id, { role: 'ADMIN' });
      await addMember(t, (await createUser(t)).id, group.id, { active: false });

      const res = await request(server())
        .get(`/api/groups/${group.id}`)
        .set('Cookie', as(player.id))
        .expect(200);

      expect(res.body).toEqual({
        id: group.id,
        name: 'Pelada X',
        slug: group.slug,
        role: 'PLAYER',
        memberCount: 2,
      });
    });

    it('não membro → 404', async () => {
      const group = await createGroup(t);
      const outsider = await createUser(t);

      await request(server())
        .get(`/api/groups/${group.id}`)
        .set('Cookie', as(outsider.id))
        .expect(404);
    });
  });

  describe('GET /api/groups/:groupId/members (membros)', () => {
    it('lista só os membros ativos do grupo, por apelido', async () => {
      const group = await createGroup(t);
      const other = await createGroup(t);
      const viewer = await createUser(t);
      await addMember(t, viewer.id, group.id);
      const admin = await t.prisma.membership.update({
        where: {
          id: (await addMember(t, (await createUser(t)).id, group.id, { role: 'ADMIN' })).id,
        },
        data: { nickname: 'Alemão' },
      });
      await t.prisma.membership.update({
        where: {
          id: (await addMember(t, (await createUser(t)).id, group.id, { active: false })).id,
        },
        data: { nickname: 'Sumido' },
      });
      await addMember(t, (await createUser(t)).id, other.id);

      const res = await request(server())
        .get(`/api/groups/${group.id}/members`)
        .set('Cookie', as(viewer.id))
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body.every((m: unknown) => memberSchema.safeParse(m).success)).toBe(true);
      expect(res.body.map((m: { nickname: string }) => m.nickname)).toEqual(['Alemão', 'Apelido']);
      expect(res.body[0]).toEqual({
        id: admin.id,
        nickname: 'Alemão',
        photoUrl: null,
        role: 'ADMIN',
        primaryPosition: 'MIDFIELDER',
        secondaryPositions: [],
        isHiredGoalkeeper: false,
      });
      expect(res.body[0]).not.toHaveProperty('initialRating');
    });

    it('não membro → 404', async () => {
      const group = await createGroup(t);
      const outsider = await createUser(t);

      await request(server())
        .get(`/api/groups/${group.id}/members`)
        .set('Cookie', as(outsider.id))
        .expect(404);
    });
  });

  describe('convite (admin)', () => {
    it('admin vê o código atual', async () => {
      const group = await createGroup(t);
      const admin = await createUser(t);
      await addMember(t, admin.id, group.id, { role: 'ADMIN' });

      const res = await request(server())
        .get(`/api/groups/${group.id}/invite`)
        .set('Cookie', as(admin.id))
        .expect(200);

      expect(inviteSchema.safeParse(res.body).success).toBe(true);
      expect(res.body).toEqual({ code: group.inviteCode });
    });

    it('admin gera um código novo e o antigo deixa de valer', async () => {
      const group = await createGroup(t);
      const admin = await createUser(t);
      await addMember(t, admin.id, group.id, { role: 'ADMIN' });
      const oldCode = group.inviteCode;

      const res = await request(server())
        .post(`/api/groups/${group.id}/invite`)
        .set('Cookie', as(admin.id))
        .expect(200);

      expect(res.body.code).toEqual(expect.any(String));
      expect(res.body.code).not.toBe(oldCode);
      await request(server()).get(`/api/invites/${oldCode}`).expect(404);
      await request(server()).get(`/api/invites/${res.body.code}`).expect(200);
      const newcomer = await createUser(t);
      await request(server())
        .post(`/api/invites/${oldCode}/join`)
        .set('Cookie', as(newcomer.id))
        .send(entry)
        .expect(404);
    });

    it.each(['get', 'post'] as const)('PLAYER no %s do convite → 403', async (method) => {
      const group = await createGroup(t);
      const player = await createUser(t);
      await addMember(t, player.id, group.id);

      await request(server())
        [method](`/api/groups/${group.id}/invite`)
        .set('Cookie', as(player.id))
        .expect(403);
    });

    it.each(['get', 'post'] as const)('não membro no %s do convite → 404', async (method) => {
      const group = await createGroup(t);
      const outsider = await createUser(t);

      await request(server())
        [method](`/api/groups/${group.id}/invite`)
        .set('Cookie', as(outsider.id))
        .expect(404);
      const unchanged = await t.prisma.group.findUniqueOrThrow({ where: { id: group.id } });
      expect(unchanged.inviteCode).toBe(group.inviteCode);
    });
  });

  describe('GET /api/invites/:code (prévia pública)', () => {
    it('sem login mostra o nome da pelada e quantos membros ativos tem', async () => {
      const group = await createGroup(t, { name: 'Pelada X' });
      await addMember(t, (await createUser(t)).id, group.id, { role: 'ADMIN' });
      await addMember(t, (await createUser(t)).id, group.id, { active: false });

      const res = await request(server()).get(`/api/invites/${group.inviteCode}`).expect(200);

      expect(invitePreviewSchema.safeParse(res.body).success).toBe(true);
      expect(res.body).toEqual({ groupName: 'Pelada X', memberCount: 1 });
    });

    it('código que não existe → 404', async () => {
      await request(server()).get('/api/invites/nao-existe').expect(404);
    });
  });

  describe('POST /api/invites/:code/join (entrar)', () => {
    it('401 sem sessão', async () => {
      const group = await createGroup(t);

      await request(server()).post(`/api/invites/${group.inviteCode}/join`).send(entry).expect(401);
    });

    it('entra como PLAYER, com nota inicial padrão', async () => {
      const group = await createGroup(t, { name: 'Pelada X' });
      await addMember(t, (await createUser(t)).id, group.id, { role: 'ADMIN' });
      const user = await createUser(t);

      const res = await request(server())
        .post(`/api/invites/${group.inviteCode}/join`)
        .set('Cookie', as(user.id))
        .send(entry)
        .expect(201);

      expect(res.body).toEqual({
        id: group.id,
        name: 'Pelada X',
        slug: group.slug,
        role: 'PLAYER',
        memberCount: 2,
      });
      const membership = await t.prisma.membership.findUniqueOrThrow({
        where: { userId_groupId: { userId: user.id, groupId: group.id } },
      });
      expect(membership).toMatchObject({
        role: 'PLAYER',
        nickname: 'Baixinho',
        primaryPosition: 'DEFENDER',
        initialRating: DEFAULT_INITIAL_RATING,
        active: true,
      });
      // Agora é membro: vê o grupo.
      await request(server()).get(`/api/groups/${group.id}`).set('Cookie', as(user.id)).expect(200);
    });

    it('já é membro ativo → 200, não duplica nem muda os dados', async () => {
      const group = await createGroup(t);
      const admin = await createUser(t);
      const existing = await addMember(t, admin.id, group.id, { role: 'ADMIN' });

      const res = await request(server())
        .post(`/api/invites/${group.inviteCode}/join`)
        .set('Cookie', as(admin.id))
        .send(entry)
        .expect(200);

      expect(res.body).toMatchObject({ id: group.id, role: 'ADMIN', memberCount: 1 });
      const memberships = await t.prisma.membership.findMany({ where: { groupId: group.id } });
      expect(memberships).toHaveLength(1);
      expect(memberships[0]).toMatchObject({ id: existing.id, role: 'ADMIN', nickname: 'Apelido' });
    });

    it('membro inativo → 409 MEMBERSHIP_INACTIVE e continua inativo', async () => {
      const group = await createGroup(t);
      const user = await createUser(t);
      await addMember(t, user.id, group.id, { active: false });

      const res = await request(server())
        .post(`/api/invites/${group.inviteCode}/join`)
        .set('Cookie', as(user.id))
        .send(entry)
        .expect(409);

      expect(res.body).toEqual({
        code: 'MEMBERSHIP_INACTIVE',
        message: JOIN_GROUP_ERROR_LABELS.MEMBERSHIP_INACTIVE,
      });
      const membership = await t.prisma.membership.findUniqueOrThrow({
        where: { userId_groupId: { userId: user.id, groupId: group.id } },
      });
      expect(membership.active).toBe(false);
    });

    it('código que não existe → 404', async () => {
      const user = await createUser(t);

      await request(server())
        .post('/api/invites/nao-existe/join')
        .set('Cookie', as(user.id))
        .send(entry)
        .expect(404);
    });

    it('400 com apelido inválido, sem criar membership', async () => {
      const group = await createGroup(t);
      const user = await createUser(t);

      await request(server())
        .post(`/api/invites/${group.inviteCode}/join`)
        .set('Cookie', as(user.id))
        .send({ ...entry, nickname: 'a'.repeat(11) })
        .expect(400);

      expect(await t.prisma.membership.count()).toBe(0);
    });
  });

  describe('isolamento entre grupos', () => {
    it('admin de um grupo não vê nem mexe em outro grupo', async () => {
      const mine = await createGroup(t);
      const theirs = await createGroup(t);
      const admin = await createUser(t);
      await addMember(t, admin.id, mine.id, { role: 'ADMIN' });
      await addMember(t, (await createUser(t)).id, theirs.id, { role: 'ADMIN' });
      const cookie = as(admin.id);

      await request(server()).get(`/api/groups/${theirs.id}`).set('Cookie', cookie).expect(404);
      await request(server())
        .get(`/api/groups/${theirs.id}/members`)
        .set('Cookie', cookie)
        .expect(404);
      await request(server())
        .get(`/api/groups/${theirs.id}/invite`)
        .set('Cookie', cookie)
        .expect(404);
      await request(server())
        .post(`/api/groups/${theirs.id}/invite`)
        .set('Cookie', cookie)
        .expect(404);

      const untouched = await t.prisma.group.findUniqueOrThrow({ where: { id: theirs.id } });
      expect(untouched.inviteCode).toBe(theirs.inviteCode);
    });

    it('a lista de membros não vaza gente de outro grupo', async () => {
      const mine = await createGroup(t);
      const theirs = await createGroup(t);
      const user = await createUser(t);
      await addMember(t, user.id, mine.id);
      await addMember(t, user.id, theirs.id, { role: 'ADMIN' });
      await addMember(t, (await createUser(t)).id, theirs.id);

      const res = await request(server())
        .get(`/api/groups/${mine.id}/members`)
        .set('Cookie', as(user.id))
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].role).toBe('PLAYER');
    });

    it('entrar por um convite só dá acesso àquele grupo', async () => {
      const target = await createGroup(t);
      const other = await createGroup(t);
      const user = await createUser(t);

      await request(server())
        .post(`/api/invites/${target.inviteCode}/join`)
        .set('Cookie', as(user.id))
        .send(entry)
        .expect(201);

      await request(server()).get(`/api/groups/${other.id}`).set('Cookie', as(user.id)).expect(404);
      expect(await t.prisma.membership.count({ where: { groupId: other.id } })).toBe(0);
    });
  });
});
