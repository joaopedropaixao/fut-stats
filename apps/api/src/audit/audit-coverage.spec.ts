import { RequestMethod } from '@nestjs/common';
import request, { type Test } from 'supertest';
import { FeedController } from '../feed/feed.controller';
import { PostsController } from '../feed/posts.controller';
import { LineupsController } from '../lineups/lineups.controller';
import { MatchController } from '../match/match.controller';
import { VotingController } from '../voting/voting.controller';
import { setupAuditGroup, type AuditGroup } from '../test/audit-fixture';
import { addMember, createGroup, createUser, loginAs } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';

/**
 * Garantia de cobertura do registro da rodada. Rota nova de escrita em `match`, `lineups` ou `voting` entra
 * numa das duas listas abaixo: ou grava no registro (e ganha um driver que prova isso), ou é excluída de
 * propósito (e diz por quê). Sem isso, o teste de rotas falha.
 */

/** Rotas que mudam placar, etapa ou lance: cada 200 delas tem de criar uma linha em `AuditLog`. */
const AUDITED_ROUTES = [
  'POST groups/:groupId/rounds/:roundId/match/start',
  'PUT groups/:groupId/rounds/:roundId/match/score',
  'POST groups/:groupId/rounds/:roundId/match/finish',
  'POST groups/:groupId/rounds/:roundId/match/open-voting',
  'POST groups/:groupId/rounds/:roundId/match/events',
  'DELETE groups/:groupId/rounds/:roundId/match/events/:eventId',
  'POST groups/:groupId/rounds/:roundId/lineup/publish',
  'POST groups/:groupId/rounds/:roundId/lineup/unpublish',
  'POST groups/:groupId/rounds/:roundId/voting/close',
] as const;

/** Rotas de escrita que ficam fora do registro, de propósito. */
const EXCLUDED_ROUTES = {
  'POST groups/:groupId/rounds/:roundId/match/rotation':
    'rodízio: cronômetro da pelada, não muda placar nem etapa',
  'DELETE groups/:groupId/rounds/:roundId/match/rotation':
    'rodízio: cronômetro da pelada, não muda placar nem etapa',
  'PUT groups/:groupId/rounds/:roundId/lineup':
    'rascunho dos times: ainda não é a escalação publicada',
  'POST groups/:groupId/rounds/:roundId/lineup/suggestion': 'só sugere, não grava nada',
  'PUT groups/:groupId/rounds/:roundId/voting/vote':
    'o voto é anônimo: nem a existência dele por pessoa entra',
} as const satisfies Record<string, string>;

/** Rotas do feed que mudam resenha, comentário ou reação: cada 200/201/204 delas tem de criar uma linha em `AuditLog`. */
const AUDITED_FEED_ROUTES = [
  'POST groups/:groupId/posts',
  'PATCH groups/:groupId/posts/:postId',
  'DELETE groups/:groupId/posts/:postId',
  'PUT groups/:groupId/posts/:postId/reaction',
  'DELETE groups/:groupId/posts/:postId/reaction',
  'POST groups/:groupId/posts/:postId/comments',
  'DELETE groups/:groupId/posts/:postId/comments/:commentId',
] as const;

/** Rotas de escrita do feed fora do registro, de propósito (nenhuma hoje). */
const EXCLUDED_FEED_ROUTES = {} as const satisfies Record<string, string>;

const METHODS: Partial<Record<RequestMethod, string>> = {
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.DELETE]: 'DELETE',
};

/** As rotas POST, PUT, PATCH e DELETE dos controllers, lidas dos decorators do Nest. */
function writeRoutesOf(...controllers: (new (...args: never[]) => unknown)[]): string[] {
  const routes: string[] = [];
  for (const controller of controllers) {
    const prefix = Reflect.getMetadata('path', controller) as string;
    for (const name of Object.getOwnPropertyNames(controller.prototype)) {
      const handler = (controller.prototype as Record<string, unknown>)[name];
      if (typeof handler !== 'function') continue;
      const method = METHODS[Reflect.getMetadata('method', handler) as RequestMethod];
      if (!method) continue;
      const path = (Reflect.getMetadata('path', handler) as string).replace(/^\/$/, '');
      routes.push(`${method} ${[prefix, path].filter(Boolean).join('/')}`);
    }
  }
  return routes.sort();
}

describe('cobertura do registro da rodada', () => {
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

  it('toda rota de escrita de match, lineups e voting está na lista de auditadas ou na de excluídas', () => {
    const found = writeRoutesOf(MatchController, LineupsController, VotingController);
    const listed = [...AUDITED_ROUTES, ...Object.keys(EXCLUDED_ROUTES)].sort();

    // Rota nova de escrita que não esteja em nenhuma lista, ou item de lista que não existe mais, falha aqui.
    expect(found).toEqual(listed);
  });

  type Driver = (c: AuditGroup) => Test;

  const base = (c: AuditGroup) => `/api/groups/${c.group.id}/rounds/${c.round.id}`;
  const as = (c: AuditGroup, method: 'post' | 'put' | 'delete', rest: string, cookie: string) =>
    request(t.app.getHttpServer())
      [method](`${base(c)}${rest}`)
      .set('Cookie', cookie);

  /** Como levar cada rota auditada a um 200: a situação em que ela vale e a chamada. */
  const DRIVERS: Record<
    (typeof AUDITED_ROUTES)[number],
    { setup: () => Promise<AuditGroup>; call: Driver }
  > = {
    'POST groups/:groupId/rounds/:roundId/match/start': {
      setup: () => setupAuditGroup(t, { status: 'TEAMS_PUBLISHED' }),
      call: (c) => as(c, 'post', '/match/start', c.admin.cookie).send({}),
    },
    'PUT groups/:groupId/rounds/:roundId/match/score': {
      setup: () => setupAuditGroup(t, { status: 'IN_PROGRESS' }),
      call: (c) => as(c, 'put', '/match/score', c.admin.cookie).send({ WHITE: 1, BLACK: 0 }),
    },
    'POST groups/:groupId/rounds/:roundId/match/finish': {
      setup: () => setupAuditGroup(t, { status: 'IN_PROGRESS' }),
      call: (c) => as(c, 'post', '/match/finish', c.admin.cookie).send({ WHITE: 0, BLACK: 0 }),
    },
    'POST groups/:groupId/rounds/:roundId/match/open-voting': {
      setup: () => setupAuditGroup(t, { status: 'POST_MATCH', score: { WHITE: 0, BLACK: 0 } }),
      call: (c) => as(c, 'post', '/match/open-voting', c.admin.cookie).send({}),
    },
    'POST groups/:groupId/rounds/:roundId/match/events': {
      setup: () => setupAuditGroup(t, { status: 'POST_MATCH', score: { WHITE: 1, BLACK: 0 } }),
      call: (c) =>
        as(c, 'post', '/match/events', c.white[6]!.cookie).send({
          membershipId: c.white[6]!.membershipId,
          type: 'GOAL',
        }),
    },
    'DELETE groups/:groupId/rounds/:roundId/match/events/:eventId': {
      setup: async () => {
        const c = await setupAuditGroup(t, { status: 'POST_MATCH', score: { WHITE: 1, BLACK: 0 } });
        await t.prisma.matchEvent.create({
          data: {
            id: 'evento-da-cobertura',
            roundId: c.round.id,
            membershipId: c.white[6]!.membershipId,
            type: 'GOAL',
            createdById: c.white[6]!.membershipId,
          },
        });
        return c;
      },
      call: (c) => as(c, 'delete', '/match/events/evento-da-cobertura', c.admin.cookie),
    },
    'POST groups/:groupId/rounds/:roundId/lineup/publish': {
      setup: () => setupAuditGroup(t, { status: 'SCHEDULED' }),
      call: (c) => as(c, 'post', '/lineup/publish', c.admin.cookie).send({}),
    },
    'POST groups/:groupId/rounds/:roundId/lineup/unpublish': {
      setup: () => setupAuditGroup(t, { status: 'TEAMS_PUBLISHED' }),
      call: (c) => as(c, 'post', '/lineup/unpublish', c.admin.cookie).send({}),
    },
    'POST groups/:groupId/rounds/:roundId/voting/close': {
      setup: () => setupAuditGroup(t, { status: 'VOTING' }),
      call: (c) => as(c, 'post', '/voting/close', c.admin.cookie).send({}),
    },
  };

  it('toda rota auditada tem um driver de teste, e só ela', () => {
    expect(Object.keys(DRIVERS).sort()).toEqual([...AUDITED_ROUTES].sort());
  });

  it.each(AUDITED_ROUTES)(
    '%s: responder 200 cria uma linha no registro da rodada',
    async (route) => {
      const { setup, call } = DRIVERS[route];
      const c = await setup();
      const before = await t.prisma.auditLog.count({ where: { roundId: c.round.id } });

      await call(c).expect(200);

      expect(await t.prisma.auditLog.count({ where: { roundId: c.round.id } })).toBe(before + 1);
    },
  );

  describe('feed', () => {
    it('C31: toda rota de escrita do feed está na lista de auditadas ou na de excluídas', () => {
      const found = writeRoutesOf(PostsController, FeedController);
      const listed = [...AUDITED_FEED_ROUTES, ...Object.keys(EXCLUDED_FEED_ROUTES)].sort();

      expect(found).toEqual(listed);
    });

    /** Admin, jogador, uma resenha (da Ana) e um comentário do jogador. */
    async function feedSetup() {
      const group = await createGroup(t);
      const person = async (nickname: string, role: 'ADMIN' | 'PLAYER') => {
        const user = await createUser(t);
        const member = await addMember(t, user.id, group.id, { nickname, role });
        return { membershipId: member.id, cookie: loginAs(t, user.id) };
      };
      const admin = await person('Ana', 'ADMIN');
      const player = await person('Caio', 'PLAYER');
      const post = await t.prisma.post.create({
        data: { groupId: group.id, authorId: admin.membershipId, body: 'Resenha' },
      });
      const comment = await t.prisma.postComment.create({
        data: { postId: post.id, membershipId: player.membershipId, text: 'Boa' },
      });
      await t.prisma.postReaction.create({
        data: { postId: post.id, membershipId: player.membershipId, reaction: 'OSS' },
      });
      return { group, admin, player, post, comment };
    }
    type FeedCtx = Awaited<ReturnType<typeof feedSetup>>;

    const feedAs = (
      c: FeedCtx,
      method: 'post' | 'put' | 'patch' | 'delete',
      rest: string,
      cookie: string,
    ) =>
      request(t.app.getHttpServer())
        [method](`/api/groups/${c.group.id}/posts${rest}`)
        .set('Cookie', cookie);

    /** Como levar cada rota do feed a um sucesso: quem chama e o quê. Reação nova (BALL) e tirar a que existe (OSS). */
    const FEED_DRIVERS: Record<
      (typeof AUDITED_FEED_ROUTES)[number],
      { call: (c: FeedCtx) => Test; status: number }
    > = {
      'POST groups/:groupId/posts': {
        status: 201,
        call: (c) => feedAs(c, 'post', '', c.admin.cookie).send({ title: null, body: 'Nova' }),
      },
      'PATCH groups/:groupId/posts/:postId': {
        status: 200,
        call: (c) =>
          feedAs(c, 'patch', `/${c.post.id}`, c.admin.cookie).send({ title: 'T', body: 'Editada' }),
      },
      'DELETE groups/:groupId/posts/:postId': {
        status: 204,
        call: (c) => feedAs(c, 'delete', `/${c.post.id}`, c.admin.cookie),
      },
      'PUT groups/:groupId/posts/:postId/reaction': {
        status: 200,
        call: (c) =>
          feedAs(c, 'put', `/${c.post.id}/reaction`, c.admin.cookie).send({ reaction: 'BALL' }),
      },
      'DELETE groups/:groupId/posts/:postId/reaction': {
        status: 200,
        call: (c) => feedAs(c, 'delete', `/${c.post.id}/reaction`, c.player.cookie),
      },
      'POST groups/:groupId/posts/:postId/comments': {
        status: 201,
        call: (c) =>
          feedAs(c, 'post', `/${c.post.id}/comments`, c.player.cookie).send({ text: 'Outra' }),
      },
      'DELETE groups/:groupId/posts/:postId/comments/:commentId': {
        status: 204,
        call: (c) => feedAs(c, 'delete', `/${c.post.id}/comments/${c.comment.id}`, c.player.cookie),
      },
    };

    it('C31: toda rota de escrita auditada do feed tem um driver de teste, e só ela', () => {
      expect(Object.keys(FEED_DRIVERS).sort()).toEqual([...AUDITED_FEED_ROUTES].sort());
    });

    it.each(AUDITED_FEED_ROUTES)(
      'C31: %s: responder com sucesso cria uma linha no registro',
      async (route) => {
        const { call, status } = FEED_DRIVERS[route];
        const c = await feedSetup();
        const before = await t.prisma.auditLog.count({ where: { groupId: c.group.id } });

        await call(c).expect(status);

        expect(await t.prisma.auditLog.count({ where: { groupId: c.group.id } })).toBe(before + 1);
      },
    );
  });
});
