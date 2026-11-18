import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { RequestMethod } from '@nestjs/common';
import { roundStreamEventSchema, type RoundStreamEvent } from '@fut-stats/shared';
import request from 'supertest';
import { LineupsController } from '../lineups/lineups.controller';
import { MatchController } from '../match/match.controller';
import { VotingController } from '../voting/voting.controller';
import { VotingService } from '../voting/voting.service';
import {
  setupAuditGroup,
  setupOutsider,
  type AuditGroup,
  type Person,
} from '../test/audit-fixture';
import { addMember, createUser } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';
import { RoundEventsService } from '../events/round-events.service';
import { LiveController } from './live.controller';
import { LiveService } from './live.service';

/** Um cliente do canal: abre o fluxo de verdade (porta aberta) e lê o corpo aos poucos. */
interface Stream {
  status: number;
  headers: http.IncomingHttpHeaders;
  /** Corpo recebido até agora. */
  raw: string;
  /** Mensagens `changed` já lidas, na ordem. */
  changes: RoundStreamEvent[];
  /** `event: ready` chegou. */
  ready: boolean;
  /** Pulsos (`: ping`) recebidos. */
  pings: number;
  waitFor(predicate: () => boolean, ms?: number): Promise<void>;
  close(): void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('canal ao vivo da rodada', () => {
  let t: TestApp;
  let baseUrl: string;
  const opened: Stream[] = [];

  beforeAll(async () => {
    t = await createTestApp();
    await t.app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(t.app.getHttpServer().address() as AddressInfo).port}`;
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
  });

  afterEach(() => {
    for (const stream of opened.splice(0)) stream.close();
  });

  afterAll(async () => {
    await t.app.close();
  });

  const streamPath = (groupId: string, roundId: string) =>
    `/api/groups/${groupId}/rounds/${roundId}/stream`;

  /** Abre o canal e devolve quando os cabeçalhos chegam. Qualquer status; só o 200 vira fluxo. */
  function open(path: string, cookie?: string): Promise<Stream> {
    return new Promise((resolve, reject) => {
      const req = http.get(
        `${baseUrl}${path}`,
        { headers: cookie ? { Cookie: cookie } : {}, agent: false },
        (res) => {
          const stream: Stream = {
            status: res.statusCode ?? 0,
            headers: res.headers,
            raw: '',
            changes: [],
            ready: false,
            pings: 0,
            async waitFor(predicate, ms = 3000) {
              const limit = Date.now() + ms;
              while (!predicate()) {
                if (Date.now() > limit) throw new Error(`Tempo esgotado. Recebido:\n${stream.raw}`);
                await sleep(10);
              }
            },
            close: () => {
              req.destroy();
              res.destroy();
            },
          };
          let pending = '';
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => {
            stream.raw += chunk;
            pending += chunk;
            let end: number;
            while ((end = pending.indexOf('\n\n')) !== -1) {
              const frame = pending.slice(0, end);
              pending = pending.slice(end + 2);
              if (frame.startsWith(': ping')) stream.pings += 1;
              else if (frame.startsWith('event: ready')) stream.ready = true;
              else if (frame.startsWith('event: changed')) {
                const data = frame.split('\n').find((line) => line.startsWith('data: '))!;
                stream.changes.push(JSON.parse(data.slice('data: '.length)) as RoundStreamEvent);
              }
            }
          });
          res.on('error', () => undefined);
          opened.push(stream);
          resolve(stream);
        },
      );
      req.on('error', reject);
    });
  }

  /** Abre o canal da rodada como `person` e espera o `ready`. */
  async function connect(c: AuditGroup, person: Person = c.admin, roundId = c.round.id) {
    const stream = await open(streamPath(c.group.id, roundId), person.cookie);
    await stream.waitFor(() => stream.ready);
    return stream;
  }

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

  const base = (c: AuditGroup) => `/api/groups/${c.group.id}/rounds/${c.round.id}`;
  const api = (c: AuditGroup, method: 'post' | 'put' | 'delete', rest: string, person: Person) =>
    request(t.app.getHttpServer())
      [method](`${base(c)}${rest}`)
      .set('Cookie', person.cookie);

  /** Pacote de votos de `voter`: 6 para todos os outros dos 14, Craque e Perna de Pau. */
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

  describe('C1: abrir o canal', () => {
    it('C1: membro ativo recebe 200, os cabeçalhos do fluxo e o `event: ready` primeiro', async () => {
      const c = await setupAuditGroup(t, { status: 'IN_PROGRESS' });

      const stream = await connect(c, c.white[0]!);

      expect(stream.status).toBe(200);
      expect(stream.headers['content-type']).toMatch(/^text\/event-stream/);
      expect(stream.headers['cache-control']).toBe('no-cache, no-transform');
      expect(stream.headers['x-accel-buffering']).toBe('no');
      expect(stream.raw.startsWith('event: ready\n')).toBe(true);
      expect(stream.raw).toContain('data: {}');
      expect(stream.raw).toContain('retry: 3000');
    });
  });

  describe('C2: dois membros recebem o aviso', () => {
    it('C2: o lance do admin chega aos dois em menos de 1 s, com `scopes: [match]` e `at`', async () => {
      const c = await setupAuditGroup(t, { status: 'POST_MATCH', score: { WHITE: 1, BLACK: 0 } });
      const [a, b] = [await connect(c, c.admin), await connect(c, c.black[2]!)];

      const startedAt = Date.now();
      await api(c, 'post', '/match/events', c.admin)
        .send({ membershipId: c.white[6]!.membershipId, type: 'GOAL' })
        .expect(200);
      await Promise.all([a, b].map((s) => s.waitFor(() => s.changes.length === 1, 1000)));

      expect(Date.now() - startedAt).toBeLessThan(1000);
      for (const s of [a, b]) {
        expect(s.changes).toEqual([{ scopes: ['match'], at: expect.any(String) }]);
        expect(roundStreamEventSchema.safeParse(s.changes[0]).success).toBe(true);
      }
    });
  });

  describe('C3: cada escrita avisa com os escopos da tabela', () => {
    const METHODS: Partial<Record<RequestMethod, string>> = {
      [RequestMethod.POST]: 'POST',
      [RequestMethod.PUT]: 'PUT',
      [RequestMethod.PATCH]: 'PATCH',
      [RequestMethod.DELETE]: 'DELETE',
    };
    /** As rotas POST, PUT, PATCH e DELETE dos controllers, lidas dos decorators do Nest (como na cobertura do registro). */
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

    /** Fora do canal: rascunho dos times (em `SCHEDULED` ninguém ouve) e sugestão (não grava). */
    const NOT_LIVE = [
      'PUT groups/:groupId/rounds/:roundId/lineup',
      'POST groups/:groupId/rounds/:roundId/lineup/suggestion',
    ];

    type Scopes = RoundStreamEvent['scopes'];
    interface Driver {
      setup: () => Promise<AuditGroup>;
      call: (c: AuditGroup) => request.Test;
      status: number;
      scopes: Scopes;
    }

    const DRIVERS: Record<string, Driver> = {
      'POST groups/:groupId/rounds/:roundId/match/start': {
        setup: () => setupAuditGroup(t, { status: 'TEAMS_PUBLISHED' }),
        call: (c) => api(c, 'post', '/match/start', c.admin).send({}),
        status: 200,
        scopes: ['match', 'status'],
      },
      'PUT groups/:groupId/rounds/:roundId/match/score': {
        setup: () => setupAuditGroup(t, { status: 'IN_PROGRESS' }),
        call: (c) => api(c, 'put', '/match/score', c.admin).send({ WHITE: 1, BLACK: 0 }),
        status: 200,
        scopes: ['match'],
      },
      'POST groups/:groupId/rounds/:roundId/match/finish': {
        setup: () => setupAuditGroup(t, { status: 'IN_PROGRESS' }),
        call: (c) => api(c, 'post', '/match/finish', c.admin).send({ WHITE: 0, BLACK: 0 }),
        status: 200,
        scopes: ['match', 'status'],
      },
      'POST groups/:groupId/rounds/:roundId/match/open-voting': {
        setup: () => setupAuditGroup(t, { status: 'POST_MATCH', score: { WHITE: 0, BLACK: 0 } }),
        call: (c) => api(c, 'post', '/match/open-voting', c.admin).send({}),
        status: 200,
        scopes: ['match', 'status'],
      },
      'POST groups/:groupId/rounds/:roundId/match/events': {
        setup: () => setupAuditGroup(t, { status: 'POST_MATCH', score: { WHITE: 1, BLACK: 0 } }),
        call: (c) =>
          api(c, 'post', '/match/events', c.white[6]!).send({
            membershipId: c.white[6]!.membershipId,
            type: 'GOAL',
          }),
        status: 200,
        scopes: ['match'],
      },
      'DELETE groups/:groupId/rounds/:roundId/match/events/:eventId': {
        setup: async () => {
          const c = await setupAuditGroup(t, {
            status: 'POST_MATCH',
            score: { WHITE: 1, BLACK: 0 },
          });
          await t.prisma.matchEvent.create({
            data: {
              id: 'evento-do-canal',
              roundId: c.round.id,
              membershipId: c.white[6]!.membershipId,
              type: 'GOAL',
              createdById: c.white[6]!.membershipId,
            },
          });
          return c;
        },
        call: (c) => api(c, 'delete', '/match/events/evento-do-canal', c.admin),
        status: 200,
        scopes: ['match'],
      },
      'POST groups/:groupId/rounds/:roundId/match/rotation': {
        setup: async () => {
          const c = await setupAuditGroup(t, { status: 'IN_PROGRESS' });
          await addReserves(c);
          return c;
        },
        call: (c) => api(c, 'post', '/match/rotation', c.admin).send({ minutes: 60 }),
        status: 200,
        scopes: ['match'],
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
        scopes: ['match'],
      },
      'POST groups/:groupId/rounds/:roundId/lineup/publish': {
        setup: () => setupAuditGroup(t, { status: 'SCHEDULED' }),
        call: (c) => api(c, 'post', '/lineup/publish', c.admin).send({}),
        status: 200,
        scopes: ['status'],
      },
      'POST groups/:groupId/rounds/:roundId/lineup/unpublish': {
        setup: () => setupAuditGroup(t, { status: 'TEAMS_PUBLISHED' }),
        call: (c) => api(c, 'post', '/lineup/unpublish', c.admin).send({}),
        status: 200,
        scopes: ['status'],
      },
      'PUT groups/:groupId/rounds/:roundId/voting/vote': {
        setup: () => setupAuditGroup(t, { status: 'VOTING' }),
        call: (c) => vote(c, c.white[0]!),
        status: 200,
        scopes: ['voting'],
      },
      'POST groups/:groupId/rounds/:roundId/voting/close': {
        setup: () => setupAuditGroup(t, { status: 'VOTING' }),
        call: (c) => api(c, 'post', '/voting/close', c.admin).send({}),
        status: 200,
        scopes: ['voting', 'status'],
      },
    };

    it('C3: o teste cobre toda rota de escrita de match, lineups e voting', () => {
      const found = writeRoutesOf(MatchController, LineupsController, VotingController).filter(
        (route) => !NOT_LIVE.includes(route),
      );

      expect(Object.keys(DRIVERS).sort()).toEqual(found);
    });

    it.each(Object.keys(DRIVERS))('C3: %s avisa com os escopos da tabela', async (route) => {
      const { setup, call, status, scopes } = DRIVERS[route]!;
      const c = await setup();
      const stream = await connect(c);

      await call(c).expect(status);
      await stream.waitFor(() => stream.changes.length >= 1, 1000);
      // Um aviso só por escrita: dá tempo de um segundo chegar, se houvesse.
      await sleep(100);

      expect(stream.changes).toEqual([{ scopes, at: expect.any(String) }]);
    });

    it('C3: o último voto fecha a votação e avisa `voting` e `status`', async () => {
      const c = await setupAuditGroup(t, { status: 'VOTING' });
      const everyone = [...c.white, ...c.black];
      for (const voter of everyone.slice(0, -1)) await vote(c, voter).expect(200);
      const stream = await connect(c);

      await vote(c, everyone.at(-1)!).expect(200);
      await stream.waitFor(() => stream.changes.length >= 1, 1000);
      await sleep(100);

      expect(stream.changes).toEqual([{ scopes: ['voting', 'status'], at: expect.any(String) }]);
      expect((await t.prisma.round.findUniqueOrThrow({ where: { id: c.round.id } })).status).toBe(
        'CLOSED',
      );
    });

    it('C3: o voto recusado por prazo vencido fecha a rodada e avisa `voting` e `status`', async () => {
      // A votação abriu há 30 h e o prazo do grupo é de 24 h.
      const c = await setupAuditGroup(t, { status: 'VOTING', votingOpenedAgoMs: 30 * 3_600_000 });
      const stream = await connect(c);

      await vote(c, c.white[0]!).expect(409);
      await stream.waitFor(() => stream.changes.length >= 1, 1000);

      expect(stream.changes).toEqual([{ scopes: ['voting', 'status'], at: expect.any(String) }]);
    });

    it('C3: repetir o mesmo placar não muda nada e não avisa', async () => {
      const c = await setupAuditGroup(t, { status: 'IN_PROGRESS' });
      await api(c, 'put', '/match/score', c.admin).send({ WHITE: 1, BLACK: 0 }).expect(200);
      const stream = await connect(c);

      await api(c, 'put', '/match/score', c.admin).send({ WHITE: 1, BLACK: 0 }).expect(200);
      await api(c, 'put', '/match/score', c.admin).send({ WHITE: 2, BLACK: 0 }).expect(200);
      await stream.waitFor(() => stream.changes.length >= 1, 1000);
      await sleep(100);

      expect(stream.changes).toHaveLength(1);
    });
  });

  describe('C4: escrita recusada não avisa', () => {
    it('C4: 409, 403 e 404 não avisam; só a escrita que vale chega', async () => {
      const c = await setupAuditGroup(t, { status: 'POST_MATCH', score: { WHITE: 1, BLACK: 0 } });
      const stream = await connect(c);

      // 409: o placar do Branco é 1 e o gol dele já está lançado (o segundo passa do placar).
      await api(c, 'post', '/match/events', c.admin)
        .send({ membershipId: c.white[6]!.membershipId, type: 'GOAL' })
        .expect(200);
      await stream.waitFor(() => stream.changes.length === 1, 1000);
      await api(c, 'post', '/match/events', c.admin)
        .send({ membershipId: c.white[5]!.membershipId, type: 'GOAL' })
        .expect(409);
      // 403: jogador comum não abre a votação.
      await api(c, 'post', '/match/open-voting', c.white[0]!).send({}).expect(403);
      // 404: lance que não existe.
      await api(c, 'delete', '/match/events/nao-existe', c.admin).expect(404);
      // 409: etapa errada.
      await api(c, 'post', '/match/start', c.admin).send({}).expect(409);
      await sleep(150);

      expect(stream.changes).toHaveLength(1);
    });

    it('C4: voto recusado (quem não jogou, pacote inválido) não avisa', async () => {
      const c = await setupAuditGroup(t, { status: 'VOTING' });
      const stream = await connect(c);

      await vote(c, c.bench).expect(403);
      await api(c, 'put', '/voting/vote', c.white[0]!)
        .send({ ratings: [], mvpId: 'x', flopId: 'y' })
        .expect(400);
      await api(c, 'post', '/voting/close', c.white[0]!).send({}).expect(403);
      await sleep(150);

      expect(stream.changes).toEqual([]);
    });
  });

  describe('C5: só a rodada ouvida avisa', () => {
    it('C5: escrita em outra rodada do grupo ou em outro grupo não chega na rodada A', async () => {
      const a = await setupAuditGroup(t, { status: 'IN_PROGRESS' });
      const roundB = await t.prisma.round.create({
        data: { groupId: a.group.id, scheduledAt: new Date(), status: 'IN_PROGRESS', number: 99 },
      });
      const other = await setupAuditGroup(t, { status: 'IN_PROGRESS' });
      const stream = await connect(a);

      await request(t.app.getHttpServer())
        .put(`/api/groups/${a.group.id}/rounds/${roundB.id}/match/score`)
        .set('Cookie', a.admin.cookie)
        .send({ WHITE: 1, BLACK: 1 })
        .expect(200);
      await api(other, 'put', '/match/score', other.admin).send({ WHITE: 3, BLACK: 3 }).expect(200);
      await sleep(150);
      expect(stream.changes).toEqual([]);

      await api(a, 'put', '/match/score', a.admin).send({ WHITE: 2, BLACK: 0 }).expect(200);
      await stream.waitFor(() => stream.changes.length === 1, 1000);
      expect(stream.changes).toHaveLength(1);
    });
  });

  describe('C6: o relógio fecha a votação', () => {
    it('C6: `closeDueVotings` fecha a rodada vencida e avisa `voting` e `status`', async () => {
      const c = await setupAuditGroup(t, { status: 'VOTING', votingOpenedAgoMs: 30 * 3_600_000 });
      const stream = await connect(c);

      const closed = await t.app.get(VotingService).closeDueVotings(new Date());
      await stream.waitFor(() => stream.changes.length >= 1, 1000);
      await sleep(100);

      expect(closed).toBe(1);
      expect(stream.changes).toEqual([{ scopes: ['voting', 'status'], at: expect.any(String) }]);
    });

    it('C6: rodada que não venceu não avisa', async () => {
      const c = await setupAuditGroup(t, { status: 'VOTING' });
      const stream = await connect(c);

      expect(await t.app.get(VotingService).closeDueVotings(new Date())).toBe(0);
      await sleep(150);

      expect(stream.changes).toEqual([]);
    });
  });

  describe('C7: pulso', () => {
    it('C7: parado, o canal manda `: ping` a cada intervalo do pulso', async () => {
      const c = await setupAuditGroup(t, { status: 'IN_PROGRESS' });
      const stream = await connect(c);

      await stream.waitFor(() => stream.pings >= 2, 2000);

      expect(stream.raw).toContain(': ping\n\n');
      expect(stream.changes).toEqual([]);
    });
  });

  describe('C8: ouvinte sai quando o cliente fecha', () => {
    it('C8: fechar a conexão devolve a contagem de ouvintes ao que era', async () => {
      const c = await setupAuditGroup(t, { status: 'IN_PROGRESS' });
      const events = t.app.get(RoundEventsService);
      const count = () => events.listenerCount(c.group.id, c.round.id);
      expect(count()).toBe(0);

      const stream = await connect(c);
      expect(count()).toBe(1);
      stream.close();

      await sleep(100);
      expect(count()).toBe(0);
    });

    it('C8: 30 conexões abertas e fechadas não deixam ouvinte sobrando', async () => {
      const c = await setupAuditGroup(t, { status: 'IN_PROGRESS' });
      const events = t.app.get(RoundEventsService);

      const streams = await Promise.all(Array.from({ length: 30 }, () => connect(c)));
      expect(events.listenerCount(c.group.id, c.round.id)).toBe(30);
      for (const stream of streams) stream.close();

      const limit = Date.now() + 2000;
      while (events.listenerCount(c.group.id, c.round.id) > 0 && Date.now() < limit)
        await sleep(20);
      expect(events.listenerCount(c.group.id, c.round.id)).toBe(0);
    });
  });

  describe('C9: quem não pode não abre o fluxo', () => {
    it('C9: sem sessão → 401', async () => {
      const c = await setupAuditGroup(t, { status: 'IN_PROGRESS' });

      const stream = await open(streamPath(c.group.id, c.round.id));

      expect(stream.status).toBe(401);
      expect(stream.headers['content-type']).not.toMatch(/event-stream/);
    });

    it('C9: usuário de outro grupo, membro inativo, rodada de outro grupo e rodada inexistente → 404', async () => {
      const c = await setupAuditGroup(t, { status: 'IN_PROGRESS' });
      const outsider = await setupOutsider(t);
      const events = t.app.get(RoundEventsService);

      const results = await Promise.all([
        open(streamPath(c.group.id, c.round.id), outsider.cookie),
        open(streamPath(c.group.id, c.round.id), c.inactive.cookie),
        open(streamPath(c.group.id, outsider.round.id), c.admin.cookie),
        open(streamPath(c.group.id, 'rodada-que-nao-existe'), c.admin.cookie),
      ]);

      for (const stream of results) {
        expect(stream.status).toBe(404);
        expect(stream.headers['content-type']).not.toMatch(/event-stream/);
        expect(stream.raw).not.toContain('event: ready');
      }
      expect(events.listenerCount(c.group.id, c.round.id)).toBe(0);
      expect(events.listenerCount(c.group.id, outsider.round.id)).toBe(0);
    });
  });

  describe('C9: só rodada em etapa com canal', () => {
    it('C9: rodada encerrada (CLOSED) → 404, sem abrir fluxo nem deixar ouvinte', async () => {
      const c = await setupAuditGroup(t, { status: 'CLOSED' });
      const events = t.app.get(RoundEventsService);

      const stream = await open(streamPath(c.group.id, c.round.id), c.admin.cookie);

      expect(stream.status).toBe(404);
      expect(stream.raw).not.toContain('event: ready');
      expect(events.listenerCount(c.group.id, c.round.id)).toBe(0);
    });

    it('C9: rodada agendada (SCHEDULED) abre: é por onde os times publicados chegam', async () => {
      const c = await setupAuditGroup(t, { status: 'SCHEDULED' });

      const stream = await connect(c, c.white[0]!);

      expect(stream.status).toBe(200);
      await api(c, 'post', '/lineup/publish', c.admin).send({}).expect(200);
      await stream.waitFor(() => stream.changes.length > 0);
      expect(stream.changes[0]!.scopes).toEqual(['status']);
    });
  });

  describe('C8: o cliente desiste enquanto a rodada é conferida', () => {
    it('C8: fechar durante a conferência não deixa ouvinte nem pulso ligados', async () => {
      const c = await setupAuditGroup(t, { status: 'IN_PROGRESS' });
      const events = t.app.get(RoundEventsService);
      const live = t.app.get(LiveService);
      const controller = t.app.get(LiveController);
      const openBefore = (controller as unknown as { open: Set<unknown> }).open.size;

      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      let entered!: () => void;
      const checking = new Promise<void>((resolve) => (entered = resolve));
      const original = live.requireRound.bind(live);
      const spy = jest.spyOn(live, 'requireRound').mockImplementation(async (...args) => {
        entered();
        await gate;
        return original(...args);
      });

      try {
        const req = http.get(`${baseUrl}${streamPath(c.group.id, c.round.id)}`, {
          headers: { Cookie: c.admin.cookie },
          agent: false,
        });
        req.on('error', () => undefined);
        await checking;
        // O cliente desiste no meio da conferência
        req.destroy();
        await sleep(50);
        release();
        await sleep(100);

        expect(events.listenerCount(c.group.id, c.round.id)).toBe(0);
        expect((controller as unknown as { open: Set<unknown> }).open.size).toBe(openBefore);
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('C10: 50 conexões na mesma rodada', () => {
    it('C10: as 50 recebem e a escrita responde no tempo normal', async () => {
      const c = await setupAuditGroup(t, { status: 'IN_PROGRESS' });
      const streams = await Promise.all(Array.from({ length: 50 }, () => connect(c)));

      const startedAt = Date.now();
      await api(c, 'put', '/match/score', c.admin).send({ WHITE: 1, BLACK: 0 }).expect(200);
      const elapsed = Date.now() - startedAt;
      await Promise.all(streams.map((s) => s.waitFor(() => s.changes.length === 1, 2000)));

      // O aviso não segura a resposta: a escrita não espera ninguém (folga larga para CI lento).
      expect(elapsed).toBeLessThan(1500);
      for (const s of streams)
        expect(s.changes).toEqual([{ scopes: ['match'], at: expect.any(String) }]);
    });
  });

  describe('C11: erro num ouvinte', () => {
    it('C11: ouvinte que lança e conexão quebrada no meio não impedem a escrita nem os outros', async () => {
      const c = await setupAuditGroup(t, { status: 'IN_PROGRESS' });
      const events = t.app.get(RoundEventsService);
      const healthy = await connect(c);
      const broken = await connect(c, c.white[0]!);
      const unsubscribe = events.subscribe(c.group.id, c.round.id, () => {
        throw new Error('ouvinte quebrado');
      });
      // Um corte seco, sem esperar o servidor perceber.
      broken.close();
      const healthyAfter = await connect(c, c.black[0]!);

      await api(c, 'put', '/match/score', c.admin).send({ WHITE: 1, BLACK: 0 }).expect(200);
      await Promise.all(
        [healthy, healthyAfter].map((s) => s.waitFor(() => s.changes.length === 1, 1000)),
      );

      unsubscribe();
      for (const s of [healthy, healthyAfter]) {
        expect(s.changes).toEqual([{ scopes: ['match'], at: expect.any(String) }]);
      }
    });
  });

  describe('C12: o voto não vaza no aviso', () => {
    it('C12: o aviso do voto é só `{ scopes: [voting], at }`, sem quem votou nem conteúdo', async () => {
      const c = await setupAuditGroup(t, { status: 'VOTING' });
      const voter = c.white[0]!;
      const stream = await connect(c, c.admin);

      await vote(c, voter).expect(200);
      await stream.waitFor(() => stream.changes.length === 1, 1000);

      const [event] = stream.changes;
      expect(Object.keys(event!).sort()).toEqual(['at', 'scopes']);
      expect(event!.scopes).toEqual(['voting']);
      const body = JSON.stringify(event);
      const { mvpId, flopId } = ballot(c, voter);
      for (const secret of [voter.membershipId, voter.userId, mvpId, flopId]) {
        expect(stream.raw).not.toContain(secret);
        expect(body).not.toContain(secret);
      }
    });
  });
});
