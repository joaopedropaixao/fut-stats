import { Logger } from '@nestjs/common';
import request from 'supertest';
import type { Position, RoundStatus, Team } from '../generated/prisma/enums';
import { addMember, createGroup, createUser, loginAs } from '../test/auth';
import { disableVapid, enableVapid, FakePushSender } from '../test/fake-push-sender';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';
import { VotingService } from '../voting/voting.service';
import { NotificationsService } from './notifications.service';
import { PushSender } from './push-sender';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const FORMATION: Position[] = [
  'GOALKEEPER',
  'DEFENDER',
  'DEFENDER',
  'WINGER',
  'WINGER',
  'MIDFIELDER',
  'FORWARD',
];

/** Os avisos saindo das ações reais (criar rodada, publicar, abrir e encerrar a votação), com um gravador no lugar do serviço de push. */
describe('push: avisos disparados pelas ações da rodada', () => {
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await t.app.close();
    disableVapid();
  });

  const server = () => t.app.getHttpServer();
  /** Espera o envio sem await da resposta terminar. */
  const settle = () => t.app.get(NotificationsService).whenIdle();

  let seq = 0;
  interface Person {
    userId: string;
    membershipId: string;
    cookie: string;
    endpoints: string[];
  }

  async function person(
    groupId: string,
    data: { admin?: boolean; active?: boolean; devices?: number } = {},
  ): Promise<Person> {
    const user = await createUser(t);
    const member = await addMember(t, user.id, groupId, {
      role: data.admin ? 'ADMIN' : 'PLAYER',
      active: data.active ?? true,
    });
    const endpoints: string[] = [];
    for (let i = 0; i < (data.devices ?? 1); i += 1) {
      seq += 1;
      const endpoint = `https://push.example.com/send/${seq}`;
      endpoints.push(endpoint);
      await t.prisma.pushSubscription.create({
        data: { userId: user.id, endpoint, p256dh: 'p', auth: 'a' },
      });
    }
    return { userId: user.id, membershipId: member.id, cookie: loginAs(t, user.id), endpoints };
  }

  const sentTo = () => sender.sent.map((s) => s.endpoint).sort();
  const devicesOf = (...people: Person[]) => people.flatMap((p) => p.endpoints).sort();
  const base = (groupId: string, roundId: string) => `/api/groups/${groupId}/rounds/${roundId}`;

  describe('criar a rodada', () => {
    async function world() {
      const group = await createGroup(t, { name: 'Pelada do Sábado' });
      const admin = await person(group.id, { admin: true });
      const a = await person(group.id);
      const b = await person(group.id, { devices: 2 });
      const c = await person(group.id);
      const inactive = await person(group.id, { active: false });
      return { group, admin, a, b, c, inactive };
    }

    it('C14: o admin cria a rodada e os aparelhos dos 3 ativos recebem (4 envios), sem o inativo nem o admin', async () => {
      const { group, admin, a, b, c } = await world();

      const res = await request(server())
        .post(`/api/groups/${group.id}/rounds`)
        .set('Cookie', admin.cookie)
        .send({ scheduledAt: '2026-10-24T12:00:00.000Z', location: 'Quadra' })
        .expect(201);
      await settle();

      expect(sender.sent).toHaveLength(4);
      expect(sentTo()).toEqual(devicesOf(a, b, c));
      expect(sender.sent[0]!.payload).toEqual({
        type: 'ROUND_CREATED',
        title: 'Pelada do Sábado',
        body: `Rodada ${res.body.number} marcada: sáb, 24 out, 9h. Confirme sua presença.`,
        url: `/rodadas/${res.body.id}?grupo=${group.id}`,
        tag: `ROUND_CREATED:${res.body.id}`,
      });
      expect(await t.prisma.auditLog.count({ where: { roundId: res.body.id } })).toBe(0);
    });

    it('C14: criar rodada recusado (corpo inválido ou não admin) não envia nada', async () => {
      const { group, admin, a } = await world();
      await request(server())
        .post(`/api/groups/${group.id}/rounds`)
        .set('Cookie', admin.cookie)
        .send({ scheduledAt: 'ontem' })
        .expect(400);
      await request(server())
        .post(`/api/groups/${group.id}/rounds`)
        .set('Cookie', a.cookie)
        .send({ scheduledAt: '2026-10-24T12:00:00.000Z' })
        .expect(403);
      await settle();
      expect(sender.sent).toHaveLength(0);
    });
  });

  describe('publicar os times', () => {
    /** 16 confirmados, rascunho completo (7 + 7 titulares, 1 reserva por time) e 4 ativos de fora. */
    async function lineupWorld(withTeams = true) {
      const group = await createGroup(t, { name: 'Pelada do Sábado' });
      const admin = await person(group.id, { admin: true });
      const players = [admin];
      for (let i = 0; i < 15; i += 1) players.push(await person(group.id));
      const outside = [await person(group.id), await person(group.id)];
      const round = await t.prisma.round.create({
        data: { groupId: group.id, scheduledAt: new Date(Date.now() + DAY_MS) },
      });
      await t.prisma.attendance.createMany({
        data: players.map((p) => ({
          roundId: round.id,
          membershipId: p.membershipId,
          confirmed: true,
        })),
      });
      if (withTeams) {
        const rows = players.map((p, i) => {
          const team: Team = i < 8 ? 'WHITE' : 'BLACK';
          const slot = i % 8;
          return {
            roundId: round.id,
            membershipId: p.membershipId,
            team,
            position: FORMATION[slot] ?? 'MIDFIELDER',
            isReserve: slot === 7,
          };
        });
        await t.prisma.teamPlayer.createMany({ data: rows });
      }
      return { group, admin, players, outside, round };
    }

    const publish = (w: { group: { id: string }; round: { id: string } }, who: Person) =>
      request(server())
        .post(`${base(w.group.id, w.round.id)}/lineup/publish`)
        .set('Cookie', who.cookie);
    const unpublish = (w: { group: { id: string }; round: { id: string } }, who: Person) =>
      request(server())
        .post(`${base(w.group.id, w.round.id)}/lineup/unpublish`)
        .set('Cookie', who.cookie);

    it('C15: publicar avisa os 15 escalados (menos o admin) e ninguém de fora, com a url da aba Times', async () => {
      const w = await lineupWorld();

      await publish(w, w.admin).expect(200);
      await settle();

      expect(sender.sent).toHaveLength(15);
      expect(sentTo()).toEqual(devicesOf(...w.players.slice(1)));
      expect(sender.sent[0]!.payload).toEqual({
        type: 'TEAMS_PUBLISHED',
        title: 'Pelada do Sábado',
        body: `Os times da rodada ${(await t.prisma.round.findUniqueOrThrow({ where: { id: w.round.id } })).number} saíram. Veja em que time você joga.`,
        url: `/times?grupo=${w.group.id}`,
        tag: `TEAMS_PUBLISHED:${w.round.id}`,
      });
    });

    it('C15: despublicar não avisa; publicar de novo avisa de novo com a mesma tag', async () => {
      const w = await lineupWorld();
      await publish(w, w.admin).expect(200);
      await settle();
      sender.reset();

      await unpublish(w, w.admin).expect(200);
      await settle();
      expect(sender.sent).toHaveLength(0);

      await publish(w, w.admin).expect(200);
      await settle();
      expect(sender.sent).toHaveLength(15);
      expect(new Set(sender.sent.map((s) => s.payload.tag))).toEqual(
        new Set([`TEAMS_PUBLISHED:${w.round.id}`]),
      );
    });

    it('C19: publicar com times inválidos dá 409 e nenhum envio', async () => {
      const w = await lineupWorld(false);
      await publish(w, w.admin).expect(409);
      await settle();
      expect(sender.sent).toHaveLength(0);
    });

    it('C19: quem não é admin não publica (403) e ninguém recebe', async () => {
      const w = await lineupWorld();
      await publish(w, w.players[1]!).expect(403);
      await settle();
      expect(sender.sent).toHaveLength(0);
    });

    it('C17: o serviço de push diz 410 para uma assinatura: a linha some, as outras recebem e a rota responde 200', async () => {
      const w = await lineupWorld();
      const gone = w.players[3]!;
      sender.answers.set(gone.endpoints[0]!, 'gone');

      await publish(w, w.admin).expect(200);
      await settle();

      expect(sender.sent).toHaveLength(14);
      expect(await t.prisma.pushSubscription.count({ where: { userId: gone.userId } })).toBe(0);
      expect(await t.prisma.pushSubscription.count()).toBe(17);
    });

    it('C18: erro de rede no envio: a rota responde 200, o erro vai para o log com o requestId e a assinatura fica', async () => {
      const w = await lineupWorld();
      const broken = w.players[3]!;
      sender.answers.set(broken.endpoints[0]!, 'error');
      const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await publish(w, w.admin).set('x-request-id', 'req-push-18-abc').expect(200);
      await settle();

      expect(logged).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'push-failed',
          requestId: 'req-push-18-abc',
          type: 'TEAMS_PUBLISHED',
        }),
      );
      expect(sender.sent).toHaveLength(14);
      expect(await t.prisma.pushSubscription.count({ where: { userId: broken.userId } })).toBe(1);
      expect((await t.prisma.round.findUniqueOrThrow({ where: { id: w.round.id } })).status).toBe(
        'TEAMS_PUBLISHED',
      );
    });
  });

  describe('votação', () => {
    const ROSTER = [
      { key: 'w1', team: 'WHITE', position: 'GOALKEEPER', admin: true },
      { key: 'w2', team: 'WHITE', position: 'DEFENDER', admin: false },
      { key: 'b1', team: 'BLACK', position: 'GOALKEEPER', admin: false },
      { key: 'b2', team: 'BLACK', position: 'DEFENDER', admin: false },
    ] as const;
    type Key = (typeof ROSTER)[number]['key'];

    async function votingWorld(status: RoundStatus, openedAgoMs = HOUR_MS) {
      const group = await createGroup(t, { name: 'Pelada do Sábado' });
      const people = {} as Record<Key, Person>;
      for (const p of ROSTER) people[p.key] = await person(group.id, { admin: p.admin });
      const bench = await person(group.id);
      const inactive = await person(group.id, { active: false });
      const round = await t.prisma.round.create({
        data: {
          groupId: group.id,
          scheduledAt: new Date(Date.now() - 2 * DAY_MS),
          status,
          whiteGoals: 0,
          blackGoals: 0,
          votingOpenedAt: status === 'VOTING' ? new Date(Date.now() - openedAgoMs) : null,
          teamPlayers: {
            create: ROSTER.map((p) => ({
              membershipId: people[p.key].membershipId,
              team: p.team,
              position: p.position,
            })),
          },
        },
      });
      const everyone = [...Object.values(people), bench];
      return { group, round, people, bench, inactive, everyone };
    }
    type World = Awaited<ReturnType<typeof votingWorld>>;

    async function vote(w: World, voter: Key) {
      const others = ROSTER.filter((p) => p.key !== voter).map((p) => w.people[p.key].membershipId);
      await request(server())
        .put(`${base(w.group.id, w.round.id)}/voting/vote`)
        .set('Cookie', w.people[voter].cookie)
        .send({
          ratings: others.map((targetId) => ({ targetId, value: 6 })),
          mvpId: others[0],
          flopId: others[1],
        })
        .expect(200);
    }

    const resultOutCount = () => sender.sent.filter((s) => s.payload.type === 'RESULT_OUT').length;

    it('C15: abrir a votação avisa quem jogou (menos o admin), com o prazo real e a url de votar', async () => {
      const w = await votingWorld('POST_MATCH');

      await request(server())
        .post(`${base(w.group.id, w.round.id)}/match/open-voting`)
        .set('Cookie', w.people.w1.cookie)
        .expect(200);
      await settle();

      expect(sentTo()).toEqual(devicesOf(w.people.w2, w.people.b1, w.people.b2));
      const { payload } = sender.sent[0]!;
      expect(payload).toMatchObject({
        type: 'VOTING_OPENED',
        title: 'Pelada do Sábado',
        url: `/rodadas/${w.round.id}/votar?grupo=${w.group.id}`,
        tag: `VOTING_OPENED:${w.round.id}`,
      });
      expect(payload.body).toMatch(
        /^Votação aberta\. Dê suas notas até (dom|seg|ter|qua|qui|sex|sáb) às \d{1,2}h(\d\d)?\.$/,
      );
    });

    it('C15: o admin encerra a votação e todos os ativos menos ele recebem o resultado, sem revelar o Craque', async () => {
      const w = await votingWorld('VOTING');
      await vote(w, 'w2');

      await request(server())
        .post(`${base(w.group.id, w.round.id)}/voting/close`)
        .set('Cookie', w.people.w1.cookie)
        .send({})
        .expect(200);
      await settle();

      expect(sentTo()).toEqual(devicesOf(w.people.w2, w.people.b1, w.people.b2, w.bench));
      expect(sender.sent[0]!.payload).toMatchObject({
        type: 'RESULT_OUT',
        url: `/rodadas/${w.round.id}/resultado?grupo=${w.group.id}`,
        tag: `RESULT_OUT:${w.round.id}`,
      });
      expect(sender.sent[0]!.payload.body).toMatch(
        /^O resultado da rodada \d+ saiu\. Quem foi o craque\?$/,
      );
    });

    it('C16: o último voto fecha a votação e o resultado sai uma vez só, para todos os ativos', async () => {
      const w = await votingWorld('VOTING');

      await vote(w, 'w1');
      await vote(w, 'w2');
      await vote(w, 'b1');
      await settle();
      expect(resultOutCount()).toBe(0);

      await vote(w, 'b2');
      await settle();

      expect((await t.prisma.round.findUniqueOrThrow({ where: { id: w.round.id } })).status).toBe(
        'CLOSED',
      );
      expect(resultOutCount()).toBe(sender.sent.length);
      expect(sentTo()).toEqual(devicesOf(...w.everyone));
      expect(sender.sent).toHaveLength(w.everyone.length);
    });

    it('C16: o relógio fecha a votação vencida e o resultado sai uma vez só; rodar de novo não repete', async () => {
      const w = await votingWorld('VOTING', 25 * HOUR_MS);
      const voting = t.app.get(VotingService);

      expect(await voting.closeDueVotings(new Date())).toBe(1);
      await settle();
      expect(sentTo()).toEqual(devicesOf(...w.everyone));
      expect(sender.sent).toHaveLength(w.everyone.length);

      expect(await voting.closeDueVotings(new Date())).toBe(0);
      await settle();
      expect(sender.sent).toHaveLength(w.everyone.length);
    });

    it('C16: voto depois do prazo fecha a rodada (409) e avisa o resultado uma vez', async () => {
      const w = await votingWorld('VOTING', 25 * HOUR_MS);
      const others = ['w1', 'b1', 'b2'].map((k) => w.people[k as Key].membershipId);
      await request(server())
        .put(`${base(w.group.id, w.round.id)}/voting/vote`)
        .set('Cookie', w.people.w2.cookie)
        .send({
          ratings: others.map((targetId) => ({ targetId, value: 6 })),
          mvpId: others[0],
          flopId: others[1],
        })
        .expect(409);
      await settle();
      expect(resultOutCount()).toBe(w.everyone.length);
    });

    it('C19: encerrar fora da hora (a votação nem abriu) dá 409 e nenhum envio', async () => {
      const w = await votingWorld('POST_MATCH');
      await request(server())
        .post(`${base(w.group.id, w.round.id)}/voting/close`)
        .set('Cookie', w.people.w1.cookie)
        .send({})
        .expect(409);
      await settle();
      expect(sender.sent).toHaveLength(0);
    });
  });
});
