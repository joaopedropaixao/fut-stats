import {
  tallyMatchEvents,
  TEAMS,
  validateRoundTeams,
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
        teamPlayers: { include: { membership: true } },
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
  ])('cenário %s: 8 rodadas encerradas e a atual em %s', async (scenario, status) => {
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

      // Placar = lances; assistências ≤ gols do time
      const tally = tallyMatchEvents(
        round.matchEvents.map((e) => ({ playerId: e.membershipId, type: e.type })),
        teams,
      );
      expect(tally.goals).toEqual({ WHITE: round.whiteGoals, BLACK: round.blackGoals });
      for (const team of TEAMS) expect(tally.assists[team]).toBeLessThanOrEqual(tally.goals[team]);

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
      expect(current.matchEvents.length).toBeGreaterThan(0);
      expect([current.whiteGoals, current.blackGoals]).toEqual([null, null]);
    } else if (scenario !== 'resenha') {
      expect(current.matchEvents).toHaveLength(0);
    }
  });

  it('C29: em-jogo tem 2x1 em gols, todos lançados pelo admin, e placar nulo', async () => {
    await seed(t.prisma, { scenario: 'em-jogo', now: NOW });
    const current = (await loadRounds())[8]!;

    expect(current.status).toBe('IN_PROGRESS');
    expect([current.whiteGoals, current.blackGoals]).toEqual([null, null]);
    const tally = tallyMatchEvents(
      current.matchEvents.map((e) => ({ playerId: e.membershipId, type: e.type })),
      teamsOf(current),
    );
    expect(tally.goals).toEqual({ WHITE: 2, BLACK: 1 });
    expect(current.matchEvents.every((e) => e.createdBy.role === 'ADMIN')).toBe(true);
  });

  it('C29: resenha tem placar 3x2, gols faltando e um gol contra', async () => {
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
  });

  it('o histórico cobre os casos que as telas precisam', async () => {
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
  });

  // Roda o seed completo 3 vezes: na CI passa dos 5 s padrão do Jest.
  it('é idempotente e não mexe em outros grupos', async () => {
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
  }, 30_000);

  it('lê o cenário dos argumentos', () => {
    expect(parseSeedScenario([])).toBe('agendada');
    expect(parseSeedScenario(['--cenario=em-jogo'])).toBe('em-jogo');
    expect(parseSeedScenario(['--cenario', 'times'])).toBe('times');
    expect(parseSeedScenario(['--cenario=resenha'])).toBe('resenha');
    expect(() => parseSeedScenario(['--cenario=votacao'])).toThrow(SEED_SCENARIOS.join(', '));
  });
});
