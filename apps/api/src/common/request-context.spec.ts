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
