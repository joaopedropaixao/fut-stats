import { DEFAULT_INITIAL_RATING } from '@fut-stats/domain';
import {
  groupResponseSchema,
  invitePreviewSchema,
  inviteSchema,
  memberSchema,
} from '@fut-stats/shared';
import { ForbiddenException } from '@nestjs/common';
import request from 'supertest';
import { addMember, createGroup, createUser, loginAs } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';
import { GroupsService } from './groups.service';

/** Casos de borda (QA adversarial) de grupos e convite, além do caminho feliz de groups.spec.ts. */
describe('grupos e convite: casos de borda', () => {
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

  const createVia = (userId: string, name: string, extra: Record<string, unknown> = {}) =>
    request(server())
      .post('/api/groups')
      .set('Cookie', as(userId))
      .send({ ...entry, name, ...extra });

  const join = (userId: string, code: string, body: unknown = entry) =>
    request(server())
      .post(`/api/invites/${code}/join`)
      .set('Cookie', as(userId))
      .send(body as object);

  /** Grupo com slug fixo, para montar colisões. */
  const groupWithSlug = (slug: string) => t.prisma.group.create({ data: { name: slug, slug } });

  describe('concorrência', () => {
    it('o mesmo usuário entrando 5 vezes ao mesmo tempo: uma membership só, sem 500', async () => {
      const group = await createGroup(t);
      const user = await createUser(t);

      const responses = await Promise.all(
        Array.from({ length: 5 }, () => join(user.id, group.inviteCode)),
      );

      const statuses = responses.map((r) => r.status).sort();
      expect(statuses.every((s) => s === 200 || s === 201)).toBe(true);
      expect(statuses.filter((s) => s === 201)).toHaveLength(1);
      expect(responses.every((r) => r.body.role === 'PLAYER')).toBe(true);
      expect(await t.prisma.membership.count({ where: { groupId: group.id } })).toBe(1);
    });

    it('6 grupos com o mesmo nome ao mesmo tempo: todos 201, slugs distintos, sem 500', async () => {
      const user = await createUser(t);

      const responses = await Promise.all(
        Array.from({ length: 6 }, () => createVia(user.id, 'Pelada')),
      );

      expect(responses.map((r) => r.status)).toEqual(Array(6).fill(201));
      const slugs = responses.map((r) => r.body.slug as string);
      expect(new Set(slugs).size).toBe(6);
      expect(await t.prisma.group.count()).toBe(6);
    });

    it('gerar o convite duas vezes ao mesmo tempo: só o código que ficou no banco vale', async () => {
      const group = await createGroup(t);
      const admin = await createUser(t);
      await addMember(t, admin.id, group.id, { role: 'ADMIN' });

      const [a, b] = await Promise.all([
        request(server()).post(`/api/groups/${group.id}/invite`).set('Cookie', as(admin.id)),
        request(server()).post(`/api/groups/${group.id}/invite`).set('Cookie', as(admin.id)),
      ]);

      expect([a.status, b.status]).toEqual([200, 200]);
      const { inviteCode } = await t.prisma.group.findUniqueOrThrow({ where: { id: group.id } });
      expect([a.body.code, b.body.code]).toContain(inviteCode);
      const stale = a.body.code === inviteCode ? b.body.code : a.body.code;
      await request(server()).get(`/api/invites/${stale}`).expect(404);
    });
  });

  describe('slug', () => {
    it.each([
      ['só emoji', '⚽🔥'],
      ['só símbolos', '!!! ### ***'],
      ['só letras fora do ASCII', 'ßßß'],
    ])('nome com %s vira "pelada"', async (_case, name) => {
      const user = await createUser(t);

      const res = await createVia(user.id, name).expect(201);

      expect(res.body).toMatchObject({ name, slug: 'pelada' });
    });

    it('nome só com emoji quando "pelada" já existe ganha sufixo', async () => {
      await groupWithSlug('pelada');
      const user = await createUser(t);

      const res = await createVia(user.id, '⚽').expect(201);

      expect(res.body.slug).toBe('pelada-2');
    });

    it('acento, maiúscula e espaços repetidos', async () => {
      const user = await createUser(t);

      const res = await createVia(user.id, '  PELADA   da  ÁGUA-Fria  ').expect(201);

      expect(res.body).toMatchObject({
        name: 'PELADA   da  ÁGUA-Fria',
        slug: 'pelada-da-agua-fria',
      });
    });

    it('slugs mais longos com o mesmo começo não ocupam a base', async () => {
      await groupWithSlug('pelada-do-ze');
      await groupWithSlug('peladao');
      await groupWithSlug('pelada-3');
      const user = await createUser(t);

      expect((await createVia(user.id, 'Pelada').expect(201)).body.slug).toBe('pelada');
      expect((await createVia(user.id, 'Pelada').expect(201)).body.slug).toBe('pelada-2');
      expect((await createVia(user.id, 'Pelada').expect(201)).body.slug).toBe('pelada-4');
    });

    it('"Pelada 2" com "pelada" e "pelada-2" ocupados vira "pelada-2-2"', async () => {
      await groupWithSlug('pelada');
      await groupWithSlug('pelada-2');
      const user = await createUser(t);

      const res = await createVia(user.id, 'Pelada 2').expect(201);

      expect(res.body.slug).toBe('pelada-2-2');
    });

    it('nome com exatamente 50 caracteres (emoji conta 1) é aceito', async () => {
      const user = await createUser(t);
      const name = '⚽'.repeat(50);

      const res = await createVia(user.id, name).expect(201);

      expect(res.body.name).toBe(name);
    });
  });

  describe('corpo da requisição', () => {
    it('POST /api/groups sem corpo → 400', async () => {
      const user = await createUser(t);

      await request(server()).post('/api/groups').set('Cookie', as(user.id)).expect(400);
      expect(await t.prisma.group.count()).toBe(0);
    });

    it('POST /api/groups com JSON quebrado → 400', async () => {
      const user = await createUser(t);

      await request(server())
        .post('/api/groups')
        .set('Cookie', as(user.id))
        .set('Content-Type', 'application/json')
        .send('{"name": "Pelada",')
        .expect(400);
      expect(await t.prisma.group.count()).toBe(0);
    });

    it('join sem corpo → 400, sem criar membership', async () => {
      const group = await createGroup(t);
      const user = await createUser(t);

      await request(server())
        .post(`/api/invites/${group.inviteCode}/join`)
        .set('Cookie', as(user.id))
        .expect(400);
      expect(await t.prisma.membership.count()).toBe(0);
    });

    it('join com corpo em texto puro → 400', async () => {
      const group = await createGroup(t);
      const user = await createUser(t);

      await request(server())
        .post(`/api/invites/${group.inviteCode}/join`)
        .set('Cookie', as(user.id))
        .set('Content-Type', 'text/plain')
        .send('nickname=Zé')
        .expect(400);
      expect(await t.prisma.membership.count()).toBe(0);
    });

    it.each([
      ['apelido número', { nickname: 1234, primaryPosition: 'DEFENDER' }],
      ['apelido null', { nickname: null, primaryPosition: 'DEFENDER' }],
      ['apelido lista', { nickname: ['Zé'], primaryPosition: 'DEFENDER' }],
      ['posição null', { nickname: 'Zé', primaryPosition: null }],
      ['posição em minúsculo', { nickname: 'Zé', primaryPosition: 'defender' }],
      ['corpo lista', [entry]],
    ])('join com %s → 400', async (_case, body) => {
      const group = await createGroup(t);
      const user = await createUser(t);

      await join(user.id, group.inviteCode, body).expect(400);
      expect(await t.prisma.membership.count()).toBe(0);
    });

    it('400 traz as mensagens por campo', async () => {
      const group = await createGroup(t);
      const user = await createUser(t);

      const res = await join(user.id, group.inviteCode, { nickname: '' }).expect(400);

      const paths = (res.body.issues as { path: string }[]).map((i) => i.path);
      expect(paths).toEqual(expect.arrayContaining(['nickname', 'primaryPosition']));
    });

    it('campos extras no join são ignorados: não vira ADMIN nem muda nota/grupo/ativo', async () => {
      const group = await createGroup(t);
      const other = await createGroup(t);
      const user = await createUser(t);
      const victim = await createUser(t);

      const res = await join(user.id, group.inviteCode, {
        ...entry,
        role: 'ADMIN',
        initialRating: 10,
        groupId: other.id,
        userId: victim.id,
        active: false,
        isHiredGoalkeeper: true,
        photoUrl: 'https://evil.example/x.png',
        secondaryPositions: ['FORWARD'],
      }).expect(201);

      expect(res.body).toMatchObject({ id: group.id, role: 'PLAYER' });
      const memberships = await t.prisma.membership.findMany();
      expect(memberships).toHaveLength(1);
      expect(memberships[0]).toMatchObject({
        userId: user.id,
        groupId: group.id,
        role: 'PLAYER',
        initialRating: DEFAULT_INITIAL_RATING,
        active: true,
        isHiredGoalkeeper: false,
        photoUrl: null,
        secondaryPositions: [],
      });
    });

    it('campos extras no criar grupo são ignorados (slug, inviteCode, nota)', async () => {
      const user = await createUser(t);

      const res = await createVia(user.id, 'Pelada', {
        slug: 'slug-escolhido',
        inviteCode: 'codigo-escolhido',
        initialRating: 10,
        role: 'PLAYER',
      }).expect(201);

      expect(res.body).toMatchObject({ slug: 'pelada', role: 'ADMIN' });
      const group = await t.prisma.group.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(group.inviteCode).not.toBe('codigo-escolhido');
      const membership = await t.prisma.membership.findFirstOrThrow({ where: { userId: user.id } });
      expect(membership.initialRating).toBe(DEFAULT_INITIAL_RATING);
    });

    it('apelido no join é guardado sem os espaços das pontas', async () => {
      const group = await createGroup(t);
      const user = await createUser(t);

      await join(user.id, group.inviteCode, { ...entry, nickname: '   Zé   ' }).expect(201);

      const m = await t.prisma.membership.findFirstOrThrow({ where: { userId: user.id } });
      expect(m.nickname).toBe('Zé');
    });

    it.each([
      ['10 letras com acento', 'Joãozinhoé'],
      ['10 emojis simples', '⚽'.repeat(10)],
      ['10 dígitos', '1234567890'],
      ['10 letras com espaço nas pontas', '  abcdefghij  '],
    ])('apelido com %s é aceito', async (_case, nickname) => {
      const group = await createGroup(t);
      const user = await createUser(t);

      await join(user.id, group.inviteCode, { ...entry, nickname }).expect(201);
    });

    // Acento decomposto (NFD, comum em texto colado/macOS): "ã" = "a" + til combinante.
    // A regra diz que acento conta 1, então 10 letras com acento têm que passar.
    it('apelido de 10 letras com acento em forma decomposta (NFD) é aceito', async () => {
      const group = await createGroup(t);
      const user = await createUser(t);
      const nickname = 'Joãozinhoé'.normalize('NFD');

      await join(user.id, group.inviteCode, { ...entry, nickname }).expect(201);
    });

    // Emoji com tom de pele é 1 caractere visível (2 code points). A regra diz que emoji conta 1.
    it('apelido com 10 emojis com tom de pele é aceito', async () => {
      const group = await createGroup(t);
      const user = await createUser(t);

      await join(user.id, group.inviteCode, { ...entry, nickname: '👍🏽'.repeat(10) }).expect(201);
    });

    it('apelido com 11 emojis simples → 400', async () => {
      const group = await createGroup(t);
      const user = await createUser(t);

      await join(user.id, group.inviteCode, { ...entry, nickname: '⚽'.repeat(11) }).expect(400);
    });

    it('apelido com caractere nulo → 400, não 500', async () => {
      const group = await createGroup(t);
      const user = await createUser(t);

      const res = await join(user.id, group.inviteCode, { ...entry, nickname: 'Z\u0000é' });

      expect(res.status).toBe(400);
      expect(await t.prisma.membership.count()).toBe(0);
    });

    it.each([
      ['acento empilhado ("Zalgo", 1 grafema enorme)', `a${'\u0301'.repeat(50_000)}`],
      ['só espaço de largura zero (apelido em branco)', '\u200B'],
      ['inversão direita-esquerda', '\u202EZé'],
    ])('apelido com %s → 400', async (_case, nickname) => {
      const group = await createGroup(t);
      const user = await createUser(t);

      await join(user.id, group.inviteCode, { ...entry, nickname }).expect(400);
      expect(await t.prisma.membership.count()).toBe(0);
    });

    it('nome do grupo com caractere nulo → 400, não 500', async () => {
      const user = await createUser(t);

      const res = await createVia(user.id, 'Pela\u0000da');

      expect(res.status).toBe(400);
      expect(await t.prisma.group.count()).toBe(0);
    });
  });

  describe('convite', () => {
    it('código gerado na criação e na troca é url-safe, com 12 caracteres', async () => {
      const user = await createUser(t);
      const { body: group } = await createVia(user.id, 'Pelada').expect(201);

      const { body: first } = await request(server())
        .get(`/api/groups/${group.id}/invite`)
        .set('Cookie', as(user.id))
        .expect(200);
      const { body: second } = await request(server())
        .post(`/api/groups/${group.id}/invite`)
        .set('Cookie', as(user.id))
        .expect(200);

      for (const { code } of [first, second]) expect(code).toMatch(/^[A-Za-z0-9_-]{12}$/);
    });

    it('trocar duas vezes seguidas: cada código é novo e só o último vale', async () => {
      const group = await createGroup(t);
      const admin = await createUser(t);
      await addMember(t, admin.id, group.id, { role: 'ADMIN' });
      const regenerate = () =>
        request(server())
          .post(`/api/groups/${group.id}/invite`)
          .set('Cookie', as(admin.id))
          .expect(200);

      const first = (await regenerate()).body.code;
      const second = (await regenerate()).body.code;

      expect(new Set([group.inviteCode, first, second]).size).toBe(3);
      await request(server()).get(`/api/invites/${group.inviteCode}`).expect(404);
      await request(server()).get(`/api/invites/${first}`).expect(404);
      await request(server()).get(`/api/invites/${second}`).expect(200);
      const newcomer = await createUser(t);
      await join(newcomer.id, first).expect(404);
      await join(newcomer.id, second).expect(201);
      // GET do convite devolve o último.
      const res = await request(server())
        .get(`/api/groups/${group.id}/invite`)
        .set('Cookie', as(admin.id))
        .expect(200);
      expect(res.body).toEqual({ code: second });
    });

    it('código com maiúsculas/minúsculas trocadas não vale', async () => {
      const user = await createUser(t);
      const { body: group } = await createVia(user.id, 'Pelada').expect(201);
      const { code } = (
        await request(server())
          .get(`/api/groups/${group.id}/invite`)
          .set('Cookie', as(user.id))
          .expect(200)
      ).body as { code: string };
      const swapped = [...code]
        .map((c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()))
        .join('');
      if (swapped === code) return; // só dígitos/símbolos: nada a trocar

      await request(server()).get(`/api/invites/${swapped}`).expect(404);
    });

    it('prévia de grupo só com membros inativos: 200 com 0 membros', async () => {
      const group = await createGroup(t, { name: 'Pelada Fantasma' });
      await addMember(t, (await createUser(t)).id, group.id, { role: 'ADMIN', active: false });
      await addMember(t, (await createUser(t)).id, group.id, { active: false });

      const res = await request(server()).get(`/api/invites/${group.inviteCode}`).expect(200);

      expect(res.body).toEqual({ groupName: 'Pelada Fantasma', memberCount: 0 });
    });

    it.each([
      ['muito longo', 'a'.repeat(5000)],
      ['com ../ codificado', encodeURIComponent('../../groups')],
      ['unicode', encodeURIComponent('convite-⚽-çã')],
      ['com espaço codificado', encodeURIComponent('  ')],
      ['com aspas e ponto e vírgula', encodeURIComponent(`'; DROP TABLE "Group";--`)],
      ['caractere nulo', '%00'],
      ['percent-encoding inválido', '%E0%A4%A'],
    ])('código %s → 4xx, não 500 (prévia e entrar)', async (_case, code) => {
      const group = await createGroup(t);
      const user = await createUser(t);

      const preview = await request(server()).get(`/api/invites/${code}`);
      const joined = await join(user.id, code);

      expect([400, 404]).toContain(preview.status);
      expect([400, 404]).toContain(joined.status);
      expect(await t.prisma.membership.count({ where: { groupId: group.id } })).toBe(0);
    });

    it('entrar com o código antigo logo depois de trocar → 404, sem membership', async () => {
      const group = await createGroup(t);
      const admin = await createUser(t);
      await addMember(t, admin.id, group.id, { role: 'ADMIN' });
      const newcomer = await createUser(t);

      await request(server())
        .post(`/api/groups/${group.id}/invite`)
        .set('Cookie', as(admin.id))
        .expect(200);
      await join(newcomer.id, group.inviteCode).expect(404);

      expect(await t.prisma.membership.count({ where: { userId: newcomer.id } })).toBe(0);
    });
  });

  describe('autorização', () => {
    it.each(['get', 'post'] as const)('ADMIN inativo no %s do convite → 404', async (method) => {
      const group = await createGroup(t);
      const admin = await createUser(t);
      await addMember(t, admin.id, group.id, { role: 'ADMIN', active: false });

      await request(server())
        [method](`/api/groups/${group.id}/invite`)
        .set('Cookie', as(admin.id))
        .expect(404);
      const unchanged = await t.prisma.group.findUniqueOrThrow({ where: { id: group.id } });
      expect(unchanged.inviteCode).toBe(group.inviteCode);
    });

    it('ADMIN inativo não vê o grupo nem os membros', async () => {
      const group = await createGroup(t);
      const admin = await createUser(t);
      await addMember(t, admin.id, group.id, { role: 'ADMIN', active: false });

      await request(server())
        .get(`/api/groups/${group.id}`)
        .set('Cookie', as(admin.id))
        .expect(404);
      await request(server())
        .get(`/api/groups/${group.id}/members`)
        .set('Cookie', as(admin.id))
        .expect(404);
    });

    it.each([
      ['inexistente (cuid aleatório)', 'clxxxxxxxxxxxxxxxxxxxxxxx'],
      ['malformado', 'nao-e-um-id'],
      ['muito longo', 'x'.repeat(5000)],
      ['unicode', encodeURIComponent('grupo-⚽')],
      ['caractere nulo', '%00'],
    ])('groupId %s → 404 em todas as rotas, não 500', async (_case, groupId) => {
      const user = await createUser(t);
      const cookie = as(user.id);

      const responses = await Promise.all([
        request(server()).get(`/api/groups/${groupId}`).set('Cookie', cookie),
        request(server()).get(`/api/groups/${groupId}/members`).set('Cookie', cookie),
        request(server()).get(`/api/groups/${groupId}/invite`).set('Cookie', cookie),
        request(server()).post(`/api/groups/${groupId}/invite`).set('Cookie', cookie),
      ]);

      expect(responses.map((r) => r.status)).toEqual([404, 404, 404, 404]);
    });

    it('sessão de usuário que não existe mais → 401 em criar e entrar', async () => {
      const group = await createGroup(t);
      const ghost = as('usuario-que-nao-existe');

      await request(server())
        .post('/api/groups')
        .set('Cookie', ghost)
        .send({ ...entry, name: 'Pelada' })
        .expect(401);
      await request(server())
        .post(`/api/invites/${group.inviteCode}/join`)
        .set('Cookie', ghost)
        .send(entry)
        .expect(401);
      expect(await t.prisma.group.count()).toBe(1);
      expect(await t.prisma.membership.count()).toBe(0);
    });

    it('cookie de sessão adulterado → 401', async () => {
      const user = await createUser(t);

      await request(server())
        .post('/api/groups')
        .set('Cookie', `${as(user.id)}x`)
        .send({ ...entry, name: 'Pelada' })
        .expect(401);
    });
  });

  describe('entrar sendo já membro', () => {
    it('quem criou o grupo e usa o próprio convite continua ADMIN, sem mudar apelido/posição', async () => {
      const user = await createUser(t);
      const { body: group } = await createVia(user.id, 'Pelada', {
        nickname: 'Dono',
        primaryPosition: 'GOALKEEPER',
      }).expect(201);
      const { code } = (
        await request(server())
          .get(`/api/groups/${group.id}/invite`)
          .set('Cookie', as(user.id))
          .expect(200)
      ).body as { code: string };

      const res = await join(user.id, code, {
        nickname: 'Outro',
        primaryPosition: 'FORWARD',
      }).expect(200);

      expect(res.body).toEqual({ ...group, role: 'ADMIN', memberCount: 1 });
      const m = await t.prisma.membership.findFirstOrThrow({ where: { userId: user.id } });
      expect(m).toMatchObject({ role: 'ADMIN', nickname: 'Dono', primaryPosition: 'GOALKEEPER' });
    });

    it('já é membro ativo e manda corpo inválido → 400 (valida antes de tudo)', async () => {
      const group = await createGroup(t);
      const user = await createUser(t);
      await addMember(t, user.id, group.id);

      await join(user.id, group.inviteCode, {}).expect(400);
    });

    it('membro de outro grupo entra em um novo: 201 e mantém o papel no outro', async () => {
      const mine = await createGroup(t);
      const target = await createGroup(t);
      const user = await createUser(t);
      await addMember(t, user.id, mine.id, { role: 'ADMIN' });

      const res = await join(user.id, target.inviteCode).expect(201);

      expect(res.body).toMatchObject({ id: target.id, role: 'PLAYER', memberCount: 1 });
      const own = await t.prisma.membership.findUniqueOrThrow({
        where: { userId_groupId: { userId: user.id, groupId: mine.id } },
      });
      expect(own.role).toBe('ADMIN');
    });
  });

  describe('lista de membros', () => {
    it('não vaza nota, email, userId nem datas; secundárias e foto no formato do contrato', async () => {
      const group = await createGroup(t);
      const viewer = await createUser(t);
      const m = await addMember(t, viewer.id, group.id);
      await t.prisma.membership.update({
        where: { id: m.id },
        data: {
          photoUrl: 'https://example.com/foto.png',
          secondaryPositions: ['WINGER', 'FORWARD'],
          isHiredGoalkeeper: true,
        },
      });

      const res = await request(server())
        .get(`/api/groups/${group.id}/members`)
        .set('Cookie', as(viewer.id))
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(memberSchema.strict().safeParse(res.body[0]).success).toBe(true);
      expect(res.body[0]).toEqual({
        id: m.id,
        nickname: 'Apelido',
        photoUrl: 'https://example.com/foto.png',
        role: 'PLAYER',
        primaryPosition: 'MIDFIELDER',
        secondaryPositions: ['WINGER', 'FORWARD'],
        isHiredGoalkeeper: true,
        avatar: { skin: 'TAN', hair: 'SHORT', hairColor: 'BLACK' },
      });
      expect(JSON.stringify(res.body)).not.toContain(viewer.email);
      expect(JSON.stringify(res.body)).not.toContain(viewer.id);
    });

    it('apelidos iguais: ordem estável por quem entrou primeiro', async () => {
      const group = await createGroup(t);
      const ids: string[] = [];
      for (let i = 0; i < 4; i += 1) {
        const m = await addMember(t, (await createUser(t)).id, group.id);
        ids.push(m.id);
      }
      const viewer = (await t.prisma.membership.findUniqueOrThrow({ where: { id: ids[0] } }))
        .userId;

      const first = await request(server())
        .get(`/api/groups/${group.id}/members`)
        .set('Cookie', as(viewer))
        .expect(200);
      const second = await request(server())
        .get(`/api/groups/${group.id}/members`)
        .set('Cookie', as(viewer))
        .expect(200);

      const order = (r: typeof first) => (r.body as { id: string }[]).map((m) => m.id);
      expect(order(first)).toEqual(ids);
      expect(order(second)).toEqual(ids);
    });
  });

  describe('formato das respostas (sem campo extra)', () => {
    it('criar, ver, convite, prévia e entrar batem com os contratos do shared', async () => {
      const admin = await createUser(t);
      const created = await createVia(admin.id, 'Pelada').expect(201);
      expect(groupResponseSchema.strict().safeParse(created.body).success).toBe(true);
      const groupId = created.body.id as string;

      const got = await request(server())
        .get(`/api/groups/${groupId}`)
        .set('Cookie', as(admin.id))
        .expect(200);
      expect(groupResponseSchema.strict().safeParse(got.body).success).toBe(true);

      const invite = await request(server())
        .get(`/api/groups/${groupId}/invite`)
        .set('Cookie', as(admin.id))
        .expect(200);
      expect(inviteSchema.strict().safeParse(invite.body).success).toBe(true);

      const regenerated = await request(server())
        .post(`/api/groups/${groupId}/invite`)
        .set('Cookie', as(admin.id))
        .expect(200);
      expect(inviteSchema.strict().safeParse(regenerated.body).success).toBe(true);

      const preview = await request(server())
        .get(`/api/invites/${regenerated.body.code}`)
        .expect(200);
      expect(invitePreviewSchema.strict().safeParse(preview.body).success).toBe(true);

      const newcomer = await createUser(t);
      const entryAs = { ...entry, nickname: 'Novato' };
      const joined = await join(newcomer.id, regenerated.body.code, entryAs).expect(201);
      expect(groupResponseSchema.strict().safeParse(joined.body).success).toBe(true);
      const again = await join(newcomer.id, regenerated.body.code, entryAs).expect(200);
      expect(groupResponseSchema.strict().safeParse(again.body).success).toBe(true);
      expect(again.body).toEqual(joined.body);
    });

    it('prévia pública não expõe id, slug nem código do grupo', async () => {
      const group = await createGroup(t, { name: 'Pelada X' });

      const res = await request(server()).get(`/api/invites/${group.inviteCode}`).expect(200);

      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain(group.id);
      expect(raw).not.toContain(group.slug);
    });
  });

  describe('ajustes do code review (rodada 2)', () => {
    it('membros em ordem alfabética do português (sem ligar para maiúscula e acento)', async () => {
      const group = await createGroup(t);
      const viewer = await createUser(t);
      await addMember(t, viewer.id, group.id);
      for (const nickname of ['Zé', 'alemão', 'Ávila', 'bola']) {
        const m = await addMember(t, (await createUser(t)).id, group.id);
        await t.prisma.membership.update({ where: { id: m.id }, data: { nickname } });
      }

      const res = await request(server())
        .get(`/api/groups/${group.id}/members`)
        .set('Cookie', as(viewer.id))
        .expect(200);

      expect(res.body.map((m: { nickname: string }) => m.nickname)).toEqual([
        'alemão',
        'Apelido',
        'Ávila',
        'bola',
        'Zé',
      ]);
    });

    it('404 do %00 no caminho tem o mesmo corpo de um 404 comum', async () => {
      const user = await createUser(t);

      const common = await request(server())
        .get('/api/groups/nao-existe')
        .set('Cookie', as(user.id))
        .expect(404);
      const control = await request(server())
        .get('/api/groups/%00')
        .set('Cookie', as(user.id))
        .expect(404);

      expect(control.body).toEqual(common.body);
    });

    it('campo extra com \\0 é descartado pelo schema e não chega ao banco → 201', async () => {
      const group = await createGroup(t);
      const user = await createUser(t);

      await join(user.id, group.inviteCode, { ...entry, extra: 'a\u0000b' }).expect(201);
    });

    it('corpo muito aninhado (20 mil níveis) não derruba a validação → nunca 500', async () => {
      const group = await createGroup(t);
      const user = await createUser(t);
      const deep = `${'['.repeat(20_000)}${']'.repeat(20_000)}`;

      const extra = await request(server())
        .post(`/api/invites/${group.inviteCode}/join`)
        .set('Cookie', as(user.id))
        .set('Content-Type', 'application/json')
        .send(`{"nickname":"Zé","primaryPosition":"DEFENDER","extra":${deep}}`);
      const asBody = await request(server())
        .post('/api/groups')
        .set('Cookie', as(user.id))
        .set('Content-Type', 'application/json')
        .send(deep);

      expect(extra.status).toBeLessThan(500);
      expect(asBody.status).toBe(400);
    });

    it('caminho com caractere invisível (NEL, largura zero) → 404', async () => {
      const user = await createUser(t);

      for (const id of ['%C2%85', '%E2%80%8B']) {
        await request(server()).get(`/api/groups/${id}`).set('Cookie', as(user.id)).expect(404);
      }
    });

    it('entradas simultâneas: cada 201 conta a própria entrada, sem passar do total; depois, o total exato', async () => {
      const group = await createGroup(t);
      const admin = await createUser(t);
      await addMember(t, admin.id, group.id, { role: 'ADMIN' });
      const users = await Promise.all([createUser(t), createUser(t), createUser(t)]);

      const responses = await Promise.all(
        users.map((u, i) => join(u.id, group.inviteCode, { ...entry, nickname: `Novo${i}` })),
      );

      expect(responses.map((r) => r.status)).toEqual([201, 201, 201]);
      for (const { body } of responses) {
        expect(body.memberCount).toBeGreaterThanOrEqual(2);
        expect(body.memberCount).toBeLessThanOrEqual(4);
      }
      const after = await request(server())
        .get(`/api/groups/${group.id}`)
        .set('Cookie', as(admin.id))
        .expect(200);
      expect(after.body.memberCount).toBe(4);
    });

    it('o service também barra PLAYER no convite (não confia só no guard)', async () => {
      const group = await createGroup(t);
      const player = await addMember(t, (await createUser(t)).id, group.id);
      const groups = t.app.get(GroupsService);
      const membership = { id: player.id, groupId: group.id, role: player.role };

      await expect(groups.getInvite(membership)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(groups.regenerateInvite(membership)).rejects.toBeInstanceOf(ForbiddenException);
      const unchanged = await t.prisma.group.findUniqueOrThrow({ where: { id: group.id } });
      expect(unchanged.inviteCode).toBe(group.inviteCode);
    });
  });
});
