import { Logger } from '@nestjs/common';
import {
  roundLogEntrySchema,
  ROUND_LOG_ACTION_LABELS,
  type RoundLogEntry,
} from '@fut-stats/shared';
import request from 'supertest';
import { REQUEST_ID_HEADER } from '../common/request-context';
import type { MatchEventType } from '../generated/prisma/enums';
import { VotingService } from '../voting/voting.service';
import {
  setupAuditGroup,
  setupOutsider,
  type AuditGroup,
  type Person,
} from '../test/audit-fixture';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';

const HOUR_MS = 60 * 60 * 1000;

describe('registro da rodada', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
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
  const base = (c: AuditGroup) => `/api/groups/${c.group.id}/rounds/${c.round.id}`;

  const post = (
    c: AuditGroup,
    who: Person,
    rest: string,
    body: object = {},
    requestId?: string,
  ) => {
    const req = request(server())
      .post(`${base(c)}${rest}`)
      .set('Cookie', who.cookie);
    if (requestId) req.set(REQUEST_ID_HEADER, requestId);
    return req.send(body);
  };
  const putScore = (c: AuditGroup, who: Person, WHITE: number, BLACK: number) =>
    request(server())
      .put(`${base(c)}/match/score`)
      .set('Cookie', who.cookie)
      .send({ WHITE, BLACK });
  const launch = (c: AuditGroup, who: Person, target: Person, type: MatchEventType) =>
    post(c, who, '/match/events', { membershipId: target.membershipId, type });
  const removeEvent = (c: AuditGroup, who: Person, eventId: string) =>
    request(server())
      .delete(`${base(c)}/match/events/${eventId}`)
      .set('Cookie', who.cookie);
  const getLog = (c: AuditGroup, who: { cookie: string }) =>
    request(server())
      .get(`${base(c)}/log`)
      .set('Cookie', who.cookie);

  const logRows = (c: AuditGroup) =>
    t.prisma.auditLog.findMany({
      where: { roundId: c.round.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  const logCount = () => t.prisma.auditLog.count();

  const addEvent = (c: AuditGroup, target: Person, type: MatchEventType) =>
    t.prisma.matchEvent.create({
      data: {
        roundId: c.round.id,
        membershipId: target.membershipId,
        type,
        createdById: c.admin.membershipId,
      },
    });

  /** O pacote de quem vota: nota 6 para os outros, Craque e Perna de Pau que não sejam o votante. */
  function ballot(c: AuditGroup, voter: Person) {
    const everyone = [...c.white, ...c.black];
    const others = everyone.filter((p) => p !== voter);
    return {
      ratings: others.map((p) => ({ targetId: p.membershipId, value: 6 })),
      mvpId: others[0]!.membershipId,
      flopId: others[1]!.membershipId,
    };
  }
  const vote = (c: AuditGroup, voter: Person) =>
    request(server())
      .put(`${base(c)}/voting/vote`)
      .set('Cookie', voter.cookie)
      .send(ballot(c, voter));

  describe('gravação', () => {
    it('C2: publicar e despublicar os times gravam uma linha cada, com o admin, o status e o requestId', async () => {
      const c = await setupAuditGroup(t);

      await post(c, c.admin, '/lineup/publish', {}, 'req-publicar-c2').expect(200);
      await post(c, c.admin, '/lineup/unpublish', {}, 'req-despublicar-c2').expect(200);

      const rows = await logRows(c);
      expect(rows.map((r) => r.action)).toEqual(['TEAMS_PUBLISHED', 'TEAMS_UNPUBLISHED']);
      expect(rows[0]).toMatchObject({
        groupId: c.group.id,
        roundId: c.round.id,
        actorId: c.admin.membershipId,
        before: { status: 'SCHEDULED' },
        after: { status: 'TEAMS_PUBLISHED' },
        requestId: 'req-publicar-c2',
      });
      expect(rows[1]).toMatchObject({
        actorId: c.admin.membershipId,
        before: { status: 'TEAMS_PUBLISHED' },
        after: { status: 'SCHEDULED' },
        requestId: 'req-despublicar-c2',
      });
    });

    it('C3: começar, placar 1x0, 2x0 e 2x0 de novo, finalizar 3x2 e abrir a votação gravam 5 linhas na ordem', async () => {
      const c = await setupAuditGroup(t, { status: 'TEAMS_PUBLISHED' });

      await post(c, c.admin, '/match/start').expect(200);
      await putScore(c, c.admin, 1, 0).expect(200);
      await putScore(c, c.admin, 2, 0).expect(200);
      // O mesmo placar de novo não muda nada e não vira linha.
      await putScore(c, c.admin, 2, 0).expect(200);
      for (const p of [c.white[6]!, c.white[5]!, c.white[4]!]) await addEvent(c, p, 'GOAL');
      for (const p of [c.black[6]!, c.black[5]!]) await addEvent(c, p, 'GOAL');
      await post(c, c.admin, '/match/finish', { WHITE: 3, BLACK: 2 }).expect(200);
      await post(c, c.admin, '/match/open-voting').expect(200);

      const rows = await logRows(c);
      expect(rows.map((r) => r.action)).toEqual([
        'MATCH_STARTED',
        'SCORE_SET',
        'SCORE_SET',
        'MATCH_FINISHED',
        'VOTING_OPENED',
      ]);
      expect(rows.every((r) => r.actorId === c.admin.membershipId)).toBe(true);
      expect(rows[0]).toMatchObject({
        before: { status: 'TEAMS_PUBLISHED' },
        after: { status: 'IN_PROGRESS' },
      });
      expect(rows[1]).toMatchObject({
        before: { score: null },
        after: { score: { WHITE: 1, BLACK: 0 } },
      });
      expect(rows[2]).toMatchObject({
        before: { score: { WHITE: 1, BLACK: 0 } },
        after: { score: { WHITE: 2, BLACK: 0 } },
      });
      expect(rows[3]).toMatchObject({
        before: { status: 'IN_PROGRESS', score: { WHITE: 2, BLACK: 0 } },
        after: { status: 'POST_MATCH', score: { WHITE: 3, BLACK: 2 } },
      });
      expect(rows[4]).toMatchObject({
        before: { status: 'POST_MATCH' },
        after: { status: 'VOTING' },
      });
    });

    it('C4: o jogador lança o próprio gol e apaga; o admin lança um gol contra de outro', async () => {
      const c = await setupAuditGroup(t, { status: 'POST_MATCH', score: { WHITE: 2, BLACK: 0 } });
      const scorer = c.white[6]!;
      const defender = c.black[1]!;

      await launch(c, scorer, scorer, 'GOAL').expect(200);
      const [launched] = await t.prisma.matchEvent.findMany({ where: { roundId: c.round.id } });
      await removeEvent(c, scorer, launched!.id).expect(200);
      await launch(c, c.admin, defender, 'OWN_GOAL').expect(200);
      const [ownGoal] = await t.prisma.matchEvent.findMany({ where: { roundId: c.round.id } });

      const rows = await logRows(c);
      expect(rows.map((r) => r.action)).toEqual([
        'EVENT_LAUNCHED',
        'EVENT_REMOVED',
        'EVENT_LAUNCHED',
      ]);
      expect(rows[0]).toMatchObject({
        actorId: scorer.membershipId,
        before: null,
        after: { eventId: launched!.id, type: 'GOAL', playerId: scorer.membershipId },
      });
      expect(rows[1]).toMatchObject({
        actorId: scorer.membershipId,
        before: {
          eventId: launched!.id,
          type: 'GOAL',
          playerId: scorer.membershipId,
          createdById: scorer.membershipId,
        },
        after: null,
      });
      expect(rows[2]).toMatchObject({
        actorId: c.admin.membershipId,
        before: null,
        after: { eventId: ownGoal!.id, type: 'OWN_GOAL', playerId: defender.membershipId },
      });
    });

    it('C5: pedido recusado (409, 403, 409, 404) não deixa linha', async () => {
      const c = await setupAuditGroup(t, { status: 'POST_MATCH', score: { WHITE: 0, BLACK: 0 } });
      const outsider = await setupOutsider(t);
      const rowsBefore = await logCount();

      // Gol passando do placar: 409.
      await launch(c, c.white[6]!, c.white[6]!, 'GOAL').expect(409);
      // Lance de outro jogador, sem ser admin: 403.
      await launch(c, c.white[6]!, c.white[5]!, 'GOAL').expect(403);
      // Começar fora de ordem (a rodada já passou do jogo): 409.
      await post(c, c.admin, '/match/start').expect(409);
      // Jogador comum tentando mudar o placar: 403.
      await putScore(c, c.white[6]!, 1, 0).expect(403);
      // Rodada de outro grupo (admin de lá, na rota do grupo dele): 404.
      await request(server())
        .post(`/api/groups/${outsider.group.id}/rounds/${c.round.id}/match/start`)
        .set('Cookie', outsider.cookie)
        .send({})
        .expect(404);
      // Despublicar o que não está publicado: 409.
      await post(c, c.admin, '/lineup/unpublish').expect(409);

      expect(await logCount()).toBe(rowsBefore);
      expect(await t.prisma.matchEvent.count()).toBe(0);
    });

    it('C6: dois gols ao mesmo tempo no limite do placar: um 200, um 409 e uma linha de lance', async () => {
      const c = await setupAuditGroup(t, { status: 'POST_MATCH', score: { WHITE: 1, BLACK: 0 } });
      const [first, second] = [c.white[5]!, c.white[6]!];

      for (let run = 0; run < 10; run++) {
        await t.prisma.matchEvent.deleteMany({ where: { roundId: c.round.id } });
        await t.prisma.auditLog.deleteMany();

        const [a, b] = await Promise.all([
          launch(c, first, first, 'GOAL'),
          launch(c, second, second, 'GOAL'),
        ]);

        expect([a.status, b.status].sort()).toEqual([200, 409]);
        const rows = await logRows(c);
        expect(rows.filter((r) => r.action === 'EVENT_LAUNCHED')).toHaveLength(1);
        expect(rows).toHaveLength(1);
        expect(await t.prisma.matchEvent.count({ where: { roundId: c.round.id } })).toBe(1);
      }
    });

    it('C7: o admin encerra a votação: VOTING_CLOSED com ADMIN_CLOSED, votos, total e o ator', async () => {
      const c = await setupAuditGroup(t, { status: 'VOTING', score: { WHITE: 0, BLACK: 0 } });
      await vote(c, c.white[0]!).expect(200);
      await vote(c, c.black[0]!).expect(200);
      await vote(c, c.black[1]!).expect(200);

      await post(c, c.admin, '/voting/close', {}, 'req-fechar-c7').expect(200);

      const rows = await logRows(c);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        action: 'VOTING_CLOSED',
        actorId: c.admin.membershipId,
        before: { status: 'VOTING' },
        after: { status: 'CLOSED', reason: 'ADMIN_CLOSED', voted: 3, total: 14 },
        requestId: 'req-fechar-c7',
      });
    });

    it('C7: o admin pede para fechar quando o prazo já venceu: o motivo é o prazo, o ator segue sendo o admin', async () => {
      const c = await setupAuditGroup(t, { status: 'VOTING', votingOpenedAgoMs: 30 * HOUR_MS });

      await post(c, c.admin, '/voting/close').expect(200);

      const [row] = await logRows(c);
      expect(row).toMatchObject({
        action: 'VOTING_CLOSED',
        actorId: c.admin.membershipId,
        after: { status: 'CLOSED', reason: 'DEADLINE_PASSED', voted: 0, total: 14 },
      });
    });

    it('C8: o último voto fecha a votação (ALL_VOTED, sem ator, sem requestId) e nenhum voto vira linha', async () => {
      const c = await setupAuditGroup(t, { status: 'VOTING', score: { WHITE: 0, BLACK: 0 } });
      const everyone = [...c.white, ...c.black];

      for (const voter of everyone.slice(0, -1)) await vote(c, voter).expect(200);
      expect(await logRows(c)).toEqual([]);
      await vote(c, everyone.at(-1)!).set(REQUEST_ID_HEADER, 'req-ultimo-voto-c8').expect(200);

      const rows = await logRows(c);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        action: 'VOTING_CLOSED',
        actorId: null,
        before: { status: 'VOTING' },
        after: { status: 'CLOSED', reason: 'ALL_VOTED', voted: 14, total: 14 },
        // O requestId do último voto, cruzado com o log de pedido, diria quem votou por último.
        requestId: null,
      });
      // Anônimo: nem o conteúdo do voto, nem quem votou por último.
      const raw = JSON.stringify(rows);
      for (const word of [
        'mvp',
        'flop',
        'rating',
        'value',
        'voter',
        everyone.at(-1)!.membershipId,
      ]) {
        expect(raw.toLowerCase()).not.toContain(word.toLowerCase());
      }
    });

    it('C8: o relógio fecha a votação vencida (DEADLINE_PASSED, sem ator e sem requestId)', async () => {
      const c = await setupAuditGroup(t, { status: 'VOTING', votingOpenedAgoMs: 25 * HOUR_MS });

      expect(await t.app.get(VotingService).closeDueVotings(new Date())).toBe(1);

      const rows = await logRows(c);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        action: 'VOTING_CLOSED',
        actorId: null,
        after: { status: 'CLOSED', reason: 'DEADLINE_PASSED', voted: 0, total: 14 },
        requestId: null,
      });
    });

    it('C8: quem abre a votação depois do prazo fecha ali (sem ator e sem o requestId da leitura)', async () => {
      const c = await setupAuditGroup(t, { status: 'VOTING', votingOpenedAgoMs: 25 * HOUR_MS });

      await request(server())
        .get(`${base(c)}/voting`)
        .set('Cookie', c.white[0]!.cookie)
        .set(REQUEST_ID_HEADER, 'req-leitura-c8')
        .expect(200);

      const rows = await logRows(c);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        action: 'VOTING_CLOSED',
        actorId: null,
        after: { reason: 'DEADLINE_PASSED' },
        requestId: null,
      });
    });

    it('C8: listar as rodadas depois do prazo fecha a votação ali, sem ator e sem o requestId da lista', async () => {
      const c = await setupAuditGroup(t, { status: 'VOTING', votingOpenedAgoMs: 25 * HOUR_MS });

      await request(server())
        .get(`/api/groups/${c.group.id}/rounds`)
        .set('Cookie', c.white[0]!.cookie)
        .set(REQUEST_ID_HEADER, 'req-lista-c8')
        .expect(200);

      const rows = await logRows(c);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        action: 'VOTING_CLOSED',
        actorId: null,
        after: { reason: 'DEADLINE_PASSED' },
        requestId: null,
      });
    });

    it('C8: o voto que chega depois do prazo é recusado e a votação fecha ali, sem ator', async () => {
      const c = await setupAuditGroup(t, { status: 'VOTING', votingOpenedAgoMs: 25 * HOUR_MS });

      await vote(c, c.white[0]!).set(REQUEST_ID_HEADER, 'req-voto-atrasado-c8').expect(409);

      const rows = await logRows(c);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        action: 'VOTING_CLOSED',
        actorId: null,
        after: { reason: 'DEADLINE_PASSED', voted: 0, total: 14 },
        requestId: null,
      });
    });

    it('C9: se gravar o registro falha, nem o lance, nem a mudança de etapa ficam gravados', async () => {
      const c = await setupAuditGroup(t, { status: 'POST_MATCH', score: { WHITE: 2, BLACK: 0 } });
      const player = c.white[6]!;
      // Um lance já existente, para provar que apagar também volta atrás.
      const existing = await addEvent(c, c.white[5]!, 'GOAL');
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await t.prisma.$executeRawUnsafe(
        `CREATE FUNCTION fail_audit_log() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'falha forçada no registro'; END; $$ LANGUAGE plpgsql`,
      );
      await t.prisma.$executeRawUnsafe(
        `CREATE TRIGGER fail_audit_log BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION fail_audit_log()`,
      );
      try {
        await launch(c, player, player, 'GOAL').expect(500);
        await removeEvent(c, c.admin, existing.id).expect(500);
        // Com o placar batendo com os gols, abrir a votação seria válido: o registro é que falha.
        await t.prisma.matchEvent.deleteMany({ where: { id: { not: existing.id } } });
        await t.prisma.round.update({
          where: { id: c.round.id },
          data: { whiteGoals: 1, blackGoals: 0 },
        });
        await post(c, c.admin, '/match/open-voting').expect(500);
      } finally {
        await t.prisma.$executeRawUnsafe(`DROP TRIGGER fail_audit_log ON "AuditLog"`);
        await t.prisma.$executeRawUnsafe(`DROP FUNCTION fail_audit_log()`);
      }

      expect(await t.prisma.matchEvent.findMany({ where: { roundId: c.round.id } })).toEqual([
        expect.objectContaining({ id: existing.id }),
      ]);
      expect((await t.prisma.round.findUniqueOrThrow({ where: { id: c.round.id } })).status).toBe(
        'POST_MATCH',
      );
      expect(await logCount()).toBe(0);
    });
  });

  describe('GET /log', () => {
    it('C10: o admin lê as linhas em ordem, com ação, rótulo, ator, antes, depois e hora', async () => {
      const c = await setupAuditGroup(t, { status: 'POST_MATCH', score: { WHITE: 0, BLACK: 0 } });
      await putScore(c, c.admin, 1, 0).expect(200);
      await launch(c, c.white[6]!, c.white[6]!, 'GOAL').expect(200);
      await post(c, c.admin, '/match/open-voting').expect(200);
      await vote(c, c.white[0]!).expect(200);

      const response = await getLog(c, c.admin).expect(200);
      const entries = response.body as RoundLogEntry[];

      expect(entries.map((e) => e.action)).toEqual([
        'SCORE_SET',
        'EVENT_LAUNCHED',
        'VOTING_OPENED',
      ]);
      for (const entry of entries) {
        expect(roundLogEntrySchema.safeParse(entry).success).toBe(true);
        expect(entry.label).toBe(ROUND_LOG_ACTION_LABELS[entry.action]);
      }
      expect(entries[0]).toMatchObject({
        label: 'Placar lançado',
        actor: { membershipId: c.admin.membershipId, nickname: 'Chefe' },
        before: { score: { WHITE: 0, BLACK: 0 } },
        after: { score: { WHITE: 1, BLACK: 0 } },
      });
      expect(entries[1]).toMatchObject({
        actor: { membershipId: c.white[6]!.membershipId, nickname: 'B6' },
        before: null,
        after: { type: 'GOAL', playerId: c.white[6]!.membershipId },
      });
      const times = entries.map((e) => new Date(e.createdAt).getTime());
      expect([...times].sort((a, b) => a - b)).toEqual(times);
    });

    it('C10: no fechamento automático o ator vem nulo', async () => {
      const c = await setupAuditGroup(t, { status: 'VOTING', votingOpenedAgoMs: 25 * HOUR_MS });
      await t.app.get(VotingService).closeDueVotings(new Date());

      const entries = (await getLog(c, c.admin).expect(200)).body as RoundLogEntry[];

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        action: 'VOTING_CLOSED',
        actor: null,
        label: 'Votação fechada',
      });
    });

    it('C10: rodada sem registro responde lista vazia', async () => {
      const c = await setupAuditGroup(t);
      expect((await getLog(c, c.admin).expect(200)).body).toEqual([]);
    });

    it('C11: jogador comum leva 403', async () => {
      const c = await setupAuditGroup(t);
      await getLog(c, c.white[0]!).expect(403);
      await getLog(c, c.bench).expect(403);
    });

    it('C12: rodada de outro grupo, não membro e membro inativo levam 404', async () => {
      const c = await setupAuditGroup(t);
      const outsider = await setupOutsider(t);
      await post(c, c.admin, '/lineup/publish').expect(200);

      // Admin de outro grupo, na rota do grupo dele, com a rodada do grupo A.
      await request(server())
        .get(`/api/groups/${outsider.group.id}/rounds/${c.round.id}/log`)
        .set('Cookie', outsider.cookie)
        .expect(404);
      // Admin de outro grupo, na rota do grupo A: não é membro.
      await getLog(c, outsider).expect(404);
      // Membro inativo.
      await getLog(c, c.inactive).expect(404);
      // Rodada que não existe.
      await request(server())
        .get(`/api/groups/${c.group.id}/rounds/rodada-que-nao-existe/log`)
        .set('Cookie', c.admin.cookie)
        .expect(404);
      // Sem sessão.
      await request(server())
        .get(`${base(c)}/log`)
        .expect(401);
    });

    it('C13: apagar a rodada apaga o registro dela junto, e só dela', async () => {
      const c = await setupAuditGroup(t);
      const other = await t.prisma.round.create({
        data: { groupId: c.group.id, scheduledAt: new Date(), status: 'SCHEDULED' },
      });
      await t.prisma.auditLog.create({
        data: {
          groupId: c.group.id,
          roundId: other.id,
          actorId: c.admin.membershipId,
          action: 'TEAMS_PUBLISHED',
        },
      });
      await post(c, c.admin, '/lineup/publish').expect(200);
      await post(c, c.admin, '/lineup/unpublish').expect(200);
      expect(await logRows(c)).toHaveLength(2);

      await request(server()).delete(base(c)).set('Cookie', c.admin.cookie).expect(204);

      expect(await logRows(c)).toEqual([]);
      expect(await logCount()).toBe(1);
    });
  });

  describe('requestId nos pedidos simultâneos', () => {
    it('C20: cada linha de log e cada linha do registro leva o requestId do próprio pedido', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const groups = await Promise.all(Array.from({ length: 4 }, () => setupAuditGroup(t)));

      await Promise.all(
        groups.map((c, i) =>
          post(c, c.admin, '/lineup/publish', {}, `req-simultaneo-${i}-c20`).expect(200),
        ),
      );

      for (const [i, c] of groups.entries()) {
        const [row] = await logRows(c);
        expect(row).toMatchObject({
          action: 'TEAMS_PUBLISHED',
          requestId: `req-simultaneo-${i}-c20`,
        });

        const lines = logSpy.mock.calls
          .map(([message]) => message as Record<string, unknown>)
          .filter((line) => line.requestId === `req-simultaneo-${i}-c20`);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatchObject({
          path: `${base(c)}/lineup/publish`,
          groupId: c.group.id,
          userId: c.admin.userId,
          status: 200,
        });
      }
    });
  });
});
