import { RequestMethod } from '@nestjs/common';
import request from 'supertest';
import { LineupsController } from '../lineups/lineups.controller';
import { MatchController } from '../match/match.controller';
import {
  setupAuditGroup,
  setupOutsider,
  type AuditGroup,
  type Person,
} from '../test/audit-fixture';
import { addMember, createGroup, createUser, loginAs } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';
import { VotingController } from '../voting/voting.controller';
import { VotingService } from '../voting/voting.service';
import {
  RoundEventsService,
  type RoundEvent,
  type RoundEventScope,
  type RoundEventType,
} from './round-events.service';

const HOUR_MS = 3_600_000;

describe('sinal único de eventos da rodada: o serviço', () => {
  const sample = (over: Partial<RoundEvent> = {}): RoundEvent => ({
    groupId: 'g1',
    roundId: 'r1',
    type: 'SCORE_SET',
    scopes: ['match'],
    actorMembershipId: 'm1',
    ...over,
  });

  it('S1: `on` ouve tudo e `subscribe` ouve só a rodada (do grupo) pedida', () => {
    const events = new RoundEventsService();
    const all: RoundEvent[] = [];
    const one: RoundEvent[] = [];
    events.on((e) => all.push(e));
    events.subscribe('g1', 'r1', (e) => one.push(e));

    events.emit(sample());
    events.emit(sample({ roundId: 'r2' }));
    events.emit(sample({ groupId: 'g2' }));

    expect(all).toHaveLength(3);
    expect(one).toEqual([sample()]);
  });

  it('S2: cancelar a inscrição para de receber e `listenerCount` volta ao que era', () => {
    const events = new RoundEventsService();
    const heard: RoundEvent[] = [];
    const cancelOne = events.subscribe('g1', 'r1', (e) => heard.push(e));
    const cancelAll = events.on((e) => heard.push(e));
    expect(events.listenerCount('g1', 'r1')).toBe(1);

    cancelOne();
    cancelAll();
    events.emit(sample());

    expect(heard).toEqual([]);
    expect(events.listenerCount('g1', 'r1')).toBe(0);
  });

  it('S3: mais de 10 ouvintes não geram aviso de limite (`setMaxListeners(0)`)', () => {
    const events = new RoundEventsService();
    const warn = jest.spyOn(process, 'emitWarning').mockImplementation(() => undefined);

    for (let i = 0; i < 50; i += 1) events.subscribe('g1', 'r1', () => undefined);

    expect(warn).not.toHaveBeenCalled();
    expect(events.listenerCount('g1', 'r1')).toBe(50);
    warn.mockRestore();
  });

  it('S4: um ouvinte que lança não impede os outros, e `emit` nunca lança', () => {
    const events = new RoundEventsService();
    const heard: string[] = [];
    events.on(() => {
      throw new Error('ouvinte quebrado');
    });
    events.subscribe('g1', 'r1', () => {
      throw new Error('outro quebrado');
    });
    events.subscribe('g1', 'r1', (e) => heard.push(e.type));
    events.on((e) => heard.push(`todos:${e.type}`));

    expect(() => events.emit(sample())).not.toThrow();

    expect(heard.sort()).toEqual(['SCORE_SET', 'todos:SCORE_SET']);
  });
});

describe('sinal único de eventos da rodada: as escritas', () => {
  let t: TestApp;
  let heard: RoundEvent[];
  let stop: () => void;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
    heard = [];
    stop = t.app.get(RoundEventsService).on((event) => heard.push(event));
  });

  afterEach(() => stop());

  afterAll(async () => {
    await t.app.close();
  });

  const base = (c: AuditGroup) => `/api/groups/${c.group.id}/rounds/${c.round.id}`;
  const api = (c: AuditGroup, method: 'post' | 'put' | 'delete', rest: string, person: Person) =>
    request(t.app.getHttpServer())
      [method](`${base(c)}${rest}`)
      .set('Cookie', person.cookie);

  /** Um reserva em cada time: o rodízio só liga com reservas. */
  async function addReserves(c: AuditGroup) {
    for (const team of ['WHITE', 'BLACK'] as const) {
      const user = await createUser(t);
      const member = await addMember(t, user.id, c.group.id, { nickname: `R-${team}` });
      await t.prisma.teamPlayer.create({
        data: {
          roundId: c.round.id,
          membershipId: member.id,
          team,
          position: 'FORWARD',
          isReserve: true,
        },
      });
      await t.prisma.attendance.create({
        data: { roundId: c.round.id, membershipId: member.id, confirmed: true },
      });
    }
  }

  /** Pacote de votos de `voter`: 6 para os outros 13, Craque e Perna de Pau. */
  const ballot = (c: AuditGroup, voter: Person) => {
    const others = [...c.white, ...c.black].filter((p) => p.membershipId !== voter.membershipId);
    return {
      ratings: others.map((p) => ({ targetId: p.membershipId, value: 6 })),
      mvpId: others[0]!.membershipId,
      flopId: others[1]!.membershipId,
    };
  };
  const vote = (c: AuditGroup, voter: Person) =>
    api(c, 'put', '/voting/vote', voter).send(ballot(c, voter));

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

  /** Rotas de escrita que não sinalizam: rascunho dos times (em `SCHEDULED`), sugestão (não grava) e tudo da presença e da rodada que não muda etapa. */
  const NOT_SIGNALLED = [
    'PUT groups/:groupId/rounds/:roundId/lineup',
    'POST groups/:groupId/rounds/:roundId/lineup/suggestion',
  ];

  interface Driver {
    setup: () => Promise<AuditGroup>;
    call: (c: AuditGroup) => request.Test;
    status: number;
    type: RoundEventType;
    scopes: RoundEventScope[];
    /** Quem pediu (ou `null` se foi automático). */
    actor: (c: AuditGroup) => string | null;
  }

  const byAdmin = (c: AuditGroup) => c.admin.membershipId;

  const DRIVERS: Record<string, Driver> = {
    'POST groups/:groupId/rounds/:roundId/match/start': {
      setup: () => setupAuditGroup(t, { status: 'TEAMS_PUBLISHED' }),
      call: (c) => api(c, 'post', '/match/start', c.admin).send({}),
      status: 200,
      type: 'MATCH_STARTED',
      scopes: ['match', 'status'],
      actor: byAdmin,
    },
    'PUT groups/:groupId/rounds/:roundId/match/score': {
      setup: () => setupAuditGroup(t, { status: 'IN_PROGRESS' }),
      call: (c) => api(c, 'put', '/match/score', c.admin).send({ WHITE: 1, BLACK: 0 }),
      status: 200,
      type: 'SCORE_SET',
      scopes: ['match'],
      actor: byAdmin,
    },
    'POST groups/:groupId/rounds/:roundId/match/finish': {
      setup: () => setupAuditGroup(t, { status: 'IN_PROGRESS' }),
      call: (c) => api(c, 'post', '/match/finish', c.admin).send({ WHITE: 0, BLACK: 0 }),
      status: 200,
      type: 'MATCH_FINISHED',
      scopes: ['match', 'status'],
      actor: byAdmin,
    },
    'POST groups/:groupId/rounds/:roundId/match/open-voting': {
      setup: () => setupAuditGroup(t, { status: 'POST_MATCH', score: { WHITE: 0, BLACK: 0 } }),
      call: (c) => api(c, 'post', '/match/open-voting', c.admin).send({}),
      status: 200,
      type: 'VOTING_OPENED',
      scopes: ['match', 'status'],
      actor: byAdmin,
    },
    'POST groups/:groupId/rounds/:roundId/match/events': {
      setup: () => setupAuditGroup(t, { status: 'POST_MATCH', score: { WHITE: 1, BLACK: 0 } }),
      call: (c) =>
        api(c, 'post', '/match/events', c.white[6]!).send({
          membershipId: c.white[6]!.membershipId,
          type: 'GOAL',
        }),
      status: 200,
      type: 'EVENT_LAUNCHED',
      scopes: ['match'],
      actor: (c) => c.white[6]!.membershipId,
    },
    'DELETE groups/:groupId/rounds/:roundId/match/events/:eventId': {
      setup: async () => {
        const c = await setupAuditGroup(t, { status: 'POST_MATCH', score: { WHITE: 1, BLACK: 0 } });
        await t.prisma.matchEvent.create({
          data: {
            id: 'evento-do-sinal',
            roundId: c.round.id,
            membershipId: c.white[6]!.membershipId,
            type: 'GOAL',
            createdById: c.white[6]!.membershipId,
          },
        });
        return c;
      },
      call: (c) => api(c, 'delete', '/match/events/evento-do-sinal', c.admin),
      status: 200,
      type: 'EVENT_REMOVED',
      scopes: ['match'],
      actor: byAdmin,
    },
    'POST groups/:groupId/rounds/:roundId/match/rotation': {
      setup: async () => {
        const c = await setupAuditGroup(t, { status: 'IN_PROGRESS' });
        await addReserves(c);
        return c;
      },
      call: (c) => api(c, 'post', '/match/rotation', c.admin).send({ minutes: 60 }),
      status: 200,
      type: 'ROTATION_STARTED',
      scopes: ['match'],
      actor: byAdmin,
    },
    'DELETE groups/:groupId/rounds/:roundId/match/rotation': {
      setup: async () => {
        const c = await setupAuditGroup(t, { status: 'IN_PROGRESS' });
        await addReserves(c);
        await t.prisma.round.update({
          where: { id: c.round.id },
          data: { rotationStartedAt: new Date(), rotationMinutes: 60 },
        });
        return c;
      },
      call: (c) => api(c, 'delete', '/match/rotation', c.admin),
      status: 200,
      type: 'ROTATION_STOPPED',
      scopes: ['match'],
      actor: byAdmin,
    },
    'POST groups/:groupId/rounds/:roundId/lineup/publish': {
      setup: () => setupAuditGroup(t, { status: 'SCHEDULED' }),
      call: (c) => api(c, 'post', '/lineup/publish', c.admin).send({}),
      status: 200,
      type: 'TEAMS_PUBLISHED',
      scopes: ['status'],
      actor: byAdmin,
    },
    'POST groups/:groupId/rounds/:roundId/lineup/unpublish': {
      setup: () => setupAuditGroup(t, { status: 'TEAMS_PUBLISHED' }),
      call: (c) => api(c, 'post', '/lineup/unpublish', c.admin).send({}),
      status: 200,
      type: 'TEAMS_UNPUBLISHED',
      scopes: ['status'],
      actor: byAdmin,
    },
    'PUT groups/:groupId/rounds/:roundId/voting/vote': {
      setup: () => setupAuditGroup(t, { status: 'VOTING' }),
      call: (c) => vote(c, c.white[0]!),
      status: 200,
      type: 'VOTE_CAST',
      scopes: ['voting'],
      actor: (c) => c.white[0]!.membershipId,
    },
    'POST groups/:groupId/rounds/:roundId/voting/close': {
      setup: () => setupAuditGroup(t, { status: 'VOTING' }),
      call: (c) => api(c, 'post', '/voting/close', c.admin).send({}),
      status: 200,
      type: 'VOTING_CLOSED',
      scopes: ['voting', 'status'],
      actor: byAdmin,
    },
  };

  it('E1: o teste cobre toda rota de escrita de match, lineups e voting', () => {
    const found = writeRoutesOf(MatchController, LineupsController, VotingController).filter(
      (route) => !NOT_SIGNALLED.includes(route),
    );

    expect(Object.keys(DRIVERS).sort()).toEqual(found);
  });

  it.each(Object.keys(DRIVERS))(
    'E2: %s sinaliza uma vez, com tipo, escopos e ator',
    async (route) => {
      const { setup, call, status, type, scopes, actor } = DRIVERS[route]!;
      const c = await setup();

      await call(c).expect(status);

      expect(heard).toEqual([
        { groupId: c.group.id, roundId: c.round.id, type, scopes, actorMembershipId: actor(c) },
      ]);
    },
  );

  it('E3: ROUND_CREATED sai ao marcar a rodada, com `status` e o admin como ator', async () => {
    const group = await createGroup(t);
    const user = await createUser(t);
    const admin = await addMember(t, user.id, group.id, { role: 'ADMIN' });

    const res = await request(t.app.getHttpServer())
      .post(`/api/groups/${group.id}/rounds`)
      .set('Cookie', loginAs(t, user.id))
      .send({ scheduledAt: new Date(Date.now() + 24 * HOUR_MS).toISOString() })
      .expect(201);

    expect(heard).toEqual([
      {
        groupId: group.id,
        roundId: res.body.id as string,
        type: 'ROUND_CREATED',
        scopes: ['status'],
        actorMembershipId: admin.id,
      },
    ]);
  });

  it('E3: rodada recusada (jogador comum, data sem fuso) não sinaliza', async () => {
    const group = await createGroup(t);
    const adminUser = await createUser(t);
    await addMember(t, adminUser.id, group.id, { role: 'ADMIN' });
    const playerUser = await createUser(t);
    await addMember(t, playerUser.id, group.id);
    const post = (cookie: string, scheduledAt: string) =>
      request(t.app.getHttpServer())
        .post(`/api/groups/${group.id}/rounds`)
        .set('Cookie', cookie)
        .send({ scheduledAt });

    await post(loginAs(t, playerUser.id), new Date(Date.now() + 24 * HOUR_MS).toISOString()).expect(
      403,
    );
    await post(loginAs(t, adminUser.id), '2026-10-29T20:00:00').expect(400);

    expect(heard).toEqual([]);
  });

  it('E4: o último voto fecha a votação sem ator (o voto é anônimo) e sinaliza `voting` e `status`', async () => {
    const c = await setupAuditGroup(t, { status: 'VOTING' });
    const everyone = [...c.white, ...c.black];
    for (const voter of everyone.slice(0, -1)) await vote(c, voter).expect(200);
    heard.length = 0;

    await vote(c, everyone.at(-1)!).expect(200);

    expect(heard).toEqual([
      {
        groupId: c.group.id,
        roundId: c.round.id,
        type: 'VOTING_CLOSED',
        scopes: ['voting', 'status'],
        actorMembershipId: null,
      },
    ]);
  });

  it('E4: voto depois do prazo é recusado, fecha a rodada e sinaliza sem ator', async () => {
    const c = await setupAuditGroup(t, { status: 'VOTING', votingOpenedAgoMs: 30 * HOUR_MS });

    await vote(c, c.white[0]!).expect(409);

    expect(heard).toEqual([
      {
        groupId: c.group.id,
        roundId: c.round.id,
        type: 'VOTING_CLOSED',
        scopes: ['voting', 'status'],
        actorMembershipId: null,
      },
    ]);
  });

  it('E4: `closeDueVotings` sinaliza uma vez por rodada que fechou de verdade, sem ator', async () => {
    const due = await setupAuditGroup(t, { status: 'VOTING', votingOpenedAgoMs: 30 * HOUR_MS });
    const open = await setupAuditGroup(t, { status: 'VOTING' });

    const closed = await t.app.get(VotingService).closeDueVotings(new Date());

    expect(closed).toBe(1);
    expect(heard).toEqual([
      {
        groupId: due.group.id,
        roundId: due.round.id,
        type: 'VOTING_CLOSED',
        scopes: ['voting', 'status'],
        actorMembershipId: null,
      },
    ]);
    expect(heard.some((e) => e.roundId === open.round.id)).toBe(false);
  });

  it('E5: escrita recusada (409, 403, 404) não sinaliza', async () => {
    const c = await setupAuditGroup(t, { status: 'POST_MATCH', score: { WHITE: 1, BLACK: 0 } });
    const v = await setupAuditGroup(t, { status: 'VOTING' });

    // 409: o placar do Branco é 1 e o gol dele já foi lançado.
    await api(c, 'post', '/match/events', c.admin)
      .send({ membershipId: c.white[6]!.membershipId, type: 'GOAL' })
      .expect(200);
    heard.length = 0;
    await api(c, 'post', '/match/events', c.admin)
      .send({ membershipId: c.white[5]!.membershipId, type: 'GOAL' })
      .expect(409);
    await api(c, 'post', '/match/start', c.admin).send({}).expect(409);
    // 403: jogador comum.
    await api(c, 'post', '/match/open-voting', c.white[0]!).send({}).expect(403);
    await api(v, 'post', '/voting/close', v.white[0]!).send({}).expect(403);
    // 404: lance que não existe, voto de quem não jogou.
    await api(c, 'delete', '/match/events/nao-existe', c.admin).expect(404);
    await vote(v, v.bench).expect(403);
    await api(v, 'put', '/voting/vote', v.white[0]!)
      .send({ ratings: [], mvpId: 'x', flopId: 'y' })
      .expect(400);

    expect(heard).toEqual([]);
  });

  it('E6: o placar repetido não muda nada e não sinaliza', async () => {
    const c = await setupAuditGroup(t, { status: 'IN_PROGRESS' });
    await api(c, 'put', '/match/score', c.admin).send({ WHITE: 1, BLACK: 0 }).expect(200);
    heard.length = 0;

    await api(c, 'put', '/match/score', c.admin).send({ WHITE: 1, BLACK: 0 }).expect(200);

    expect(heard).toEqual([]);
  });

  it('E7: `subscribe` ouve só a própria rodada, nunca a de outro grupo', async () => {
    const a = await setupAuditGroup(t, { status: 'IN_PROGRESS' });
    const other = await setupAuditGroup(t, { status: 'IN_PROGRESS' });
    await setupOutsider(t);
    const events = t.app.get(RoundEventsService);
    const heardA: RoundEvent[] = [];
    const cancel = events.subscribe(a.group.id, a.round.id, (e) => heardA.push(e));
    expect(events.listenerCount(a.group.id, a.round.id)).toBe(1);

    await api(other, 'put', '/match/score', other.admin).send({ WHITE: 3, BLACK: 3 }).expect(200);
    await api(a, 'put', '/match/score', a.admin).send({ WHITE: 1, BLACK: 0 }).expect(200);
    cancel();

    expect(heardA.map((e) => e.roundId)).toEqual([a.round.id]);
    expect(events.listenerCount(a.group.id, a.round.id)).toBe(0);
  });

  it('E8: nunca leva o conteúdo do voto: nem notas, nem Craque, nem Perna de Pau', async () => {
    const c = await setupAuditGroup(t, { status: 'VOTING' });
    const voter = c.white[0]!;
    const { mvpId, flopId } = ballot(c, voter);

    await vote(c, voter).expect(200);

    expect(heard).toHaveLength(1);
    expect(Object.keys(heard[0]!).sort()).toEqual([
      'actorMembershipId',
      'groupId',
      'roundId',
      'scopes',
      'type',
    ]);
    const text = JSON.stringify(heard[0]);
    for (const secret of [mvpId, flopId, 'ratings', 'targetId']) expect(text).not.toContain(secret);
  });

  it('E9: um ouvinte que lança não derruba a escrita nem esconde o sinal dos outros', async () => {
    const c = await setupAuditGroup(t, { status: 'IN_PROGRESS' });
    const stopBroken = t.app.get(RoundEventsService).on(() => {
      throw new Error('ouvinte quebrado');
    });

    await api(c, 'put', '/match/score', c.admin).send({ WHITE: 1, BLACK: 0 }).expect(200);
    stopBroken();

    expect(heard.map((e) => e.type)).toEqual(['SCORE_SET']);
  });
});
