import {
  AVATAR_HAIR_COLORS,
  AVATAR_HAIRS,
  AVATAR_SKINS,
  isPlayerAvatar,
  POST_BODY_MAX_LENGTH,
  roundResults,
  tallyMatchEvents,
  validateCommentText,
  validatePostInput,
  validateRoundTeams,
  votingDeadline,
  type Position,
  type RoundTeams,
  type Team,
} from '@fut-stats/domain';
import { createGroup } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';
import { SEED_GROUP } from './seed-data';
import { parseSeedScenario, seed, SEED_SCENARIOS, type SeedScenario } from './seed';

const NOW = new Date('2026-10-24T15:10:00Z');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * Cada teste roda o seed inteiro (às vezes mais de uma vez), o que no CI leva vários segundos. Com o
 * timeout padrão de 5 s o teste estourava e o seed seguia rodando por trás; o TRUNCATE do próximo
 * `beforeEach` então caía em deadlock com ele. Por isso todo teste que chama o seed ganha folga.
 */
const SEED_TIMEOUT_MS = 30_000;

describe('seed de desenvolvimento', () => {
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

  /** As rodadas do grupo do seed com tudo o que elas têm, por apelido (ids mudam entre bancos). */
  async function loadRounds() {
    const rounds = await t.prisma.round.findMany({
      where: { group: { slug: SEED_GROUP.slug } },
      orderBy: { number: 'asc' },
      include: {
        attendances: { include: { membership: true } },
        teamPlayers: { include: { membership: true }, orderBy: { id: 'asc' } },
        matchEvents: {
          include: { membership: true, createdBy: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return rounds;
  }

  type LoadedRound = Awaited<ReturnType<typeof loadRounds>>[number];

  function teamsOf(round: LoadedRound): RoundTeams {
    const lineup = (team: Team) =>
      round.teamPlayers
        .filter((p) => p.team === team && !p.isReserve)
        .map((p) => ({ playerId: p.membershipId, position: p.position as Position }));
    const reserves = (team: Team) =>
      round.teamPlayers.filter((p) => p.team === team && p.isReserve).map((p) => p.membershipId);
    return {
      WHITE: lineup('WHITE'),
      BLACK: lineup('BLACK'),
      reserves: { WHITE: reserves('WHITE'), BLACK: reserves('BLACK') },
    };
  }

  /** Retrato estável das rodadas, para comparar duas execuções. */
  function snapshot(rounds: LoadedRound[]) {
    const byNick = <T extends { membership: { nickname: string } }>(
      rows: T[],
      f: (r: T) => string,
    ) => rows.map((r) => `${r.membership.nickname}:${f(r)}`).sort();
    return rounds.map((r) => ({
      number: r.number,
      scheduledAt: r.scheduledAt.toISOString(),
      status: r.status,
      score: [r.whiteGoals, r.blackGoals],
      attendances: byNick(r.attendances, (a) => String(a.confirmed)),
      teamPlayers: byNick(r.teamPlayers, (p) => `${p.team}/${p.position}/${p.isReserve}`),
      events: r.matchEvents.map(
        (e) => `${e.membership.nickname}:${e.type}:${e.createdBy.nickname}`,
      ),
    }));
  }

  it.each<[SeedScenario, string]>([
    ['agendada', 'SCHEDULED'],
    ['times', 'TEAMS_PUBLISHED'],
    ['em-jogo', 'IN_PROGRESS'],
    ['resenha', 'POST_MATCH'],
  ])(
    'cenário %s: 8 rodadas encerradas e a atual em %s',
    async (scenario, status) => {
      await seed(t.prisma, { scenario, now: NOW });
      const rounds = await loadRounds();

      expect(rounds.map((r) => r.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(rounds.map((r) => r.status)).toEqual([...Array<string>(8).fill('CLOSED'), status]);

      // Mesmo dia da semana e horário, de 7 em 7 dias, em ordem cronológica
      const current = rounds[8]!;
      rounds.forEach((r, i) => {
        expect(current.scheduledAt.getTime() - r.scheduledAt.getTime()).toBe((8 - i) * WEEK_MS);
      });
      expect(rounds[7]!.scheduledAt.getTime()).toBeLessThan(NOW.getTime());
      expect(current.scheduledAt.getUTCHours()).toBe(23); // 20h em Brasília
      expect(current.scheduledAt.getTime() > NOW.getTime()).toBe(
        scenario !== 'em-jogo' && scenario !== 'resenha',
      );

      for (const round of rounds.slice(0, 8)) {
        const teams = teamsOf(round);
        expect(validateRoundTeams(teams)).toEqual([]);

        // Placar = gols lançados (assistência é solta, sem limite)
        const tally = tallyMatchEvents(
          round.matchEvents.map((e) => ({ playerId: e.membershipId, type: e.type })),
          teams,
        );
        expect(tally.goals).toEqual({ WHITE: round.whiteGoals, BLACK: round.blackGoals });

        // Quem jogou confirmou; quem lançou foi o próprio jogador ou um admin
        const confirmed = new Set(
          round.attendances.filter((a) => a.confirmed).map((a) => a.membershipId),
        );
        // Passou pela Resenha e pela votação: a data de abertura está gravada, depois do jogo
        expect(round.votingOpenedAt).not.toBeNull();
        expect(round.votingOpenedAt!.getTime()).toBeGreaterThan(round.scheduledAt.getTime());
        expect(round.teamPlayers.every((p) => confirmed.has(p.membershipId))).toBe(true);
        for (const event of round.matchEvents) {
          expect(event.createdById === event.membershipId || event.createdBy.role === 'ADMIN').toBe(
            true,
          );
        }
      }

      const confirmed = current.attendances.filter((a) => a.confirmed);
      const declined = current.attendances.filter((a) => !a.confirmed);
      const members = await t.prisma.membership.count({
        where: { group: { slug: SEED_GROUP.slug } },
      });
      expect(confirmed).toHaveLength(16);
      expect(declined.length).toBeGreaterThan(0);
      expect(members - current.attendances.length).toBeGreaterThan(0);

      if (scenario === 'agendada') {
        expect(current.teamPlayers).toHaveLength(0);
      } else {
        expect(validateRoundTeams(teamsOf(current))).toEqual([]);
      }
      expect(current.votingOpenedAt).toBeNull();
      if (scenario === 'em-jogo') {
        expect([current.whiteGoals, current.blackGoals]).toEqual([null, null]);
      }
      if (scenario !== 'resenha') expect(current.matchEvents).toHaveLength(0);
    },
    SEED_TIMEOUT_MS,
  );

  it(
    'C48: em-jogo é IN_PROGRESS, com placar nulo e nenhum lance',
    async () => {
      await seed(t.prisma, { scenario: 'em-jogo', now: NOW });
      const current = (await loadRounds())[8]!;

      expect(current.status).toBe('IN_PROGRESS');
      expect([current.whiteGoals, current.blackGoals]).toEqual([null, null]);
      expect(current.matchEvents).toHaveLength(0);
      expect(current.teamPlayers.length).toBeGreaterThan(0);
    },
    SEED_TIMEOUT_MS,
  );

  it(
    'C25: seed em-jogo deixa ao menos uma reserva em cada time e o rodízio desligado',
    async () => {
      await seed(t.prisma, { scenario: 'em-jogo', now: NOW });
      const current = (await loadRounds())[8]!;

      expect(current.status).toBe('IN_PROGRESS');
      expect(
        current.teamPlayers.filter((p) => p.team === 'WHITE' && p.isReserve).length,
      ).toBeGreaterThanOrEqual(1);
      expect(
        current.teamPlayers.filter((p) => p.team === 'BLACK' && p.isReserve).length,
      ).toBeGreaterThanOrEqual(1);
      expect(current.rotationStartedAt).toBeNull();
      expect(current.rotationMinutes).toBeNull();
    },
    SEED_TIMEOUT_MS,
  );

  it(
    'resenha tem placar 3x2, gols faltando e um gol contra',
    async () => {
      await seed(t.prisma, { scenario: 'resenha', now: NOW });
      const current = (await loadRounds())[8]!;

      expect(current.status).toBe('POST_MATCH');
      expect([current.whiteGoals, current.blackGoals]).toEqual([3, 2]);
      const tally = tallyMatchEvents(
        current.matchEvents.map((e) => ({ playerId: e.membershipId, type: e.type })),
        teamsOf(current),
      );
      expect(tally.goals).toEqual({ WHITE: 2, BLACK: 1 });
      expect(current.matchEvents.filter((e) => e.type === 'OWN_GOAL')).toHaveLength(1);
    },
    SEED_TIMEOUT_MS,
  );

  /** Os votos de uma rodada do banco no formato do domain. */
  async function votesOf(roundId: string) {
    const votes = await t.prisma.vote.findMany({
      where: { roundId },
      include: { ratings: true },
      orderBy: { voterId: 'asc' },
    });
    return votes.map((v) => ({
      voterId: v.voterId,
      mvpId: v.mvpId,
      flopId: v.flopId,
      ratings: v.ratings.map((r) => ({ targetId: r.targetId, value: r.value })),
    }));
  }

  /** O resultado gravado no `TeamPlayer` é o que a apuração do domínio dá para os votos da rodada. */
  async function expectResultMatchesVotes(round: LoadedRound) {
    const result = roundResults(
      await votesOf(round.id),
      round.teamPlayers.map((p) => p.membershipId),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const p of round.teamPlayers) {
      expect({
        roundScore: p.roundScore,
        ratingsCount: p.ratingsCount,
        isMvp: p.isMvp,
        isFlop: p.isFlop,
      }).toEqual({
        roundScore: result.value.players[p.membershipId]!.score,
        ratingsCount: result.value.players[p.membershipId]!.ratingsCount,
        isMvp: result.value.mvpIds.includes(p.membershipId),
        isFlop: result.value.flopIds.includes(p.membershipId),
      });
    }
  }

  it(
    'C33: votacao deixa a rodada atual em VOTING aberta agora, com parte dos votos e o admin de dev sem votar',
    async () => {
      await seed(t.prisma, { scenario: 'votacao', now: NOW });
      const rounds = await loadRounds();
      const current = rounds[8]!;

      expect(current.status).toBe('VOTING');
      expect([current.whiteGoals, current.blackGoals]).toEqual([3, 2]);
      expect(
        tallyMatchEvents(
          current.matchEvents.map((e) => ({ playerId: e.membershipId, type: e.type })),
          teamsOf(current),
        ).goals,
      ).toEqual({ WHITE: 3, BLACK: 2 });
      expect(current.closedAt).toBeNull();
      expect(current.votingEndReason).toBeNull();

      // Aberta agora: abriu antes de agora e o prazo (24 h) ainda não passou
      const openedAt = current.votingOpenedAt!;
      expect(openedAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
      expect(votingDeadline(openedAt, 24).getTime()).toBeGreaterThan(NOW.getTime());

      // Parte dos votos, nunca os dos admins; o resultado só existe depois de fechar
      const votes = await votesOf(current.id);
      const nicknameOf = new Map(
        current.teamPlayers.map((p) => [p.membershipId, p.membership.nickname]),
      );
      const voters = votes.map((v) => nicknameOf.get(v.voterId)!);
      expect(votes.length).toBeGreaterThan(0);
      expect(votes.length).toBeLessThan(current.teamPlayers.length);
      expect(voters).not.toContain('Carlão');
      expect(voters).not.toContain('Rafa');
      expect(nicknameOf.has((await adminId('Carlão'))!)).toBe(true); // o admin de dev jogou
      expect(new Set(voters).size).toBe(voters.length);
      expect(roundResults(votes, [...nicknameOf.keys()]).ok).toBe(true);
      expect(current.teamPlayers.every((p) => p.roundScore === null && !p.isMvp && !p.isFlop)).toBe(
        true,
      );
      for (const vote of await t.prisma.vote.findMany({ where: { roundId: current.id } })) {
        expect(vote.createdAt.getTime()).toBeGreaterThanOrEqual(openedAt.getTime());
        expect(vote.createdAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
      }
    },
    SEED_TIMEOUT_MS,
  );

  async function adminId(nickname: string) {
    return (
      await t.prisma.membership.findFirst({
        where: { nickname, group: { slug: SEED_GROUP.slug } },
      })
    )?.id;
  }

  it(
    'C33: encerrada deixa a última rodada CLOSED hoje, com votos e o resultado gravado',
    async () => {
      await seed(t.prisma, { scenario: 'encerrada', now: NOW });
      const rounds = await loadRounds();
      const current = rounds[8]!;

      expect(rounds.map((r) => r.status)).toEqual(Array<string>(9).fill('CLOSED'));
      // Fechou hoje, antes de agora
      expect(current.closedAt!.toISOString().slice(0, 10)).toBe(NOW.toISOString().slice(0, 10));
      expect(current.closedAt!.getTime()).toBeLessThanOrEqual(NOW.getTime());
      expect(current.closedAt!.getTime()).toBeGreaterThan(current.votingOpenedAt!.getTime());
      expect(current.votingEndReason).not.toBeNull();
      expect((await votesOf(current.id)).length).toBeGreaterThan(0);
      expect(current.teamPlayers.some((p) => p.isMvp)).toBe(true);
      expect(current.teamPlayers.some((p) => p.isFlop)).toBe(true);
      expect(current.teamPlayers.some((p) => p.roundScore !== null)).toBe(true);
      await expectResultMatchesVotes(current);
    },
    SEED_TIMEOUT_MS,
  );

  it(
    'C33: as rodadas passadas têm votos e resultado gravado, fechadas de jeitos diferentes',
    async () => {
      await seed(t.prisma, { scenario: 'votacao', now: NOW });
      const past = (await loadRounds()).slice(0, 8);

      for (const round of past) {
        expect(round.votingEndReason).not.toBeNull();
        expect(round.closedAt!.getTime()).toBeGreaterThan(round.votingOpenedAt!.getTime());
        expect(round.closedAt!.getTime()).toBeLessThanOrEqual(
          votingDeadline(round.votingOpenedAt!, 24).getTime(),
        );
        const votes = await votesOf(round.id);
        expect(votes.length).toBeGreaterThan(0);
        // Cada um que jogou aparece com a nota, sem nota só se ninguém avaliou
        expect(round.teamPlayers.filter((p) => p.isMvp).length).toBeGreaterThan(0);
        expect(round.teamPlayers.filter((p) => p.isFlop).length).toBeGreaterThan(0);
        await expectResultMatchesVotes(round);

        if (round.votingEndReason === 'ALL_VOTED') {
          expect(votes).toHaveLength(round.teamPlayers.length);
        } else {
          expect(votes.length).toBeLessThan(round.teamPlayers.length);
        }
        if (round.votingEndReason === 'DEADLINE_PASSED') {
          expect(round.closedAt!.getTime()).toBe(
            votingDeadline(round.votingOpenedAt!, 24).getTime(),
          );
        }
      }
      expect(new Set(past.map((r) => r.votingEndReason))).toEqual(
        new Set(['ALL_VOTED', 'DEADLINE_PASSED', 'ADMIN_CLOSED']),
      );
    },
    SEED_TIMEOUT_MS,
  );

  it(
    'C33: rodar de novo recria os mesmos votos e resultados',
    async () => {
      const retrato = async () => {
        const rounds = await loadRounds();
        return Promise.all(
          rounds.map(async (r) => ({
            status: r.status,
            reason: r.votingEndReason,
            closedAt: r.closedAt?.toISOString() ?? null,
            votes: (await votesOf(r.id))
              .map((v) => ({
                ...v,
                voterId: r.teamPlayers.find((p) => p.membershipId === v.voterId)!.membership
                  .nickname,
                mvpId: r.teamPlayers.find((p) => p.membershipId === v.mvpId)!.membership.nickname,
                flopId: r.teamPlayers.find((p) => p.membershipId === v.flopId)!.membership.nickname,
                ratings: v.ratings
                  .map((x) => [
                    r.teamPlayers.find((p) => p.membershipId === x.targetId)!.membership.nickname,
                    x.value,
                  ])
                  .sort(),
              }))
              .sort((a, b) => a.voterId.localeCompare(b.voterId)),
            results: r.teamPlayers
              .map((p) => [p.membership.nickname, p.roundScore, p.ratingsCount, p.isMvp, p.isFlop])
              .sort(),
          })),
        );
      };
      await seed(t.prisma, { scenario: 'encerrada', now: NOW });
      const first = await retrato();
      await seed(t.prisma, { scenario: 'encerrada', now: NOW });
      expect(await retrato()).toEqual(first);
      // E o cenário `votacao` troca a rodada atual sem sobrar voto da outra
      await seed(t.prisma, { scenario: 'votacao', now: NOW });
      const rounds = await loadRounds();
      expect(rounds[8]!.status).toBe('VOTING');
      expect(rounds[8]!.closedAt).toBeNull();
      expect(await t.prisma.round.count({ where: { group: { slug: SEED_GROUP.slug } } })).toBe(9);
    },
    SEED_TIMEOUT_MS,
  );

  it(
    'o histórico cobre os casos que as telas precisam',
    async () => {
      await seed(t.prisma, { now: NOW });
      const past = (await loadRounds()).slice(0, 8);

      const scores = past.map((r) => [r.whiteGoals!, r.blackGoals!] as const);
      expect(scores.some(([w, b]) => w === b && w > 0)).toBe(true); // empate com gols
      expect(scores.some(([w, b]) => w === 0 && b === 0)).toBe(true); // 0 x 0
      expect(scores.some(([w, b]) => Math.abs(w - b) >= 5)).toBe(true); // goleada

      const hatTrick = past.some((r) => {
        const goals = new Map<string, number>();
        for (const e of r.matchEvents.filter((e) => e.type === 'GOAL')) {
          goals.set(e.membershipId, (goals.get(e.membershipId) ?? 0) + 1);
        }
        return [...goals.values()].some((n) => n >= 3);
      });
      expect(hatTrick).toBe(true);

      const ownGoals = past.flatMap((r) => r.matchEvents).filter((e) => e.type === 'OWN_GOAL');
      expect(ownGoals.length).toBeGreaterThanOrEqual(2);

      const reserves = past.map((r) => r.teamPlayers.filter((p) => p.isReserve).length);
      expect(reserves).toContain(0);
      expect(Math.max(...reserves)).toBe(4);

      const events = past.flatMap((r) => r.matchEvents);
      expect(events.some((e) => e.createdById === e.membershipId)).toBe(true);
      expect(events.some((e) => e.createdById !== e.membershipId)).toBe(true);

      // Alguém fica 4 semanas seguidas sem jogar
      const lastFour = past.slice(-4);
      const regular = await t.prisma.membership.findMany({
        where: { group: { slug: SEED_GROUP.slug }, primaryPosition: { not: 'GOALKEEPER' } },
      });
      const absentStreak = regular.filter((m) =>
        lastFour.every((r) => !r.teamPlayers.some((p) => p.membershipId === m.id)),
      );
      expect(absentStreak.length).toBeGreaterThan(0);
    },
    SEED_TIMEOUT_MS,
  );

  // Roda o seed completo 3 vezes: na CI passa dos 5 s padrão do Jest.
  it(
    'é idempotente e não mexe em outros grupos',
    async () => {
      const other = await createGroup(t);
      await t.prisma.round.create({ data: { groupId: other.id, scheduledAt: NOW } });

      await seed(t.prisma, { scenario: 'em-jogo', now: NOW });
      const first = snapshot(await loadRounds());
      await seed(t.prisma, { scenario: 'agendada', now: NOW });
      await seed(t.prisma, { scenario: 'em-jogo', now: NOW });
      const second = snapshot(await loadRounds());

      expect(second).toEqual(first);
      expect(await t.prisma.round.count({ where: { groupId: other.id } })).toBe(1);
      expect(
        await t.prisma.group.findUnique({
          where: { slug: SEED_GROUP.slug },
          select: { inviteCode: true },
        }),
      ).toEqual({ inviteCode: SEED_GROUP.inviteCode });
      expect(await t.prisma.membership.count({ where: { group: { slug: SEED_GROUP.slug } } })).toBe(
        21,
      );
    },
    SEED_TIMEOUT_MS,
  );

  it(
    'C29: cada membro tem um bonequinho variado e fixo (o mesmo em toda execução)',
    async () => {
      const avatars = async () =>
        new Map(
          (await t.prisma.membership.findMany({ where: { group: { slug: SEED_GROUP.slug } } })).map(
            (m) => [
              m.nickname,
              { skin: m.avatarSkin, hair: m.avatarHair, hairColor: m.avatarHairColor },
            ],
          ),
        );

      await seed(t.prisma, { now: NOW });
      const first = await avatars();
      // outra execução, mesmo com o banco já seedado, e depois de um reset: o mesmo resultado
      await seed(t.prisma, { now: NOW });
      expect(await avatars()).toEqual(first);
      await resetDatabase(t.prisma);
      await seed(t.prisma, { now: NOW });
      expect(await avatars()).toEqual(first);

      const all = [...first.values()];
      expect(all.every(isPlayerAvatar)).toBe(true);
      // variado: nenhum bonequinho repetido, e toda opção das três listas aparece
      expect(new Set(all.map((a) => JSON.stringify(a))).size).toBe(all.length);
      expect(new Set(all.map((a) => a.skin))).toEqual(new Set(AVATAR_SKINS));
      expect(new Set(all.map((a) => a.hair))).toEqual(new Set(AVATAR_HAIRS));
      expect(new Set(all.map((a) => a.hairColor))).toEqual(new Set(AVATAR_HAIR_COLORS));
    },
    SEED_TIMEOUT_MS,
  );

  it(
    'C26: 3 resenhas de exemplo (uma sem título, uma longa com quebra de linha), com reações e comentários',
    async () => {
      await seed(t.prisma, { now: NOW });
      const load = () =>
        t.prisma.post.findMany({
          where: { group: { slug: SEED_GROUP.slug } },
          orderBy: { createdAt: 'desc' },
          include: {
            author: true,
            reactions: true,
            comments: { orderBy: { createdAt: 'asc' } },
          },
        });
      const posts = await load();

      expect(posts).toHaveLength(3);
      for (const post of posts) {
        expect(post.author.role).toBe('ADMIN');
        expect(validatePostInput({ title: post.title, body: post.body })).toEqual([]);
        // quem reage reage uma vez só
        const reactors = post.reactions.map((r) => r.membershipId);
        expect(new Set(reactors).size).toBe(reactors.length);
        for (const comment of post.comments) expect(validateCommentText(comment.text)).toBeNull();
        expect(post.createdAt.getTime()).toBeLessThan(NOW.getTime());
      }
      expect(posts.filter((p) => p.title === null)).toHaveLength(1);
      const long = posts.filter((p) => p.body.includes('\n') && p.body.length > 300);
      expect(long).toHaveLength(1);
      expect(long[0]!.body.length).toBeLessThanOrEqual(POST_BODY_MAX_LENGTH);
      expect(posts.filter((p) => p.reactions.length > 0)).toHaveLength(3);
      expect(posts.filter((p) => p.comments.length > 0).length).toBeGreaterThanOrEqual(2);
      // comentários depois da resenha
      for (const post of posts) {
        for (const comment of post.comments) {
          expect(comment.createdAt.getTime()).toBeGreaterThan(post.createdAt.getTime());
        }
      }

      // rodar de novo recria as resenhas do grupo, sem duplicar
      await seed(t.prisma, { now: NOW });
      const again = await load();
      expect(again).toHaveLength(3);
      expect(again.map((p) => p.body)).toEqual(posts.map((p) => p.body));
      expect(await t.prisma.postReaction.count()).toBe(
        posts.reduce((sum, p) => sum + p.reactions.length, 0),
      );
    },
    SEED_TIMEOUT_MS,
  );

  it('lê o cenário dos argumentos', () => {
    expect(parseSeedScenario([])).toBe('agendada');
    expect(parseSeedScenario(['--cenario=em-jogo'])).toBe('em-jogo');
    expect(parseSeedScenario(['--cenario', 'times'])).toBe('times');
    expect(parseSeedScenario(['--cenario=resenha'])).toBe('resenha');
    expect(parseSeedScenario(['--cenario=votacao'])).toBe('votacao');
    expect(parseSeedScenario(['--cenario', 'encerrada'])).toBe('encerrada');
    expect(() => parseSeedScenario(['--cenario=inexistente'])).toThrow(SEED_SCENARIOS.join(', '));
  });
});
