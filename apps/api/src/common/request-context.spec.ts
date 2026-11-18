import { Controller, Get, Logger } from '@nestjs/common';
import { ConsoleLogger } from '@nestjs/common';
import request from 'supertest';
import { Public } from '../auth/public.decorator';
import { addMember, createGroup, createUser, loginAs } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';
import { createAppLogger } from './app-logger';
import { REQUEST_ID_HEADER, resolveRequestId } from './request-context';

/** Rota só de teste: estoura um erro que ninguém previu (vira 500). */
@Public()
@Controller('request-context-probe')
class BoomController {
  @Get('boom')
  boom(): never {
    throw new Error('falha-secreta-do-banco');
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('requestId e log de pedido', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ controllers: [BoomController] });
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await t.app.close();
  });

  const server = () => t.app.getHttpServer();

  /** As linhas de log de pedido (objetos) que o `Logger` recebeu. */
  function captureRequestLogs() {
    const spy = jest.spyOn(Logger.prototype, 'log');
    return () =>
      spy.mock.calls
        .map(([message]) => message as unknown)
        .filter(
          (message): message is Record<string, unknown> =>
            typeof message === 'object' && message !== null && 'durationMs' in message,
        );
  }

  async function memberOfGroup() {
    const user = await createUser(t, {
      name: 'Fulano Secreto',
      email: 'fulano.secreto@example.com',
    });
    const group = await createGroup(t);
    await addMember(t, user.id, group.id, { nickname: 'Apelido Secreto' });
    return { user, group, cookie: loginAs(t, user.id) };
  }

  it('C15: toda resposta traz x-request-id (UUID), com e sem sessão', async () => {
    const anonymous = await request(server()).get('/api/health');
    expect(anonymous.headers[REQUEST_ID_HEADER]).toMatch(UUID);

    const unauthorized = await request(server()).get('/api/me');
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers[REQUEST_ID_HEADER]).toMatch(UUID);

    const { group, cookie } = await memberOfGroup();
    const authenticated = await request(server())
      .get(`/api/groups/${group.id}`)
      .set('Cookie', cookie);
    expect(authenticated.status).toBe(200);
    expect(authenticated.headers[REQUEST_ID_HEADER]).toMatch(UUID);

    const missing = await request(server()).get('/api/nao-existe');
    expect(missing.status).toBe(404);
    expect(missing.headers[REQUEST_ID_HEADER]).toMatch(UUID);

    expect(anonymous.headers[REQUEST_ID_HEADER]).not.toBe(authenticated.headers[REQUEST_ID_HEADER]);
  });

  describe('C27/C28: o id do cliente só vale fora de produção', () => {
    /** Roda o pedido com `NODE_ENV` trocado (lido a cada pedido) e põe o valor de volta. */
    async function withNodeEnv<T>(nodeEnv: string | undefined, run: () => Promise<T>): Promise<T> {
      const before = process.env.NODE_ENV;
      if (nodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = nodeEnv;
      try {
        return await run();
      } finally {
        process.env.NODE_ENV = before;
      }
    }

    it('C27: em produção o x-request-id válido do cliente é ignorado: a resposta e o log trazem um UUID novo', async () => {
      const lines = captureRequestLogs();
      const response = await withNodeEnv('production', () =>
        request(server()).get('/api/me').set(REQUEST_ID_HEADER, 'abc-123_DEF45'),
      );

      // /api/me sem sessão: 401, mas a linha de log do pedido existe (o health não loga).
      expect(response.status).toBe(401);
      expect(response.headers[REQUEST_ID_HEADER]).toMatch(UUID);
      expect(response.headers[REQUEST_ID_HEADER]).not.toBe('abc-123_DEF45');
      const logged = lines().map((line) => line.requestId);
      expect(logged).toContain(response.headers[REQUEST_ID_HEADER]);
      expect(logged).not.toContain('abc-123_DEF45');
    });

    it('C27: em produção o erro 500 devolve no corpo o id do servidor, nunca o do cliente', async () => {
      const response = await withNodeEnv('production', () =>
        request(server())
          .get('/api/request-context-probe/boom')
          .set(REQUEST_ID_HEADER, 'abc-123_DEF45'),
      );
      expect(response.status).toBe(500);
      expect(response.body.requestId).toMatch(UUID);
      expect(response.body.requestId).toBe(response.headers[REQUEST_ID_HEADER]);
    });

    it('C27: sem NODE_ENV vale produção (o padrão da API): o id do cliente é ignorado', () => {
      expect(resolveRequestId('abc-123_DEF45', {})).toMatch(UUID);
      expect(resolveRequestId('abc-123_DEF45', { NODE_ENV: 'production' })).toMatch(UUID);
      expect(resolveRequestId('abc-123_DEF45', { NODE_ENV: 'staging' })).toMatch(UUID);
    });

    it.each(['development', 'test'])(
      'C28: em %s o valor válido recebido é usado',
      async (nodeEnv) => {
        const response = await withNodeEnv(nodeEnv, () =>
          request(server()).get('/api/health').set(REQUEST_ID_HEADER, 'abc-123_DEF45'),
        );
        expect(response.headers[REQUEST_ID_HEADER]).toBe('abc-123_DEF45');
        expect(resolveRequestId('abc-123_DEF45', { NODE_ENV: nodeEnv })).toBe('abc-123_DEF45');
      },
    );

    it('C28: fora de produção o valor inválido segue ignorado', () => {
      expect(resolveRequestId('abc 123', { NODE_ENV: 'development' })).toMatch(UUID);
    });
  });

  it('C16: x-request-id válido volta igual na resposta', async () => {
    const response = await request(server())
      .get('/api/health')
      .set(REQUEST_ID_HEADER, 'abc-123_DEF45');
    expect(response.headers[REQUEST_ID_HEADER]).toBe('abc-123_DEF45');
  });

  it.each([
    ['com 200 caracteres', 'a'.repeat(200)],
    ['com espaço', 'abc 123 def45'],
    ['curto demais', 'abc'],
    ['com caractere fora da lista', 'abc/123;def45'],
  ])('C17: x-request-id %s é ignorado e a API gera um novo', async (_, bad) => {
    const response = await request(server()).get('/api/health').set(REQUEST_ID_HEADER, bad);
    expect(response.status).toBe(200);
    expect(response.headers[REQUEST_ID_HEADER]).not.toBe(bad);
    expect(response.headers[REQUEST_ID_HEADER]).toMatch(UUID);
  });

  it('C17: resolveRequestId ignora quebra de linha, vazio e valor que não é texto', () => {
    for (const bad of [
      'abc-123\nINJETADO',
      'abc-123\r\nX: y',
      '',
      undefined,
      ['abc-123_DEF45'],
      42,
    ]) {
      expect(resolveRequestId(bad)).toMatch(UUID);
    }
    expect(resolveRequestId('A'.repeat(64))).toBe('A'.repeat(64));
    expect(resolveRequestId('A'.repeat(65))).toMatch(UUID);
    expect(resolveRequestId('A'.repeat(7))).toMatch(UUID);
  });

  it('C18: uma linha por pedido autenticado, com requestId, método, caminho sem query, status, duração, userId e groupId', async () => {
    const lines = captureRequestLogs();
    const { user, group, cookie } = await memberOfGroup();

    const response = await request(server())
      .get(`/api/groups/${group.id}?segredo=1&email=fulano.secreto@example.com`)
      .set('Cookie', cookie)
      .set(REQUEST_ID_HEADER, 'req-do-teste-18');
    expect(response.status).toBe(200);

    const mine = lines().filter((line) => line.requestId === 'req-do-teste-18');
    expect(mine).toHaveLength(1);
    const [line] = mine;
    expect(Object.keys(line!).sort()).toEqual(
      ['durationMs', 'groupId', 'method', 'path', 'requestId', 'status', 'userId'].sort(),
    );
    expect(line).toMatchObject({
      method: 'GET',
      path: `/api/groups/${group.id}`,
      status: 200,
      userId: user.id,
      groupId: group.id,
    });
    expect(typeof line!.durationMs).toBe('number');

    const raw = JSON.stringify(line);
    for (const secret of [
      'fulano.secreto',
      'Fulano Secreto',
      'Apelido Secreto',
      'segredo',
      cookie,
    ]) {
      expect(raw).not.toContain(secret);
    }
  });

  it('C18: pedido recusado também gera linha (401 sem usuário, 404 de grupo alheio sem groupId)', async () => {
    const lines = captureRequestLogs();
    const { user, cookie } = await memberOfGroup();
    const other = await createGroup(t);

    await request(server()).get('/api/me').set(REQUEST_ID_HEADER, 'req-sem-sessao-18');
    await request(server())
      .get(`/api/groups/${other.id}`)
      .set('Cookie', cookie)
      .set(REQUEST_ID_HEADER, 'req-grupo-alheio-18');

    const find = (id: string) => lines().find((line) => line.requestId === id);
    expect(find('req-sem-sessao-18')).toMatchObject({ status: 401, userId: null, groupId: null });
    expect(find('req-grupo-alheio-18')).toMatchObject({
      status: 404,
      userId: user.id,
      groupId: null,
    });
  });

  describe('C30: errorCode na linha de pedido com status >= 400', () => {
    /** Admin, jogador e uma resenha com um comentário do jogador (para o outro jogador tentar apagar). */
    async function feedScenario() {
      const group = await createGroup(t);
      const make = async (nickname: string, role: 'ADMIN' | 'PLAYER') => {
        const user = await createUser(t);
        const member = await addMember(t, user.id, group.id, { nickname, role });
        return { user, member, cookie: loginAs(t, user.id) };
      };
      const admin = await make('Ana', 'ADMIN');
      const author = await make('Caio', 'PLAYER');
      const other = await make('Davi', 'PLAYER');
      const post = await t.prisma.post.create({
        data: { groupId: group.id, authorId: admin.member.id, body: 'Resenha' },
      });
      const comment = await t.prisma.postComment.create({
        data: { postId: post.id, membershipId: author.member.id, text: 'Boa!' },
      });
      return { group, admin, author, other, post, comment };
    }

    it('C30: 403 NOT_OWN_COMMENT leva errorCode, status e userId, sem corpo nem texto do comentário', async () => {
      const lines = captureRequestLogs();
      const c = await feedScenario();

      await request(server())
        .delete(`/api/groups/${c.group.id}/posts/${c.post.id}/comments/${c.comment.id}`)
        .set('Cookie', c.other.cookie)
        .set(REQUEST_ID_HEADER, 'req-nao-e-seu-30')
        .expect(403);

      const line = lines().find((l) => l.requestId === 'req-nao-e-seu-30');
      expect(line).toMatchObject({
        status: 403,
        errorCode: 'NOT_OWN_COMMENT',
        userId: c.other.user.id,
        groupId: c.group.id,
      });
      expect(typeof line!.durationMs).toBe('number');
      expect(JSON.stringify(line)).not.toContain('Boa!');
    });

    it('C30: 400 de validação leva o código VALIDATION_FAILED, e o corpo da resposta não muda', async () => {
      const lines = captureRequestLogs();
      const c = await feedScenario();

      const response = await request(server())
        .post(`/api/groups/${c.group.id}/posts/${c.post.id}/comments`)
        .set('Cookie', c.other.cookie)
        .set(REQUEST_ID_HEADER, 'req-texto-vazio-30')
        .send({ text: '' })
        .expect(400);

      expect(response.body).not.toHaveProperty('code');
      expect(lines().find((l) => l.requestId === 'req-texto-vazio-30')).toMatchObject({
        status: 400,
        errorCode: 'VALIDATION_FAILED',
      });
    });

    it('C30: recusa sem código no corpo (404, 401) sai com errorCode nulo', async () => {
      const lines = captureRequestLogs();
      const c = await feedScenario();

      await request(server())
        .get(`/api/groups/${c.group.id}/posts/nao-existe`)
        .set('Cookie', c.other.cookie)
        .set(REQUEST_ID_HEADER, 'req-sem-codigo-404')
        .expect(404);
      await request(server())
        .get('/api/me')
        .set(REQUEST_ID_HEADER, 'req-sem-codigo-401')
        .expect(401);

      const find = (id: string) => lines().find((l) => l.requestId === id);
      expect(find('req-sem-codigo-404')).toMatchObject({ status: 404, errorCode: null });
      expect(find('req-sem-codigo-401')).toMatchObject({ status: 401, errorCode: null });
    });

    it('C30: pedido 2xx não leva a chave errorCode', async () => {
      const lines = captureRequestLogs();
      const c = await feedScenario();

      await request(server())
        .get(`/api/groups/${c.group.id}/posts/${c.post.id}/comments`)
        .set('Cookie', c.other.cookie)
        .set(REQUEST_ID_HEADER, 'req-tudo-certo-30')
        .expect(200);

      const line = lines().find((l) => l.requestId === 'req-tudo-certo-30');
      expect(line).toMatchObject({ status: 200 });
      expect(line).not.toHaveProperty('errorCode');
    });
  });

  it('C19: erro 500 loga requestId e pilha e responde { statusCode, message, requestId } sem a pilha', async () => {
    const errors = jest.spyOn(Logger.prototype, 'error');

    const response = await request(server())
      .get('/api/request-context-probe/boom')
      .set(REQUEST_ID_HEADER, 'req-do-teste-19');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      statusCode: 500,
      message: 'Internal server error',
      requestId: 'req-do-teste-19',
    });
    expect(JSON.stringify(response.body)).not.toContain('falha-secreta-do-banco');
    expect(response.headers[REQUEST_ID_HEADER]).toBe('req-do-teste-19');

    const call = errors.mock.calls.find(
      ([message]) => (message as { requestId?: string }).requestId === 'req-do-teste-19',
    );
    expect(call).toBeDefined();
    expect(call![0]).toMatchObject({
      requestId: 'req-do-teste-19',
      message: 'falha-secreta-do-banco',
    });
    expect(call![1]).toContain('falha-secreta-do-banco');
    expect(call![1]).toContain('at ');
  });

  it('C19: erro de rota conhecido (404) segue com o corpo de sempre, sem requestId', async () => {
    const response = await request(server()).get('/api/nao-existe');
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ statusCode: 404 });
    expect(response.body).not.toHaveProperty('requestId');
  });

  it('C21: com NODE_ENV=test o log de pedido não escreve nada na saída', async () => {
    const stdout = jest.spyOn(process.stdout, 'write');
    const stderr = jest.spyOn(process.stderr, 'write');
    const { group, cookie } = await memberOfGroup();

    await request(server()).get(`/api/groups/${group.id}`).set('Cookie', cookie);
    await request(server()).get('/api/request-context-probe/boom');

    const written = [...stdout.mock.calls, ...stderr.mock.calls].map(([chunk]) => String(chunk));
    expect(
      written.filter((text) => text.includes('durationMs') || text.includes('falha-secreta')),
    ).toEqual([]);
  });

  it('C21: produção sai em JSON; dev e teste usam o texto do Nest', () => {
    expect(createAppLogger('production')).toBeInstanceOf(ConsoleLogger);
    expect(createAppLogger(undefined)).toBeInstanceOf(ConsoleLogger);
    expect(createAppLogger('development')).toBeUndefined();
    expect(createAppLogger('test')).toBeUndefined();
  });

  it('C21: o logger de produção escreve uma linha JSON com o objeto do pedido', () => {
    const logger = createAppLogger('production') as ConsoleLogger;
    const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    logger.log({ requestId: 'abc-123_DEF45', status: 200 }, 'HTTP');
    const [line] = write.mock.calls.map(([chunk]) => String(chunk));
    expect(JSON.parse(line!)).toMatchObject({
      level: 'log',
      context: 'HTTP',
      message: { requestId: 'abc-123_DEF45', status: 200 },
    });
  });

  it('C22: GET /api/health responde como hoje, com x-request-id, e não escreve linha de log', async () => {
    const lines = captureRequestLogs();

    const response = await request(server())
      .get('/api/health')
      .set(REQUEST_ID_HEADER, 'req-do-teste-22');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers[REQUEST_ID_HEADER]).toBe('req-do-teste-22');

    // O log sai quando a resposta termina; dá um respiro para a linha (se existisse) aparecer.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(lines().filter((line) => line.requestId === 'req-do-teste-22')).toEqual([]);

    // E a linha de um pedido normal segue saindo.
    await request(server()).get('/api/me').set(REQUEST_ID_HEADER, 'req-do-teste-22b');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(lines().filter((line) => line.requestId === 'req-do-teste-22b')).toHaveLength(1);
  });
});
