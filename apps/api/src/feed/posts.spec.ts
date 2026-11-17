import {
  COMMENT_ERROR_LABELS,
  commentSchema,
  NOT_OWN_COMMENT_LABEL,
  POST_INPUT_ERROR_LABELS,
  postListSchema,
  postSchema,
} from '@fut-stats/shared';
import request from 'supertest';
import { addMember, createGroup, createUser, loginAs } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';

describe('feed: resenhas, reações e comentários', () => {
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

  /** Grupo com dois admins (Ana, Beto) e dois jogadores (Caio, Davi). */
  async function setup() {
    const group = await createGroup(t);
    const person = async (nickname: string, role: 'ADMIN' | 'PLAYER'): Promise<Person> => {
      const user = await createUser(t);
      const member = await addMember(t, user.id, group.id, { nickname, role });
      return { userId: user.id, membershipId: member.id, cookie: loginAs(t, user.id) };
    };
    return {
      group,
      ana: await person('Ana', 'ADMIN'),
      beto: await person('Beto', 'ADMIN'),
      caio: await person('Caio', 'PLAYER'),
      davi: await person('Davi', 'PLAYER'),
    };
  }

  type Ctx = Awaited<ReturnType<typeof setup>>;

  const base = (c: Ctx) => `/api/groups/${c.group.id}/posts`;
  const listPosts = (c: Ctx, who: Person, query = '') =>
    request(server())
      .get(`${base(c)}${query}`)
      .set('Cookie', who.cookie);
  const createPost = (c: Ctx, who: Person, body: object) =>
    request(server()).post(base(c)).set('Cookie', who.cookie).send(body);
  const putReaction = (c: Ctx, who: Person, postId: string, body: object) =>
    request(server())
      .put(`${base(c)}/${postId}/reaction`)
      .set('Cookie', who.cookie)
      .send(body);
  const comments = (c: Ctx, who: Person, postId: string) =>
    request(server())
      .get(`${base(c)}/${postId}/comments`)
      .set('Cookie', who.cookie);
  const addComment = (c: Ctx, who: Person, postId: string, text: string) =>
    request(server())
      .post(`${base(c)}/${postId}/comments`)
      .set('Cookie', who.cookie)
      .send({ text });

  /** Resenha direto no banco (atalho para testes que não são da criação). */
  function seedPost(
    c: Ctx,
    data: { author?: Person; title?: string | null; body?: string; createdAt?: Date } = {},
  ) {
    return t.prisma.post.create({
      data: {
        groupId: c.group.id,
        authorId: (data.author ?? c.ana).membershipId,
        title: data.title === undefined ? 'Resenha' : data.title,
        body: data.body ?? 'Foi um jogaço.',
        createdAt: data.createdAt,
      },
    });
  }

  describe('criar', () => {
    it('C9: admin publica e recebe a resenha com autor, reações zeradas e permissões', async () => {
      const c = await setup();
      const res = await createPost(c, c.ana, { title: 'Rodada 12', body: 'Foi um jogaço.' }).expect(
        201,
      );

      expect(postSchema.safeParse(res.body).success).toBe(true);
      expect(res.body).toMatchObject({
        title: 'Rodada 12',
        body: 'Foi um jogaço.',
        author: {
          membershipId: c.ana.membershipId,
          nickname: 'Ana',
          role: 'ADMIN',
          avatar: { skin: 'TAN', hair: 'SHORT', hairColor: 'BLACK' },
        },
        editedAt: null,
        reactions: { BALL: 0, CATFISH: 0, OSS: 0, YELLOW_CARD: 0, POPCORN: 0 },
        myReaction: null,
        commentCount: 0,
        canManage: true,
      });
      expect(await t.prisma.post.count({ where: { groupId: c.group.id } })).toBe(1);
    });

    it('C10: sem título vale e guarda `title: null`; título só de espaços também', async () => {
      const c = await setup();
      const semTitulo = await createPost(c, c.ana, { body: 'Só o texto.' }).expect(201);
      expect(semTitulo.body.title).toBeNull();
      const vazio = await createPost(c, c.ana, { title: '   ', body: 'Texto.' }).expect(201);
      expect(vazio.body.title).toBeNull();
      const explicito = await createPost(c, c.ana, { title: null, body: 'Texto.' }).expect(201);
      expect(explicito.body.title).toBeNull();
    });

    it('C10: texto com quebra de linha é guardado como veio', async () => {
      const c = await setup();
      const body = 'Linha 1\n\nLinha 3';
      const res = await createPost(c, c.ana, { body }).expect(201);
      expect(res.body.body).toBe(body);
    });

    it.each([
      ['título com 61 caracteres', { title: 'a'.repeat(61), body: 'ok' }, 'TITLE_TOO_LONG'],
      ['texto vazio', { body: '   ' }, 'BODY_EMPTY'],
      ['texto com 1001 caracteres', { body: 'a'.repeat(1001) }, 'BODY_TOO_LONG'],
      ['texto com \\0', { body: 'oi\0tchau' }, 'INVALID_CHARACTERS'],
      ['título com \\0', { title: 'oi\0', body: 'ok' }, 'INVALID_CHARACTERS'],
    ] as const)('C10: %s dá 400 com o texto do shared', async (_name, input, code) => {
      const c = await setup();
      const res = await createPost(c, c.ana, input).expect(400);
      expect(res.body.issues.map((i: { message: string }) => i.message)).toContain(
        POST_INPUT_ERROR_LABELS[code],
      );
      expect(await t.prisma.post.count()).toBe(0);
    });

    it('C10: sem texto (campo ausente) dá 400', async () => {
      const c = await setup();
      await createPost(c, c.ana, { title: 'Sem texto' }).expect(400);
    });
  });

  describe('permissões de admin', () => {
    it('C11: jogador comum não cria, não edita e não apaga (403) e nada muda', async () => {
      const c = await setup();
      const post = await seedPost(c);

      await createPost(c, c.caio, { body: 'Tentando.' }).expect(403);
      await request(server())
        .patch(`${base(c)}/${post.id}`)
        .set('Cookie', c.caio.cookie)
        .send({ body: 'Alterada.' })
        .expect(403);
      await request(server())
        .delete(`${base(c)}/${post.id}`)
        .set('Cookie', c.caio.cookie)
        .expect(403);

      const rows = await t.prisma.post.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ body: 'Foi um jogaço.', editedAt: null });
    });
  });

  describe('uma resenha', () => {
    it('GET por id: membro lê uma resenha pelo id, com reações, a minha e o contador', async () => {
      const c = await setup();
      const post = await seedPost(c, { title: 'Título', body: 'Linha 1\nLinha 2' });
      await putReaction(c, c.caio, post.id, { reaction: 'YELLOW_CARD' }).expect(200);
      await addComment(c, c.davi, post.id, 'Boa').expect(201);

      const res = await request(server())
        .get(`${base(c)}/${post.id}`)
        .set('Cookie', c.caio.cookie)
        .expect(200);

      expect(postSchema.safeParse(res.body).success).toBe(true);
      expect(res.body).toMatchObject({
        id: post.id,
        title: 'Título',
        body: 'Linha 1\nLinha 2',
        author: { nickname: 'Ana', role: 'ADMIN' },
        reactions: { YELLOW_CARD: 1 },
        myReaction: 'YELLOW_CARD',
        commentCount: 1,
        canManage: false,
      });
      const asAdmin = await request(server())
        .get(`${base(c)}/${post.id}`)
        .set('Cookie', c.beto.cookie)
        .expect(200);
      expect(asAdmin.body).toMatchObject({ myReaction: null, canManage: true });
    });

    it('GET por id: resenha de outro grupo e id inexistente dão 404', async () => {
      const c = await setup();
      const outro = await setup();
      const foreign = await seedPost(outro);
      for (const id of [foreign.id, 'inexistente']) {
        await request(server())
          .get(`${base(c)}/${id}`)
          .set('Cookie', c.ana.cookie)
          .expect(404);
      }
    });

    it('GET por id: não membro, outro grupo e membro inativo dão 404; sem sessão, 401', async () => {
      const c = await setup();
      const post = await seedPost(c);
      const stranger = await createUser(t);
      const outro = await createGroup(t);
      const outsider = await createUser(t);
      await addMember(t, outsider.id, outro.id, { role: 'ADMIN' });
      const inactive = await createUser(t);
      await addMember(t, inactive.id, c.group.id, { active: false, role: 'ADMIN' });
      for (const userId of [stranger.id, outsider.id, inactive.id]) {
        await request(server())
          .get(`${base(c)}/${post.id}`)
          .set('Cookie', loginAs(t, userId))
          .expect(404);
      }
      await request(server())
        .get(`${base(c)}/${post.id}`)
        .expect(401);
    });
  });

  describe('editar e apagar', () => {
    it('C12: outro admin edita; `editedAt` preenche e o autor continua o original', async () => {
      const c = await setup();
      const post = await seedPost(c, { author: c.ana });

      const res = await request(server())
        .patch(`${base(c)}/${post.id}`)
        .set('Cookie', c.beto.cookie)
        .send({ title: 'Novo título', body: 'Texto novo.' })
        .expect(200);

      expect(postSchema.safeParse(res.body).success).toBe(true);
      expect(res.body).toMatchObject({
        id: post.id,
        title: 'Novo título',
        body: 'Texto novo.',
        author: { membershipId: c.ana.membershipId, nickname: 'Ana' },
        canManage: true,
      });
      expect(res.body.editedAt).not.toBeNull();
      expect(new Date(res.body.createdAt).getTime()).toBe(post.createdAt.getTime());
    });

    it('C12: editar com título vazio tira o título; inválido dá 400 e nada muda', async () => {
      const c = await setup();
      const post = await seedPost(c, { title: 'Com título' });
      const res = await request(server())
        .patch(`${base(c)}/${post.id}`)
        .set('Cookie', c.ana.cookie)
        .send({ title: '', body: 'Texto.' })
        .expect(200);
      expect(res.body.title).toBeNull();

      await request(server())
        .patch(`${base(c)}/${post.id}`)
        .set('Cookie', c.ana.cookie)
        .send({ body: '' })
        .expect(400);
      expect((await t.prisma.post.findUniqueOrThrow({ where: { id: post.id } })).body).toBe(
        'Texto.',
      );
    });

    it('C13: apagar tira a resenha e leva reações e comentários junto', async () => {
      const c = await setup();
      const post = await seedPost(c);
      await putReaction(c, c.caio, post.id, { reaction: 'CATFISH' }).expect(200);
      await addComment(c, c.davi, post.id, 'Boa!').expect(201);

      await request(server())
        .delete(`${base(c)}/${post.id}`)
        .set('Cookie', c.beto.cookie)
        .expect(204);

      expect(await t.prisma.post.count()).toBe(0);
      expect(await t.prisma.postReaction.count()).toBe(0);
      expect(await t.prisma.postComment.count()).toBe(0);
      await comments(c, c.caio, post.id).expect(404);
    });
  });

  describe('lista', () => {
    it('C14: 25 resenhas em páginas de 10, da mais nova à mais antiga, sem repetir', async () => {
      const c = await setup();
      const start = Date.now() - 60_000;
      const ids: string[] = [];
      for (let i = 0; i < 25; i += 1) {
        const post = await seedPost(c, { title: `P${i}`, createdAt: new Date(start + i * 1000) });
        ids.unshift(post.id);
      }

      const first = await listPosts(c, c.caio).expect(200);
      expect(postListSchema.safeParse(first.body).success).toBe(true);
      expect(first.body.items.map((p: { id: string }) => p.id)).toEqual(ids.slice(0, 10));
      expect(first.body.nextCursor).toEqual(expect.any(String));

      const second = await listPosts(c, c.caio, `?cursor=${first.body.nextCursor}`).expect(200);
      expect(second.body.items.map((p: { id: string }) => p.id)).toEqual(ids.slice(10, 20));
      expect(second.body.nextCursor).toEqual(expect.any(String));

      const third = await listPosts(c, c.caio, `?cursor=${second.body.nextCursor}`).expect(200);
      expect(third.body.items.map((p: { id: string }) => p.id)).toEqual(ids.slice(20));
      expect(third.body.nextCursor).toBeNull();
    });

    it('C14: `limit` muda o tamanho da página; resenhas no mesmo instante não se repetem nem somem', async () => {
      const c = await setup();
      const sameInstant = new Date(Date.now() - 10_000);
      for (let i = 0; i < 5; i += 1) await seedPost(c, { createdAt: sameInstant });

      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const res: request.Response = await listPosts(
          c,
          c.caio,
          `?limit=2${cursor ? `&cursor=${cursor}` : ''}`,
        ).expect(200);
        expect(res.body.items.length).toBeLessThanOrEqual(2);
        seen.push(...res.body.items.map((p: { id: string }) => p.id));
        cursor = res.body.nextCursor;
      } while (cursor);

      expect(seen).toHaveLength(5);
      expect(new Set(seen).size).toBe(5);
    });

    it('C14: limit fora do intervalo e cursor inválido dão 400', async () => {
      const c = await setup();
      await listPosts(c, c.caio, '?limit=0').expect(400);
      await listPosts(c, c.caio, '?limit=31').expect(400);
      await listPosts(c, c.caio, '?cursor=lixo').expect(400);
    });

    it('C14: lista vazia devolve `items: []` e `nextCursor: null`', async () => {
      const c = await setup();
      const res = await listPosts(c, c.caio).expect(200);
      expect(res.body).toEqual({ items: [], nextCursor: null });
    });

    it('C14: cada resenha traz reações, a minha reação, o número de comentários e `canManage` de quem pede', async () => {
      const c = await setup();
      const post = await seedPost(c);
      await putReaction(c, c.caio, post.id, { reaction: 'CATFISH' }).expect(200);
      await putReaction(c, c.davi, post.id, { reaction: 'CATFISH' }).expect(200);
      await putReaction(c, c.ana, post.id, { reaction: 'YELLOW_CARD' }).expect(200);
      await addComment(c, c.caio, post.id, 'Um').expect(201);
      await addComment(c, c.davi, post.id, 'Dois').expect(201);

      const asPlayer = await listPosts(c, c.caio).expect(200);
      expect(asPlayer.body.items[0]).toMatchObject({
        reactions: { BALL: 0, CATFISH: 2, OSS: 0, YELLOW_CARD: 1, POPCORN: 0 },
        myReaction: 'CATFISH',
        commentCount: 2,
        canManage: false,
      });
      const asAdmin = await listPosts(c, c.beto).expect(200);
      expect(asAdmin.body.items[0]).toMatchObject({ myReaction: null, canManage: true });
    });

    it('C14: só as resenhas do grupo da rota', async () => {
      const c = await setup();
      await seedPost(c);
      const outro = await setup();
      await seedPost(outro, { title: 'De outro grupo' });
      const res = await listPosts(c, c.caio).expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].title).toBe('Resenha');
    });
  });

  describe('reações', () => {
    it('C15: reagir, trocar e tirar', async () => {
      const c = await setup();
      const post = await seedPost(c);

      const catfish = await putReaction(c, c.caio, post.id, { reaction: 'CATFISH' }).expect(200);
      expect(postSchema.safeParse(catfish.body).success).toBe(true);
      expect(catfish.body.reactions.CATFISH).toBe(1);
      expect(catfish.body.myReaction).toBe('CATFISH');

      const ball = await putReaction(c, c.caio, post.id, { reaction: 'BALL' }).expect(200);
      expect(ball.body.reactions).toEqual({
        BALL: 1,
        CATFISH: 0,
        OSS: 0,
        YELLOW_CARD: 0,
        POPCORN: 0,
      });
      expect(ball.body.myReaction).toBe('BALL');

      const removed = await request(server())
        .delete(`${base(c)}/${post.id}/reaction`)
        .set('Cookie', c.caio.cookie)
        .expect(200);
      expect(removed.body.reactions).toEqual({
        BALL: 0,
        CATFISH: 0,
        OSS: 0,
        YELLOW_CARD: 0,
        POPCORN: 0,
      });
      expect(removed.body.myReaction).toBeNull();
      expect(await t.prisma.postReaction.count()).toBe(0);
    });

    it('C15: a reação de um não mexe na dos outros; repetir a mesma continua com uma só', async () => {
      const c = await setup();
      const post = await seedPost(c);
      await putReaction(c, c.caio, post.id, { reaction: 'OSS' }).expect(200);
      await putReaction(c, c.caio, post.id, { reaction: 'OSS' }).expect(200);
      const res = await putReaction(c, c.davi, post.id, { reaction: 'OSS' }).expect(200);
      expect(res.body.reactions.OSS).toBe(2);
      expect(res.body.myReaction).toBe('OSS');
      expect(await t.prisma.postReaction.count()).toBe(2);
    });

    it('C15: tirar sem ter reagido não dá erro', async () => {
      const c = await setup();
      const post = await seedPost(c);
      const res = await request(server())
        .delete(`${base(c)}/${post.id}/reaction`)
        .set('Cookie', c.caio.cookie)
        .expect(200);
      expect(res.body.myReaction).toBeNull();
    });

    it('C16: dois pedidos juntos do mesmo membro deixam uma reação só e nunca dão 500', async () => {
      const c = await setup();
      const post = await seedPost(c);

      for (let round = 0; round < 5; round += 1) {
        await t.prisma.postReaction.deleteMany();
        const results = await Promise.all([
          putReaction(c, c.caio, post.id, { reaction: 'CATFISH' }),
          putReaction(c, c.caio, post.id, { reaction: 'YELLOW_CARD' }),
          putReaction(c, c.caio, post.id, { reaction: 'CATFISH' }),
        ]);
        expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
        expect(await t.prisma.postReaction.count({ where: { postId: post.id } })).toBe(1);
      }
    });

    it('C17: reação fora da lista dá 400 e nada muda', async () => {
      const c = await setup();
      const post = await seedPost(c);
      await putReaction(c, c.caio, post.id, { reaction: 'ANGRY' }).expect(400);
      await putReaction(c, c.caio, post.id, {}).expect(400);
      await putReaction(c, c.caio, post.id, { reaction: 'catfish' }).expect(400);
      expect(await t.prisma.postReaction.count()).toBe(0);
    });
  });

  describe('comentários', () => {
    it('C18: membro comenta e recebe o comentário com autor e `canDelete`; o contador da resenha sobe', async () => {
      const c = await setup();
      const post = await seedPost(c);

      const res = await addComment(c, c.caio, post.id, 'Que jogo!').expect(201);

      expect(commentSchema.safeParse(res.body).success).toBe(true);
      expect(res.body).toMatchObject({
        text: 'Que jogo!',
        author: { membershipId: c.caio.membershipId, nickname: 'Caio', role: 'PLAYER' },
        canDelete: true,
      });
      const list = await listPosts(c, c.davi).expect(200);
      expect(list.body.items[0].commentCount).toBe(1);
    });

    it('C18: comentário com quebra de linha e emoji composto é guardado como veio', async () => {
      const c = await setup();
      const post = await seedPost(c);
      const text = 'linha 1\nlinha 2 👨‍👩‍👧‍👦';
      const res = await addComment(c, c.caio, post.id, text).expect(201);
      expect(res.body.text).toBe(text);
    });

    it('C19: lista em ordem de envio; `canDelete` só nos meus (admin: em todos)', async () => {
      const c = await setup();
      const post = await seedPost(c);
      await addComment(c, c.caio, post.id, 'Primeiro').expect(201);
      await addComment(c, c.davi, post.id, 'Segundo').expect(201);
      await addComment(c, c.ana, post.id, 'Terceiro').expect(201);

      const asPlayer = await comments(c, c.caio, post.id).expect(200);
      expect(asPlayer.body.map((x: { text: string }) => x.text)).toEqual([
        'Primeiro',
        'Segundo',
        'Terceiro',
      ]);
      expect(asPlayer.body.map((x: { canDelete: boolean }) => x.canDelete)).toEqual([
        true,
        false,
        false,
      ]);
      for (const comment of asPlayer.body) commentSchema.parse(comment);

      const asAdmin = await comments(c, c.beto, post.id).expect(200);
      expect(asAdmin.body.map((x: { canDelete: boolean }) => x.canDelete)).toEqual([
        true,
        true,
        true,
      ]);
    });

    it('C19: devolve no máximo os 200 mais recentes, ainda em ordem de envio', async () => {
      const c = await setup();
      const post = await seedPost(c);
      const start = Date.now() - 1_000_000;
      await t.prisma.postComment.createMany({
        data: Array.from({ length: 205 }, (_, i) => ({
          postId: post.id,
          membershipId: c.caio.membershipId,
          text: `c${i}`,
          createdAt: new Date(start + i * 1000),
        })),
      });
      const res = await comments(c, c.davi, post.id).expect(200);
      expect(res.body).toHaveLength(200);
      expect(res.body[0].text).toBe('c5');
      expect(res.body[199].text).toBe('c204');
    });

    it('C20: jogador apaga o próprio comentário (204) e não o de outro (403 NOT_OWN_COMMENT)', async () => {
      const c = await setup();
      const post = await seedPost(c);
      const mine = (await addComment(c, c.caio, post.id, 'Meu').expect(201)).body.id;
      const theirs = (await addComment(c, c.davi, post.id, 'Dele').expect(201)).body.id;
      const del = (who: Person, id: string) =>
        request(server())
          .delete(`${base(c)}/${post.id}/comments/${id}`)
          .set('Cookie', who.cookie);

      const forbidden = await del(c.caio, theirs).expect(403);
      expect(forbidden.body).toMatchObject({
        code: 'NOT_OWN_COMMENT',
        message: NOT_OWN_COMMENT_LABEL,
      });
      expect(await t.prisma.postComment.count()).toBe(2);

      await del(c.caio, mine).expect(204);
      expect(await t.prisma.postComment.count()).toBe(1);
      expect((await comments(c, c.davi, post.id)).body.map((x: { id: string }) => x.id)).toEqual([
        theirs,
      ]);
    });

    it('C21: admin apaga o comentário de outro (204)', async () => {
      const c = await setup();
      const post = await seedPost(c);
      const id = (await addComment(c, c.caio, post.id, 'Deslize').expect(201)).body.id;
      await request(server())
        .delete(`${base(c)}/${post.id}/comments/${id}`)
        .set('Cookie', c.beto.cookie)
        .expect(204);
      expect(await t.prisma.postComment.count()).toBe(0);
    });

    it.each([
      ['vazio', ''],
      ['só espaços', '   \n  '],
      ['com 281 caracteres', 'a'.repeat(281)],
      ['com \\0', 'oi\0'],
    ] as const)('C22: comentário %s dá 400 com o texto do shared', async (_name, text) => {
      const c = await setup();
      const post = await seedPost(c);
      const res = await addComment(c, c.caio, post.id, text).expect(400);
      const messages = res.body.issues.map((i: { message: string }) => i.message);
      expect(messages.some((m: string) => Object.values(COMMENT_ERROR_LABELS).includes(m))).toBe(
        true,
      );
      expect(await t.prisma.postComment.count()).toBe(0);
    });

    it('C22: 280 caracteres passa', async () => {
      const c = await setup();
      const post = await seedPost(c);
      await addComment(c, c.caio, post.id, 'a'.repeat(280)).expect(201);
    });
  });

  describe('isolamento e acesso', () => {
    it('C23: resenha de outro grupo, id inexistente e comentário de outra resenha dão 404 e nada muda', async () => {
      const c = await setup();
      const outro = await setup();
      const foreign = await seedPost(outro, { title: 'De outro grupo' });
      const own = await seedPost(c);
      const other = await seedPost(c, { title: 'Outra' });
      const comment = await t.prisma.postComment.create({
        data: { postId: other.id, membershipId: c.caio.membershipId, text: 'Da outra' },
      });
      const calls = (id: string) => [
        () =>
          request(server())
            .patch(`${base(c)}/${id}`)
            .set('Cookie', c.ana.cookie)
            .send({ body: 'Nova' }),
        () =>
          request(server())
            .delete(`${base(c)}/${id}`)
            .set('Cookie', c.ana.cookie),
        () => putReaction(c, c.caio, id, { reaction: 'CATFISH' }),
        () =>
          request(server())
            .delete(`${base(c)}/${id}/reaction`)
            .set('Cookie', c.caio.cookie),
        () => comments(c, c.caio, id),
        () => addComment(c, c.caio, id, 'Oi'),
      ];

      for (const id of [foreign.id, 'inexistente']) {
        for (const call of calls(id)) await call().expect(404);
      }
      // comentário existente, mas de outra resenha do mesmo grupo
      await request(server())
        .delete(`${base(c)}/${own.id}/comments/${comment.id}`)
        .set('Cookie', c.ana.cookie)
        .expect(404);
      await request(server())
        .delete(`${base(c)}/${own.id}/comments/inexistente`)
        .set('Cookie', c.ana.cookie)
        .expect(404);

      expect(await t.prisma.post.count()).toBe(3);
      expect(await t.prisma.postComment.count()).toBe(1);
      expect(await t.prisma.postReaction.count()).toBe(0);
      expect(await t.prisma.post.findUniqueOrThrow({ where: { id: foreign.id } })).toMatchObject({
        body: 'Foi um jogaço.',
        editedAt: null,
      });
    });

    it('C23: admin de um grupo não mexe na resenha de outro usando o groupId do próprio grupo', async () => {
      const c = await setup();
      const outro = await setup();
      const foreign = await seedPost(outro);
      await request(server())
        .delete(`/api/groups/${c.group.id}/posts/${foreign.id}`)
        .set('Cookie', c.ana.cookie)
        .expect(404);
      expect(await t.prisma.post.count({ where: { id: foreign.id } })).toBe(1);
    });

    it('C24: usuário de outro grupo, não membro e membro inativo recebem 404 em todas as rotas', async () => {
      const c = await setup();
      const post = await seedPost(c);
      const comment = await t.prisma.postComment.create({
        data: { postId: post.id, membershipId: c.caio.membershipId, text: 'Oi' },
      });

      const stranger = await createUser(t);
      const outro = await createGroup(t);
      const outsider = await createUser(t);
      await addMember(t, outsider.id, outro.id, { role: 'ADMIN' });
      const inactiveUser = await createUser(t);
      await addMember(t, inactiveUser.id, c.group.id, { active: false, role: 'ADMIN' });

      for (const cookie of [
        loginAs(t, stranger.id),
        loginAs(t, outsider.id),
        loginAs(t, inactiveUser.id),
      ]) {
        const as = (req: request.Test) => req.set('Cookie', cookie);
        const url = base(c);
        await as(request(server()).get(url)).expect(404);
        await as(request(server()).post(url).send({ body: 'x' })).expect(404);
        await as(request(server()).patch(`${url}/${post.id}`).send({ body: 'x' })).expect(404);
        await as(request(server()).delete(`${url}/${post.id}`)).expect(404);
        await as(
          request(server()).put(`${url}/${post.id}/reaction`).send({ reaction: 'CATFISH' }),
        ).expect(404);
        await as(request(server()).delete(`${url}/${post.id}/reaction`)).expect(404);
        await as(request(server()).get(`${url}/${post.id}/comments`)).expect(404);
        await as(request(server()).post(`${url}/${post.id}/comments`).send({ text: 'x' })).expect(
          404,
        );
        await as(request(server()).delete(`${url}/${post.id}/comments/${comment.id}`)).expect(404);
      }
      expect(await t.prisma.post.count()).toBe(1);
      expect(await t.prisma.postComment.count()).toBe(1);
    });

    it('sem sessão: 401', async () => {
      const c = await setup();
      await request(server()).get(base(c)).expect(401);
    });
  });

  it('C25: autor desativado depois: a resenha continua, com o apelido e o bonequinho dele', async () => {
    const c = await setup();
    await t.prisma.membership.update({
      where: { id: c.ana.membershipId },
      data: { avatarSkin: 'DARK', avatarHair: 'AFRO', avatarHairColor: 'RED' },
    });
    const post = await seedPost(c, { author: c.ana });
    await addComment(c, c.ana, post.id, 'Comentário dele').expect(201);
    await t.prisma.membership.update({
      where: { id: c.ana.membershipId },
      data: { active: false },
    });

    const res = await listPosts(c, c.caio).expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].author).toEqual({
      membershipId: c.ana.membershipId,
      nickname: 'Ana',
      avatar: { skin: 'DARK', hair: 'AFRO', hairColor: 'RED' },
      role: 'ADMIN',
    });
    const thread = await comments(c, c.caio, post.id).expect(200);
    expect(thread.body[0].author.nickname).toBe('Ana');
    // O outro admin ainda edita a resenha dele.
    await request(server())
      .patch(`${base(c)}/${post.id}`)
      .set('Cookie', c.beto.cookie)
      .send({ body: 'Revisada.' })
      .expect(200);
  });
});
