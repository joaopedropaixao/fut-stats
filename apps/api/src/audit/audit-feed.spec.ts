import request from 'supertest';
import { REQUEST_ID_HEADER } from '../common/request-context';
import type { PostReactionType } from '../generated/prisma/enums';
import { addMember, createGroup, createUser, loginAs } from '../test/auth';
import { setupAuditGroup } from '../test/audit-fixture';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';

const HOUR_MS = 60 * 60 * 1000;

interface Person {
  userId: string;
  membershipId: string;
  cookie: string;
}

describe('registro do feed', () => {
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

  /** Grupo com dois admins (Ana, Beto), dois jogadores (Caio, Davi) e um admin de outro grupo (Elis). */
  async function setup() {
    const group = await createGroup(t);
    const person = async (
      groupId: string,
      nickname: string,
      role: 'ADMIN' | 'PLAYER',
    ): Promise<Person> => {
      const user = await createUser(t);
      const member = await addMember(t, user.id, groupId, { nickname, role });
      return { userId: user.id, membershipId: member.id, cookie: loginAs(t, user.id) };
    };
    const otherGroup = await createGroup(t);
    return {
      group,
      otherGroup,
      ana: await person(group.id, 'Ana', 'ADMIN'),
      beto: await person(group.id, 'Beto', 'ADMIN'),
      caio: await person(group.id, 'Caio', 'PLAYER'),
      davi: await person(group.id, 'Davi', 'PLAYER'),
      elis: await person(otherGroup.id, 'Elis', 'ADMIN'),
    };
  }
  type Ctx = Awaited<ReturnType<typeof setup>>;

  const base = (groupId: string) => `/api/groups/${groupId}/posts`;
  const createPost = (c: Ctx, who: Person, body: object, requestId?: string) => {
    const req = request(server()).post(base(c.group.id)).set('Cookie', who.cookie);
    if (requestId) req.set(REQUEST_ID_HEADER, requestId);
    return req.send(body);
  };
  const editPost = (c: Ctx, who: Person, postId: string, body: object, groupId = c.group.id) =>
    request(server())
      .patch(`${base(groupId)}/${postId}`)
      .set('Cookie', who.cookie)
      .send(body);
  const deletePost = (c: Ctx, who: Person, postId: string, groupId = c.group.id) =>
    request(server())
      .delete(`${base(groupId)}/${postId}`)
      .set('Cookie', who.cookie);
  const addComment = (c: Ctx, who: Person, postId: string, text: string, groupId = c.group.id) =>
    request(server())
      .post(`${base(groupId)}/${postId}/comments`)
      .set('Cookie', who.cookie)
      .send({ text });
  const deleteComment = (c: Ctx, who: Person, postId: string, commentId: string) =>
    request(server())
      .delete(`${base(c.group.id)}/${postId}/comments/${commentId}`)
      .set('Cookie', who.cookie);
  const putReaction = (
    c: Ctx,
    who: Person,
    postId: string,
    reaction: PostReactionType,
    groupId = c.group.id,
  ) =>
    request(server())
      .put(`${base(groupId)}/${postId}/reaction`)
      .set('Cookie', who.cookie)
      .send({ reaction });
  const deleteReaction = (c: Ctx, who: Person, postId: string) =>
    request(server())
      .delete(`${base(c.group.id)}/${postId}/reaction`)
      .set('Cookie', who.cookie);

  const seedPost = (c: Ctx, author: Person = c.ana) =>
    t.prisma.post.create({
      data: {
        groupId: c.group.id,
        authorId: author.membershipId,
        title: 'Resenha',
        body: 'Foi um jogaço.',
      },
    });

  /** O registro do feed (linhas sem rodada), na ordem em que foram criadas. */
  const feedRows = () =>
    t.prisma.auditLog.findMany({
      where: { roundId: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  const auditCount = () => t.prisma.auditLog.count();

  /** Espera até algum pedido do banco ficar parado numa trava de linha (no máximo 5 s). */
  async function waitForLockWait(): Promise<void> {
    for (let i = 0; i < 100; i++) {
      const [row] = await t.prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'`;
      if (row && row.n > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('nenhum pedido ficou esperando a trava');
  }

  describe('resenha', () => {
    it('C24: admin publica, edita e apaga: 3 linhas com o texto antigo e o novo, sem rodada, e elas ficam depois de apagar a resenha', async () => {
      const c = await setup();

      const created = await createPost(
        c,
        c.ana,
        { title: 'Rodada 12', body: 'Foi um jogaço.' },
        'req-publicar-c24',
      ).expect(201);
      const postId = created.body.id as string;
      await editPost(c, c.beto, postId, { title: null, body: 'Foi um jogaço, corrigido.' }).expect(
        200,
      );
      await deletePost(c, c.ana, postId).expect(204);

      const rows = await feedRows();
      expect(rows.map((r) => r.action)).toEqual(['POST_CREATED', 'POST_EDITED', 'POST_DELETED']);
      for (const row of rows) {
        expect(row).toMatchObject({ groupId: c.group.id, roundId: null, postId });
      }
      expect(rows[0]).toMatchObject({
        actorId: c.ana.membershipId,
        before: null,
        after: { postId, title: 'Rodada 12', body: 'Foi um jogaço.' },
        requestId: 'req-publicar-c24',
      });
      expect(rows[1]).toMatchObject({
        actorId: c.beto.membershipId,
        before: { postId, title: 'Rodada 12', body: 'Foi um jogaço.' },
        after: { postId, title: null, body: 'Foi um jogaço, corrigido.' },
      });
      expect(rows[2]).toMatchObject({
        actorId: c.ana.membershipId,
        before: {
          postId,
          authorId: c.ana.membershipId,
          title: null,
          body: 'Foi um jogaço, corrigido.',
          reactionCount: 0,
          commentCount: 0,
        },
        after: null,
      });

      // A resenha não existe mais e as linhas continuam: ninguém perde "quem apagou".
      expect(await t.prisma.post.count()).toBe(0);
      expect(await feedRows()).toHaveLength(3);
    });

    it('C24: apagar leva as contagens de reações e comentários, e o autor original (não quem apagou)', async () => {
      const c = await setup();
      const post = await seedPost(c, c.ana);
      await t.prisma.postReaction.createMany({
        data: [
          { postId: post.id, membershipId: c.caio.membershipId, reaction: 'BALL' },
          { postId: post.id, membershipId: c.davi.membershipId, reaction: 'OSS' },
        ],
      });
      await t.prisma.postComment.create({
        data: { postId: post.id, membershipId: c.caio.membershipId, text: 'Boa!' },
      });

      await deletePost(c, c.beto, post.id).expect(204);

      const [row] = await feedRows();
      expect(row).toMatchObject({
        action: 'POST_DELETED',
        actorId: c.beto.membershipId,
        before: {
          postId: post.id,
          authorId: c.ana.membershipId,
          title: 'Resenha',
          body: 'Foi um jogaço.',
          reactionCount: 2,
          commentCount: 1,
        },
        after: null,
      });
    });

    it('C24: o registro do feed não aparece no log da rodada (a rota continua só com linhas da rodada)', async () => {
      const g = await setupAuditGroup(t);
      const created = await request(server())
        .post(base(g.group.id))
        .set('Cookie', g.admin.cookie)
        .send({ title: null, body: 'Resenha do grupo' })
        .expect(201);
      expect(created.body.id).toEqual(expect.any(String));

      const log = await request(server())
        .get(`/api/groups/${g.group.id}/rounds/${g.round.id}/log`)
        .set('Cookie', g.admin.cookie)
        .expect(200);
      expect(log.body).toEqual([]);
      expect(await feedRows()).toHaveLength(1);
    });
  });

  describe('comentário', () => {
    it('C25: comentar grava sem o texto; apagar (o autor, e o admin o de outro) grava o texto e o autor', async () => {
      const c = await setup();
      const post = await seedPost(c);

      const mine = await addComment(c, c.caio, post.id, 'Boa, Ana!').expect(201);
      await deleteComment(c, c.caio, post.id, mine.body.id).expect(204);
      const theirs = await addComment(c, c.davi, post.id, 'Pipocou').expect(201);
      await deleteComment(c, c.ana, post.id, theirs.body.id).expect(204);

      const rows = await feedRows();
      expect(rows.map((r) => r.action)).toEqual([
        'COMMENT_CREATED',
        'COMMENT_DELETED',
        'COMMENT_CREATED',
        'COMMENT_DELETED',
      ]);
      expect(rows[0]).toMatchObject({
        actorId: c.caio.membershipId,
        postId: post.id,
        before: null,
        after: { postId: post.id, commentId: mine.body.id, length: 'Boa, Ana!'.length },
      });
      expect(JSON.stringify(rows[0])).not.toContain('Boa, Ana!');
      expect(rows[1]).toMatchObject({
        actorId: c.caio.membershipId,
        before: {
          postId: post.id,
          commentId: mine.body.id,
          authorId: c.caio.membershipId,
          text: 'Boa, Ana!',
        },
        after: null,
      });
      expect(rows[2]).toMatchObject({ actorId: c.davi.membershipId });
      expect(rows[3]).toMatchObject({
        actorId: c.ana.membershipId,
        before: {
          postId: post.id,
          commentId: theirs.body.id,
          authorId: c.davi.membershipId,
          text: 'Pipocou',
        },
        after: null,
      });
    });

    it('C25: apagar um comentário que já não existe (404) e comentar em resenha que já não existe (404) não gravam', async () => {
      const c = await setup();
      const post = await seedPost(c);
      await deleteComment(c, c.ana, post.id, 'nao-existe').expect(404);
      await addComment(c, c.caio, 'resenha-que-nao-existe', 'Alô').expect(404);
      expect(await auditCount()).toBe(0);
    });

    it('C25: apagar o mesmo comentário duas vezes ao mesmo tempo grava uma linha só', async () => {
      const c = await setup();
      const post = await seedPost(c);
      const comment = await t.prisma.postComment.create({
        data: { postId: post.id, membershipId: c.caio.membershipId, text: 'Duas vezes' },
      });

      const results = await Promise.all([
        deleteComment(c, c.caio, post.id, comment.id),
        deleteComment(c, c.ana, post.id, comment.id),
      ]);

      // Quem chega depois do commit do outro leva 404 (já foi); nenhum dos dois dá 500.
      for (const res of results) expect([204, 404]).toContain(res.status);
      expect(results.some((res) => res.status === 204)).toBe(true);
      expect((await feedRows()).map((r) => r.action)).toEqual(['COMMENT_DELETED']);
    });
  });

  describe('reação', () => {
    it('C26: colocar, repetir, trocar e tirar grava 3 linhas; o PUT repetido não grava', async () => {
      const c = await setup();
      const post = await seedPost(c);

      await putReaction(c, c.caio, post.id, 'BALL').expect(200);
      await putReaction(c, c.caio, post.id, 'BALL').expect(200);
      await putReaction(c, c.caio, post.id, 'CATFISH').expect(200);
      await deleteReaction(c, c.caio, post.id).expect(200);
      await deleteReaction(c, c.caio, post.id).expect(200);

      const rows = await feedRows();
      expect(rows.map((r) => r.action)).toEqual([
        'REACTION_SET',
        'REACTION_SET',
        'REACTION_REMOVED',
      ]);
      for (const row of rows) {
        expect(row).toMatchObject({ postId: post.id, actorId: c.caio.membershipId, roundId: null });
      }
      expect(rows[0]).toMatchObject({
        before: { postId: post.id, reaction: null },
        after: { postId: post.id, reaction: 'BALL' },
      });
      expect(rows[1]).toMatchObject({
        before: { postId: post.id, reaction: 'BALL' },
        after: { postId: post.id, reaction: 'CATFISH' },
      });
      expect(rows[2]).toMatchObject({
        before: { postId: post.id, reaction: 'CATFISH' },
        after: null,
      });
    });

    it('C33: tirar a reação enquanto a resenha é apagada responde 404 (não 500) e não grava', async () => {
      const c = await setup();
      const post = await seedPost(c);
      await putReaction(c, c.caio, post.id, 'BALL').expect(200);
      const before = await auditCount();

      // Outra transação apaga a resenha (a reação sai em cascata) e segura a trava da linha até ser liberada.
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      let markDeleted!: () => void;
      const deleted = new Promise<void>((resolve) => (markDeleted = resolve));
      const remover = t.prisma.$transaction(
        async (tx) => {
          await tx.post.delete({ where: { id: post.id } });
          markDeleted();
          await gate;
        },
        { timeout: 15_000 },
      );
      await deleted;

      // O DELETE da reação ainda vê a resenha e a reação, e fica esperando a trava da linha.
      const unreact = deleteReaction(c, c.caio, post.id).then((res) => res);
      await waitForLockWait();
      release();
      await remover;

      expect((await unreact).status).toBe(404);
      expect(await auditCount()).toBe(before);
    });

    it('C28: dois PUT de reação do mesmo membro ao mesmo tempo: o estado final bate com a cadeia de linhas', async () => {
      const c = await setup();
      const reactions: PostReactionType[] = ['BALL', 'CATFISH', 'OSS', 'POPCORN'];

      for (let round = 0; round < 8; round++) {
        const post = await seedPost(c);
        const a = reactions[round % reactions.length]!;
        const b = reactions[(round + 1 + (round % 2)) % reactions.length]!;
        const results = await Promise.all([
          putReaction(c, c.caio, post.id, a),
          putReaction(c, c.caio, post.id, b),
        ]);
        expect(results.map((r) => r.status)).toEqual([200, 200]);

        const saved = await t.prisma.postReaction.findMany({ where: { postId: post.id } });
        expect(saved).toHaveLength(1);
        const rows = (await feedRows()).filter((r) => r.postId === post.id);
        // Uma linha por mudança de verdade: duas se trocou, uma se os dois pediram a mesma.
        expect(rows).toHaveLength(a === b ? 1 : 2);

        // A cadeia fecha: parte de "sem reação", cada linha continua da anterior e termina no que está no banco.
        const next = new Map(
          rows.map((r) => [
            (r.before as { reaction: string | null }).reaction,
            (r.after as { reaction: string | null }).reaction,
          ]),
        );
        let current: string | null = null;
        for (let i = 0; i < rows.length; i++) current = next.get(current) ?? null;
        expect(current).toBe(saved[0]!.reaction);
      }
    });
  });

  describe('pedido recusado', () => {
    it('C27: 403, 400 e 404 do feed não deixam linha', async () => {
      const c = await setup();
      const post = await seedPost(c);
      const comment = await t.prisma.postComment.create({
        data: { postId: post.id, membershipId: c.caio.membershipId, text: 'Do Caio' },
      });
      const body = { title: 'T', body: 'Corpo' };

      // 403: jogador mexe em resenha; jogador apaga comentário de outro.
      await createPost(c, c.davi, body).expect(403);
      await editPost(c, c.davi, post.id, body).expect(403);
      await deletePost(c, c.davi, post.id).expect(403);
      await deleteComment(c, c.davi, post.id, comment.id).expect(403);
      // 400: texto inválido.
      await createPost(c, c.ana, { title: null, body: '' }).expect(400);
      await editPost(c, c.ana, post.id, { title: null, body: '' }).expect(400);
      await addComment(c, c.caio, post.id, '').expect(400);
      await putReaction(c, c.caio, post.id, 'NAO_EXISTE' as PostReactionType).expect(400);
      // 404: admin e membro de outro grupo, e resenha que não existe.
      await editPost(c, c.elis, post.id, body, c.otherGroup.id).expect(404);
      await deletePost(c, c.elis, post.id, c.otherGroup.id).expect(404);
      await addComment(c, c.elis, post.id, 'Intruso', c.otherGroup.id).expect(404);
      await putReaction(c, c.elis, post.id, 'BALL', c.otherGroup.id).expect(404);
      await editPost(c, c.ana, 'nao-existe', body).expect(404);
      await deletePost(c, c.ana, 'nao-existe').expect(404);
      // 401: sem sessão.
      await request(server()).post(base(c.group.id)).send(body).expect(401);

      expect(await auditCount()).toBe(0);
      expect(await t.prisma.postComment.count()).toBe(1);
      expect(await t.prisma.postReaction.count()).toBe(0);
    });

    it('C27: se a gravação do registro falha, nem a mudança fica (mesma transação)', async () => {
      const c = await setup();
      const post = await seedPost(c);
      await t.prisma.$executeRawUnsafe(
        `CREATE FUNCTION fail_feed_audit() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'falha forçada no registro'; END; $$ LANGUAGE plpgsql`,
      );
      await t.prisma.$executeRawUnsafe(
        `CREATE TRIGGER fail_feed_audit BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION fail_feed_audit()`,
      );
      try {
        await createPost(c, c.ana, { title: null, body: 'Não fica' }).expect(500);
        await editPost(c, c.ana, post.id, { title: null, body: 'Não muda' }).expect(500);
        await addComment(c, c.caio, post.id, 'Não fica').expect(500);
        await putReaction(c, c.caio, post.id, 'BALL').expect(500);
        await deletePost(c, c.ana, post.id).expect(500);
      } finally {
        await t.prisma.$executeRawUnsafe('DROP TRIGGER fail_feed_audit ON "AuditLog"');
        await t.prisma.$executeRawUnsafe('DROP FUNCTION fail_feed_audit()');
      }

      expect(await t.prisma.post.findMany({ select: { body: true } })).toEqual([
        { body: 'Foi um jogaço.' },
      ]);
      expect(await t.prisma.postComment.count()).toBe(0);
      expect(await t.prisma.postReaction.count()).toBe(0);
      expect(await auditCount()).toBe(0);
    });
  });

  describe('rodada e feed juntos', () => {
    it('C29: apagar a rodada leva as linhas dela e deixa as do feed do mesmo grupo', async () => {
      const g = await setupAuditGroup(t);
      const created = await request(server())
        .post(base(g.group.id))
        .set('Cookie', g.admin.cookie)
        .send({ title: null, body: 'Resenha' })
        .expect(201);
      const roundBase = `/api/groups/${g.group.id}/rounds/${g.round.id}`;
      await request(server())
        .post(`${roundBase}/lineup/publish`)
        .set('Cookie', g.admin.cookie)
        .send({})
        .expect(200);
      await request(server())
        .post(`${roundBase}/lineup/unpublish`)
        .set('Cookie', g.admin.cookie)
        .send({})
        .expect(200);
      expect(await t.prisma.auditLog.count({ where: { roundId: g.round.id } })).toBe(2);

      await request(server()).delete(roundBase).set('Cookie', g.admin.cookie).expect(204);

      expect(await t.prisma.auditLog.count({ where: { roundId: g.round.id } })).toBe(0);
      const rest = await t.prisma.auditLog.findMany();
      expect(rest.map((r) => r.action)).toEqual(['POST_CREATED']);
      expect(rest[0]).toMatchObject({ postId: created.body.id, roundId: null });
    });
  });

  describe('fechamento da votação pelos avisos do feed', () => {
    const alerts = (groupId: string, cookie: string, requestId?: string) => {
      const req = request(server()).get(`/api/groups/${groupId}/feed/alerts`).set('Cookie', cookie);
      if (requestId) req.set(REQUEST_ID_HEADER, requestId);
      return req;
    };

    it('C32: ler os avisos com a votação vencida fecha ali: uma linha automática sem o requestId da leitura, e ler de novo não duplica', async () => {
      const g = await setupAuditGroup(t, { status: 'VOTING', votingOpenedAgoMs: 25 * HOUR_MS });

      await alerts(g.group.id, g.white[0]!.cookie, 'req-avisos-c32').expect(200);

      const rows = await t.prisma.auditLog.findMany({ where: { roundId: g.round.id } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        action: 'VOTING_CLOSED',
        groupId: g.group.id,
        actorId: null,
        before: { status: 'VOTING' },
        after: { status: 'CLOSED', reason: 'DEADLINE_PASSED', voted: 0, total: 14 },
        requestId: null,
      });
      expect((await t.prisma.round.findUniqueOrThrow({ where: { id: g.round.id } })).status).toBe(
        'CLOSED',
      );

      await alerts(g.group.id, g.white[1]!.cookie, 'req-avisos-c32-outra').expect(200);
      await alerts(g.group.id, g.admin.cookie).expect(200);
      expect(await t.prisma.auditLog.count({ where: { roundId: g.round.id } })).toBe(1);
    });

    it('C32: votação ainda dentro do prazo não fecha nem grava; avisos de outro grupo não fecham a daqui', async () => {
      const g = await setupAuditGroup(t, { status: 'VOTING', votingOpenedAgoMs: HOUR_MS });
      const expired = await setupAuditGroup(t, {
        status: 'VOTING',
        votingOpenedAgoMs: 25 * HOUR_MS,
      });

      await alerts(g.group.id, g.white[0]!.cookie).expect(200);

      expect(await t.prisma.auditLog.count({ where: { roundId: g.round.id } })).toBe(0);
      expect(await t.prisma.auditLog.count({ where: { roundId: expired.round.id } })).toBe(0);
    });
  });
});
