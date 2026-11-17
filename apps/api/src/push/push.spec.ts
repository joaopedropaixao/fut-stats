import request from 'supertest';
import { createUser, loginAs } from '../test/auth';
import {
  disableVapid,
  enableVapid,
  FakePushSender,
  TEST_VAPID_ENV,
} from '../test/fake-push-sender';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';
import { PushSender } from './push-sender';

const keys = { p256dh: 'BPubKeyDoAparelho', auth: 'segredoDeAuth' };
const endpointA = 'https://push.example.com/send/aparelho-a';

describe('push: rotas', () => {
  let t: TestApp;
  let sender: FakePushSender;

  beforeAll(async () => {
    enableVapid();
    t = await createTestApp({ overrides: [{ provide: PushSender, useClass: FakePushSender }] });
    sender = t.app.get<FakePushSender>(PushSender);
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
    sender.reset();
  });

  afterAll(async () => {
    await t.app.close();
    disableVapid();
  });

  const server = () => t.app.getHttpServer();
  const put = (cookie: string, body: unknown) =>
    request(server())
      .put('/api/push/subscriptions')
      .set('Cookie', cookie)
      .send(body as object);
  const del = (cookie: string, body: unknown) =>
    request(server())
      .delete('/api/push/subscriptions')
      .set('Cookie', cookie)
      .send(body as object);

  async function login() {
    const user = await createUser(t);
    return { user, cookie: loginAs(t, user.id) };
  }

  it('C6: com as chaves VAPID, /push/config diz enabled true e a chave pública', async () => {
    const { cookie } = await login();
    const res = await request(server()).get('/api/push/config').set('Cookie', cookie).expect(200);
    expect(res.body).toEqual({ enabled: true, publicKey: TEST_VAPID_ENV.VAPID_PUBLIC_KEY });
  });

  it('C9: PUT com endpoint e chaves responde 204 e grava uma linha do usuário', async () => {
    const { user, cookie } = await login();
    await put(cookie, { endpoint: endpointA, keys })
      .set('User-Agent', 'Aparelho-Teste/1')
      .expect(204);
    const rows = await t.prisma.pushSubscription.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: user.id,
      endpoint: endpointA,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: 'Aparelho-Teste/1',
    });
  });

  it('C10: o mesmo endpoint de novo continua uma linha; por outro usuário, passa para ele', async () => {
    const first = await login();
    const second = await login();
    await put(first.cookie, { endpoint: endpointA, keys }).expect(204);
    await put(first.cookie, {
      endpoint: endpointA,
      keys: { p256dh: 'novaChave', auth: 'novoAuth' },
    }).expect(204);
    let rows = await t.prisma.pushSubscription.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: first.user.id, p256dh: 'novaChave', auth: 'novoAuth' });

    await put(second.cookie, { endpoint: endpointA, keys }).expect(204);
    rows = await t.prisma.pushSubscription.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(second.user.id);
  });

  it('C11: corpo sem keys, endpoint que não é https e endpoint com mais de 2000 caracteres dão 400', async () => {
    const { cookie } = await login();
    await put(cookie, { endpoint: endpointA }).expect(400);
    await put(cookie, { endpoint: 'http://push.example.com/x', keys }).expect(400);
    await put(cookie, { endpoint: `https://push.example.com/${'a'.repeat(2000)}`, keys }).expect(
      400,
    );
    await put(cookie, { endpoint: endpointA, keys: { p256dh: '', auth: 'x' } }).expect(400);
    await del(cookie, {}).expect(400);
    expect(await t.prisma.pushSubscription.count()).toBe(0);
  });

  it('C12: DELETE apaga a linha do próprio aparelho; a de outro usuário e a inexistente respondem 204 sem apagar', async () => {
    const mine = await login();
    const other = await login();
    await put(mine.cookie, { endpoint: endpointA, keys }).expect(204);
    const otherEndpoint = 'https://push.example.com/send/aparelho-b';
    await put(other.cookie, { endpoint: otherEndpoint, keys }).expect(204);

    await del(mine.cookie, { endpoint: otherEndpoint }).expect(204);
    expect(await t.prisma.pushSubscription.count()).toBe(2);

    await del(mine.cookie, { endpoint: 'https://push.example.com/send/nao-existe' }).expect(204);
    expect(await t.prisma.pushSubscription.count()).toBe(2);

    await del(mine.cookie, { endpoint: endpointA }).expect(204);
    const rows = await t.prisma.pushSubscription.findMany();
    expect(rows.map((r) => r.endpoint)).toEqual([otherEndpoint]);
  });

  it('C13: sem sessão, toda rota de push dá 401', async () => {
    await request(server()).get('/api/push/config').expect(401);
    await request(server())
      .put('/api/push/subscriptions')
      .send({ endpoint: endpointA, keys })
      .expect(401);
    await request(server())
      .delete('/api/push/subscriptions')
      .send({ endpoint: endpointA })
      .expect(401);
    await request(server()).post('/api/push/test').expect(401);
  });

  it('C20: POST /push/test manda o aviso de teste para o aparelho do usuário; sem assinatura, sent 0', async () => {
    const { cookie } = await login();
    const none = await request(server()).post('/api/push/test').set('Cookie', cookie).expect(200);
    expect(none.body).toEqual({ sent: 0 });
    expect(sender.sent).toHaveLength(0);

    await put(cookie, { endpoint: endpointA, keys }).expect(204);
    const res = await request(server()).post('/api/push/test').set('Cookie', cookie).expect(200);
    expect(res.body).toEqual({ sent: 1 });
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]).toMatchObject({
      endpoint: endpointA,
      payload: { type: 'TEST', body: 'Aviso de teste. Está funcionando.' },
    });
  });

  it('C20: o teste só vai para os aparelhos do próprio usuário e apaga o que o serviço diz que sumiu', async () => {
    const mine = await login();
    const other = await login();
    const gone = 'https://push.example.com/send/sumiu';
    await put(mine.cookie, { endpoint: endpointA, keys }).expect(204);
    await put(mine.cookie, { endpoint: gone, keys }).expect(204);
    await put(other.cookie, { endpoint: 'https://push.example.com/send/outro', keys }).expect(204);
    sender.answers.set(gone, 'gone');

    const res = await request(server())
      .post('/api/push/test')
      .set('Cookie', mine.cookie)
      .expect(200);
    expect(res.body).toEqual({ sent: 1 });
    expect(sender.sent.map((s) => s.endpoint)).toEqual([endpointA]);
    expect(await t.prisma.pushSubscription.count({ where: { endpoint: gone } })).toBe(0);
  });
});

describe('push: sem chaves VAPID', () => {
  let t: TestApp;
  let sender: FakePushSender;

  beforeAll(async () => {
    disableVapid();
    t = await createTestApp({ overrides: [{ provide: PushSender, useClass: FakePushSender }] });
    sender = t.app.get<FakePushSender>(PushSender);
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
    sender.reset();
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('C7: a API sobe, /push/config diz enabled false e o teste não tenta enviar', async () => {
    const user = await createUser(t);
    const cookie = loginAs(t, user.id);
    const res = await request(t.app.getHttpServer())
      .get('/api/push/config')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body).toEqual({ enabled: false, publicKey: null });

    await request(t.app.getHttpServer())
      .put('/api/push/subscriptions')
      .set('Cookie', cookie)
      .send({ endpoint: endpointA, keys })
      .expect(204);
    const test = await request(t.app.getHttpServer())
      .post('/api/push/test')
      .set('Cookie', cookie)
      .expect(200);
    expect(test.body).toEqual({ sent: 0 });
    expect(sender.sent).toHaveLength(0);
  });
});
