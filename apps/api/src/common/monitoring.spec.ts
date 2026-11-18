import { Controller, Get, HttpException, Param, ServiceUnavailableException } from '@nestjs/common';
import request from 'supertest';
import { GroupMember } from '../auth/group-access.decorator';
import { Public } from '../auth/public.decorator';
import { addMember, createGroup, createUser, loginAs } from '../test/auth';
import { SentryRecorder } from '../test/sentry-recorder';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';
import {
  closeMonitoring,
  flushMonitoring,
  initMonitoring,
  isMonitoringOn,
  monitoringOptionsFromEnv,
  reportBackgroundError,
  scrubEvent,
  sendMonitoringCheck,
} from './monitoring';
import { REQUEST_ID_HEADER } from './request-context';

/** Rotas só de teste, de grupo (exigem sessão e membro): uma estoura erro de verdade, a outra devolve o status pedido. */
@Controller('groups/:groupId/monitoring-probe')
@GroupMember()
class ProbeController {
  @Get('boom')
  boom(): never {
    throw new Error('falha-inesperada-do-teste');
  }

  @Get('unavailable')
  unavailable(): never {
    throw new ServiceUnavailableException({ code: 'FORA_DO_AR', message: 'indisponível' });
  }

  @Get('status/:code')
  status(@Param('code') code: string): never {
    throw new HttpException({ code: `ERRO_${code}`, message: 'recusado' }, Number(code));
  }
}

/** Rota pública que estoura (sem sessão nem grupo no contexto). */
@Public()
@Controller('monitoring-probe-public')
class PublicProbeController {
  @Get('boom')
  boom(): never {
    throw new Error('falha-publica-do-teste');
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DSN = 'https://publica@o0.ingest.sentry.io/1';

describe('Sentry da API', () => {
  describe('limpeza do evento e opções do ambiente', () => {
    it('C3: scrubEvent deixa só o id do usuário e tira pedido (cookies, cabeçalhos, corpo, IP) e rastros', () => {
      const event = scrubEvent({
        type: undefined,
        request: {
          url: 'https://x/api?email=a@b.c',
          cookies: { fut_stats_session: 'jwt' },
          headers: { authorization: 'Bearer segredo' },
          data: { senha: '1' },
        },
        user: { id: 'u1', email: 'a@b.c', username: 'Fulano', ip_address: '1.2.3.4' },
        breadcrumbs: [{ message: 'log com dado' }],
      });
      expect(event).toEqual({ type: undefined, user: { id: 'u1' } });
    });

    it('C3: scrubEvent sem id tira o usuário inteiro', () => {
      expect(scrubEvent({ type: undefined, user: { email: 'a@b.c' } })).toEqual({
        type: undefined,
      });
    });

    it('C1: monitoringOptionsFromEnv trata vazio como ausente e o ambiente cai em NODE_ENV', () => {
      expect(monitoringOptionsFromEnv({ SENTRY_DSN: '', NODE_ENV: 'test' })).toEqual({
        dsn: undefined,
        environment: 'test',
      });
      expect(
        monitoringOptionsFromEnv({ SENTRY_DSN: DSN, SENTRY_ENVIRONMENT: 'production' }),
      ).toEqual({ dsn: DSN, environment: 'production' });
      expect(monitoringOptionsFromEnv({}).environment).toBe('production');
      // O commit do deploy no Render vira o `release` de cada evento.
      expect(monitoringOptionsFromEnv({ RENDER_GIT_COMMIT: 'abc123' }).release).toBe('abc123');
      expect(monitoringOptionsFromEnv({ RENDER_GIT_COMMIT: '' }).release).toBeUndefined();
    });
  });

  describe('C1: sem SENTRY_DSN', () => {
    let t: TestApp;

    beforeAll(async () => {
      t = await createTestApp({ controllers: [ProbeController] });
    });

    beforeEach(async () => {
      await resetDatabase(t.prisma);
    });

    afterAll(async () => {
      await t.app.close();
    });

    it('C1: sem DSN o Sentry nem é iniciado e o erro 500 segue respondendo normalmente', async () => {
      expect(initMonitoring({ dsn: undefined, environment: 'test' })).toBe(false);
      expect(isMonitoringOn()).toBe(false);

      const user = await createUser(t);
      const group = await createGroup(t);
      await addMember(t, user.id, group.id);
      const res = await request(t.app.getHttpServer())
        .get(`/api/groups/${group.id}/monitoring-probe/boom`)
        .set('Cookie', loginAs(t, user.id));

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        statusCode: 500,
        message: 'Internal server error',
        requestId: expect.stringMatching(UUID),
      });
      expect(isMonitoringOn()).toBe(false);
      // Erro de fundo e conferência também viram no-op.
      expect(() => reportBackgroundError(new Error('x'), { source: 'teste' })).not.toThrow();
      expect(sendMonitoringCheck()).toBe(false);
    });
  });

  describe('com SENTRY_DSN (transporte trocado por um gravador)', () => {
    let t: TestApp;
    const recorder = new SentryRecorder();

    beforeAll(async () => {
      // O Jest não deixa o Sentry registrar os ganchos de módulo e ele avisa no console; fora do Jest não acontece.
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      expect(
        initMonitoring({ dsn: DSN, environment: 'staging', transport: recorder.transport }),
      ).toBe(true);
      warn.mockRestore();
      // Sobe a app com o Sentry já ligado, como o main.ts faz.
      t = await createTestApp({ controllers: [ProbeController, PublicProbeController] });
      await flushMonitoring();
    });

    beforeEach(async () => {
      await resetDatabase(t.prisma);
      recorder.reset();
    });

    afterAll(async () => {
      await t.app.close();
      await closeMonitoring();
    });

    const server = () => t.app.getHttpServer();

    async function memberOfGroup() {
      const user = await createUser(t, {
        name: 'Fulano Secreto',
        email: 'fulano.secreto@example.com',
      });
      const group = await createGroup(t);
      await addMember(t, user.id, group.id, { nickname: 'Apelido Secreto' });
      return { user, group, cookie: loginAs(t, user.id) };
    }

    it('C3: erro 500 numa rota autenticada de grupo vira um evento com ambiente, requestId, groupId e user.id', async () => {
      const { user, group, cookie } = await memberOfGroup();

      const res = await request(server())
        .get(`/api/groups/${group.id}/monitoring-probe/boom?email=fulano.secreto@example.com`)
        .set('Cookie', cookie)
        .set('Authorization', 'Bearer cabecalho-secreto')
        .set(REQUEST_ID_HEADER, 'abc-123_DEF45')
        .send({ senha: 'corpo-secreto' });
      await flushMonitoring();

      expect(res.status).toBe(500);
      expect(recorder.errors).toHaveLength(1);
      const [event] = recorder.errors;
      expect(event).toMatchObject({
        environment: 'staging',
        level: 'error',
        tags: { requestId: res.body.requestId, groupId: group.id },
        user: { id: user.id },
      });
      expect(event!.exception?.values?.[0]?.value).toBe('falha-inesperada-do-teste');
      // Sem dado pessoal: só o id do usuário; nada de pedido (cookie, cabeçalhos, corpo, IP, query).
      expect(Object.keys(event!.user ?? {})).toEqual(['id']);
      expect(event!.request).toBeUndefined();
      expect(event!.breadcrumbs).toBeUndefined();
      const raw = JSON.stringify(event);
      for (const secret of [
        'fulano.secreto',
        'Fulano Secreto',
        'Apelido Secreto',
        'cabecalho-secreto',
        'corpo-secreto',
        cookie.split('=')[1]!,
      ]) {
        expect(raw).not.toContain(secret);
      }
    });

    it('C3: 500 numa rota pública leva só o requestId: sem usuário e sem grupo', async () => {
      const res = await request(server()).get('/api/monitoring-probe-public/boom');
      await flushMonitoring();

      expect(res.status).toBe(500);
      expect(recorder.errors).toHaveLength(1);
      const [event] = recorder.errors;
      expect(event!.tags).toEqual({ requestId: res.body.requestId });
      expect(event!.user).toBeUndefined();
    });

    it('C3: um HttpException 5xx (503) também vai para o Sentry', async () => {
      const { group, cookie } = await memberOfGroup();

      const res = await request(server())
        .get(`/api/groups/${group.id}/monitoring-probe/unavailable`)
        .set('Cookie', cookie);
      await flushMonitoring();

      expect(res.status).toBe(503);
      expect(recorder.errors).toHaveLength(1);
      expect(recorder.errors[0]!.tags).toMatchObject({ groupId: group.id });
    });

    it('C4: respostas 400, 401, 403, 404 e 409 não geram nenhum evento', async () => {
      const { group, cookie } = await memberOfGroup();
      const probe = (code: number) =>
        request(server())
          .get(`/api/groups/${group.id}/monitoring-probe/status/${code}`)
          .set('Cookie', cookie);

      for (const code of [400, 403, 404, 409]) {
        const res = await probe(code);
        expect(res.status).toBe(code);
      }
      await request(server()).get('/api/me').expect(401);
      await request(server()).get('/api/rota-que-nao-existe').expect(404);
      // 404 de grupo alheio (não é membro) e 400 de corpo inválido, pelas rotas de verdade.
      const stranger = await createGroup(t);
      await request(server())
        .get(`/api/groups/${stranger.id}/monitoring-probe/boom`)
        .set('Cookie', cookie)
        .expect(404);
      await request(server())
        .post('/api/groups')
        .set('Cookie', cookie)
        .send({ name: '' })
        .expect(400);
      await flushMonitoring();

      expect(recorder.events).toEqual([]);
    });

    it('C5: subir a API não manda nada; a conferência é a mensagem "Teste do Sentry", só quando pedida', async () => {
      recorder.reset();
      const other = await createTestApp();
      await flushMonitoring();
      await other.app.close();
      expect(recorder.events).toEqual([]);

      expect(sendMonitoringCheck()).toBe(true);
      await flushMonitoring();
      expect(recorder.messages).toHaveLength(1);
      expect(recorder.messages[0]).toMatchObject({
        message: 'Teste do Sentry',
        level: 'info',
        environment: 'staging',
      });
      expect(recorder.messages[0]?.exception).toBeUndefined();
      expect(recorder.errors).toHaveLength(0);
    });
  });
});
