import { sentryCheckResultSchema, tickResultSchema } from '@fut-stats/shared';
import request from 'supertest';
import {
  closeMonitoring,
  flushMonitoring,
  initMonitoring,
  reportBackgroundError,
} from '../common/monitoring';
import { RoundLockService } from '../rounds/round-lock.service';
import { addMember, createGroup, createUser } from '../test/auth';
import { SentryRecorder } from '../test/sentry-recorder';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';
import { InternalModule } from './internal.module';

const HOUR_MS = 60 * 60 * 1000;
const SECRET = 'segredo-do-despertador-dos-testes-0123456789';
const bearer = `Bearer ${SECRET}`;
const DSN = 'https://publica@o0.ingest.sentry.io/1';

/**
 * Falha no fechamento não pode sumir em silêncio: em produção o despertador é o único fechador agendado. A falha vai
 * ao Sentry e o tick responde 500, para o job do GitHub ficar vermelho e mandar e-mail.
 */
describe('despertador: falhas e conferência do Sentry', () => {
  let t: TestApp;
  const recorder = new SentryRecorder();

  beforeAll(async () => {
    // O Jest não deixa o Sentry registrar os ganchos de módulo e ele avisa no console; fora do Jest não acontece.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    initMonitoring({ dsn: DSN, environment: 'production', transport: recorder.transport });
    warn.mockRestore();
    t = await createTestApp({ imports: [InternalModule.forEnvironment(SECRET)] });
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
    await flushMonitoring();
    recorder.reset();
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await t.app.close();
    await closeMonitoring();
  });

  const tick = () => request(t.app.getHttpServer()).post('/api/internal/tick');

  /** Uma rodada em votação aberta há `openedAgoMs` num grupo novo. */
  async function votingRound(openedAgoMs: number) {
    const group = await createGroup(t, { name: 'Pelada do Sábado' });
    const user = await createUser(t);
    const member = await addMember(t, user.id, group.id, { nickname: 'Zé' });
    const round = await t.prisma.round.create({
      data: {
        groupId: group.id,
        scheduledAt: new Date(Date.now() - 2 * 24 * HOUR_MS),
        status: 'VOTING',
        whiteGoals: 0,
        blackGoals: 0,
        votingOpenedAt: new Date(Date.now() - openedAgoMs),
        teamPlayers: {
          create: [{ membershipId: member.id, team: 'WHITE', position: 'DEFENDER' }],
        },
      },
    });
    return { group, round };
  }

  it('fechamento que falha: tick responde 500 com { closedVotings, failed }, a rodada fica em votação e a falha vai ao Sentry', async () => {
    const broken = await votingRound(25 * HOUR_MS);
    const ok = await votingRound(30 * HOUR_MS);
    const lock = t.app.get(RoundLockService);
    const original = lock.withRoundLock.bind(lock);
    jest
      .spyOn(lock, 'withRoundLock')
      .mockImplementation((groupId, roundId, work) =>
        roundId === broken.round.id
          ? Promise.reject(new Error('falha-do-banco-no-fechamento'))
          : original(groupId, roundId, work),
      );

    const res = await tick().set('Authorization', bearer).expect(500);
    await flushMonitoring();

    expect(tickResultSchema.parse(res.body)).toEqual({ closedVotings: 1, failed: 1 });
    expect(
      (await t.prisma.round.findUniqueOrThrow({ where: { id: broken.round.id } })).status,
    ).toBe('VOTING');
    expect((await t.prisma.round.findUniqueOrThrow({ where: { id: ok.round.id } })).status).toBe(
      'CLOSED',
    );
    expect(recorder.errors).toHaveLength(1);
    const [event] = recorder.errors;
    expect(event?.exception?.values?.[0]?.value).toBe('falha-do-banco-no-fechamento');
    expect(event?.tags).toMatchObject({
      source: 'voting-close',
      groupId: broken.group.id,
      roundId: broken.round.id,
    });
    expect(event?.environment).toBe('production');
  });

  it('sem falha o tick segue 200 com failed: 0 e nada vai ao Sentry', async () => {
    await votingRound(25 * HOUR_MS);

    const res = await tick().set('Authorization', bearer).expect(200);
    await flushMonitoring();

    expect(res.body).toEqual({ closedVotings: 1, failed: 0 });
    expect(recorder.events).toEqual([]);
  });

  it('erro de fundo leva as tags do contexto e nunca lança', async () => {
    reportBackgroundError(new Error('ouvinte-quebrado'), {
      source: 'round-event-listener',
      groupId: 'g1',
      roundId: 'r1',
      tags: { type: 'VOTING_CLOSED', vazio: undefined },
    });
    await flushMonitoring();

    expect(recorder.errors).toHaveLength(1);
    expect(recorder.errors[0]?.tags).toEqual({
      source: 'round-event-listener',
      groupId: 'g1',
      roundId: 'r1',
      type: 'VOTING_CLOSED',
    });
  });

  it('a API não avisa mais o Sentry a cada subida (no Render gratuito, cada tick é uma partida a frio)', async () => {
    const other = await createTestApp({ imports: [InternalModule.forEnvironment(SECRET)] });
    await other.app.close();
    await flushMonitoring();

    expect(recorder.events).toEqual([]);
  });

  it('R5: POST /api/internal/sentry-check com o segredo manda "Teste do Sentry" (info) e diz que mandou', async () => {
    const res = await request(t.app.getHttpServer())
      .post('/api/internal/sentry-check')
      .set('Authorization', bearer)
      .expect(200);
    await flushMonitoring();

    expect(sentryCheckResultSchema.parse(res.body)).toEqual({ sent: true });
    expect(recorder.messages).toHaveLength(1);
    expect(recorder.messages[0]).toMatchObject({
      message: 'Teste do Sentry',
      level: 'info',
      environment: 'production',
    });
  });

  it('R5: sentry-check sem o segredo é 401 e não manda nada', async () => {
    await request(t.app.getHttpServer()).post('/api/internal/sentry-check').expect(401);
    await flushMonitoring();

    expect(recorder.events).toEqual([]);
  });
});
