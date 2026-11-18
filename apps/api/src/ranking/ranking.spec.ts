import {
  lineupSchema,
  lineupSuggestionSchema,
  playerProfileSchema,
  rankingSchema,
  roundDetailSchema,
  type PlayerProfile,
  type Ranking,
  type SaveLineupInput,
} from '@fut-stats/shared';
import request from 'supertest';
import type { MatchEventType, Position, RoundStatus, Team } from '../generated/prisma/enums';
import { addMember, createGroup, createUser, loginAs } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Um jogador numa rodada de teste. `score: null` = ninguém deu nota. */
interface Played {
  id: string;
  team: Team;
  position?: Position;
  reserve?: boolean;
  score?: number | null;
  mvp?: boolean;
  flop?: boolean;
}

interface RoundSeed {
  /** Quantos dias atrás foi marcada (maior = mais antiga). */
  daysAgo: number;
  status?: RoundStatus;
  white: number;
  black: number;
  players: Played[];
  events?: { id: string; type: MatchEventType }[];
}

describe('ranking e nota de referência', () => {
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

  const server = () => t.app.getHttpServer();
  const as = (userId: string) => loginAs(t, userId);
  const rankingUrl = (groupId: string) => `/api/groups/${groupId}/ranking`;
  const statsUrl = (groupId: string, membershipId: string) =>
    `/api/groups/${groupId}/members/${membershipId}/stats`;

  async function makeMember(
    groupId: string,
    nickname: string,
    data: Parameters<typeof addMember>[3] = {},
  ) {
    const user = await createUser(t);
    const membership = await addMember(t, user.id, groupId, { nickname, ...data });
    return { user, membership, id: membership.id };
  }

  /** Cria a rodada com os times, os lances e as notas já gravados (como depois de fechar a votação). */
  async function addRound(groupId: string, seed: RoundSeed) {
    return t.prisma.round.create({
      data: {
        groupId,
        scheduledAt: new Date(Date.now() - seed.daysAgo * DAY_MS),
        status: seed.status ?? 'CLOSED',
        whiteGoals: seed.white,
        blackGoals: seed.black,
        teamPlayers: {
          create: seed.players.map((p) => ({
            membershipId: p.id,
            team: p.team,
            position: p.position ?? 'MIDFIELDER',
            isReserve: p.reserve ?? false,
            roundScore: p.score ?? null,
            isMvp: p.mvp ?? false,
            isFlop: p.flop ?? false,
          })),
        },
        matchEvents: {
          create: (seed.events ?? []).map((e) => ({
            membershipId: e.id,
            type: e.type,
            createdById: e.id,
          })),
        },
      },
    });
  }

  const get = (path: string, userId: string) =>
    request(server()).get(path).set('Cookie', as(userId));

  /**
   * Grupo com 4 rodadas encerradas e uma em votação (que não pode contar).
   * Zeca (a figurinha do C1): V 8,0 com 2 gols; D sem nota; E 7,0 com 1 assistência e Craque; V 6,5 com gol contra e Perna de Pau.
   */
  async function setup() {
    const group = await createGroup(t);
    const ana = await makeMember(group.id, 'Ana', { role: 'ADMIN' });
    const beto = await makeMember(group.id, 'Beto');
    const dede = await makeMember(group.id, 'Dedé', { primaryPosition: 'DEFENDER' });
    const zeca = await makeMember(group.id, 'Zeca', {
      secondaryPositions: ['WINGER'],
      initialRating: 6,
    });
    const paredao = await makeMember(group.id, 'Paredão', { primaryPosition: 'GOALKEEPER' });
    const novato = await makeMember(group.id, 'Novato', { primaryPosition: 'FORWARD' });
    const fantasma = await makeMember(group.id, 'Fantasma', { primaryPosition: 'FORWARD' });
    const saiu = await makeMember(group.id, 'Saiu', { active: false });
    const gk: Position = 'GOALKEEPER';

    const r1 = await addRound(group.id, {
      daysAgo: 40,
      white: 3,
      black: 0,
      players: [
        { id: zeca.id, team: 'WHITE', score: 8 },
        { id: ana.id, team: 'WHITE', score: 8 },
        { id: dede.id, team: 'WHITE', score: 9 },
        { id: paredao.id, team: 'WHITE', position: gk, score: 7 },
        { id: beto.id, team: 'BLACK', score: 8 },
        { id: saiu.id, team: 'BLACK', score: 10 },
      ],
      events: [
        { id: zeca.id, type: 'GOAL' },
        { id: zeca.id, type: 'GOAL' },
        { id: ana.id, type: 'GOAL' },
      ],
    });
    const r2 = await addRound(group.id, {
      daysAgo: 30,
      white: 0,
      black: 2,
      players: [
        { id: zeca.id, team: 'WHITE', score: null },
        { id: ana.id, team: 'WHITE', score: 8 },
        { id: paredao.id, team: 'WHITE', position: gk, score: 7 },
        { id: dede.id, team: 'BLACK', score: 9 },
        { id: beto.id, team: 'BLACK', score: 8 },
        { id: saiu.id, team: 'BLACK', score: 10 },
      ],
    });
    const r3 = await addRound(group.id, {
      daysAgo: 20,
      white: 1,
      black: 1,
      players: [
        { id: zeca.id, team: 'WHITE', score: 7, mvp: true },
        { id: dede.id, team: 'WHITE', score: 9 },
        { id: paredao.id, team: 'WHITE', position: gk, score: 7 },
        { id: ana.id, team: 'BLACK', score: 8 },
        { id: beto.id, team: 'BLACK', score: 8 },
        { id: saiu.id, team: 'BLACK', score: 10 },
      ],
      events: [{ id: zeca.id, type: 'ASSIST' }],
    });
    const r4 = await addRound(group.id, {
      daysAgo: 10,
      white: 2,
      black: 1,
      players: [
        { id: zeca.id, team: 'WHITE', score: 6.5, flop: true },
        // goleiro de linha nesta rodada: não entra nos números de goleiro
        { id: paredao.id, team: 'WHITE', position: 'MIDFIELDER', score: null },
        { id: novato.id, team: 'BLACK', position: 'FORWARD', score: 10 },
      ],
      events: [{ id: zeca.id, type: 'OWN_GOAL' }],
    });
    // Em votação: nada dela conta (nem as notas, que ainda nem existiriam)
    await addRound(group.id, {
      daysAgo: 1,
      status: 'VOTING',
      white: 5,
      black: 0,
      players: [
        { id: zeca.id, team: 'WHITE', score: 9, mvp: true },
        { id: novato.id, team: 'BLACK', score: 9 },
      ],
      events: [{ id: zeca.id, type: 'GOAL' }],
    });

    return {
      group,
      ana,
      beto,
      dede,
      zeca,
      paredao,
      novato,
      fantasma,
      saiu,
      rounds: [r1, r2, r3, r4],
    };
  }

  type Setup = Awaited<ReturnType<typeof setup>>;

  async function fetchRanking(s: Setup) {
    const res = await get(rankingUrl(s.group.id), s.ana.user.id).expect(200);
    expect(rankingSchema.safeParse(res.body).success).toBe(true);
    return res.body as Ranking;
  }

  const byNickname = (ranking: Ranking, nickname: string) =>
    ranking.players.find((p) => p.nickname === nickname)!;

  describe('GET /groups/:groupId/ranking', () => {
    it('C10: conta só as rodadas encerradas e confere as estatísticas com o banco', async () => {
      const s = await setup();

      const ranking = await fetchRanking(s);

      expect(ranking.closedRounds).toBe(4);
      expect(ranking.minRatedGames).toBe(3);
      expect(ranking.me).toEqual({ membershipId: s.ana.id });
      const zeca = byNickname(ranking, 'Zeca').stats;
      expect(zeca).toMatchObject({
        games: 4,
        wins: 2,
        draws: 1,
        losses: 1,
        goals: 2,
        assists: 1,
        ownGoals: 1,
        mvps: 1,
        flops: 1,
        ratedGames: 3,
        average: 7.17,
        streak: { result: 'WIN', count: 1 },
        goalkeeper: null,
      });

      // Confere contra o banco: a rodada em votação (gol, Craque, nota 9) ficou de fora
      const closed = { round: { groupId: s.group.id, status: 'CLOSED' as const } };
      const dbEvents = (type: MatchEventType) =>
        t.prisma.matchEvent.count({ where: { membershipId: s.zeca.id, type, ...closed } });
      expect(await dbEvents('GOAL')).toBe(zeca.goals);
      expect(await dbEvents('ASSIST')).toBe(zeca.assists);
      expect(await dbEvents('OWN_GOAL')).toBe(zeca.ownGoals);
      const rows = await t.prisma.teamPlayer.findMany({
        where: { membershipId: s.zeca.id, ...closed },
      });
      expect(rows).toHaveLength(zeca.games);
      expect(rows.filter((r) => r.isMvp)).toHaveLength(zeca.mvps);
      expect(rows.filter((r) => r.isFlop)).toHaveLength(zeca.flops);
      const scores = rows.flatMap((r) => (r.roundScore === null ? [] : [r.roundScore]));
      expect(scores).toHaveLength(zeca.ratedGames);
      expect(Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100).toBe(
        zeca.average,
      );
    });

    it('C11: classificados por média (empate divide a posição), depois os de poucos jogos', async () => {
      const s = await setup();

      const ranking = await fetchRanking(s);

      expect(
        ranking.players.map((p) => [p.nickname, p.rank, p.positionRank, p.stats.average]),
      ).toEqual([
        ['Dedé', 1, 1, 9],
        ['Ana', 2, 1, 8],
        ['Beto', 2, 1, 8],
        ['Zeca', 4, 3, 7.17],
        ['Paredão', 5, 1, 7],
        // poucos jogos: sem posição, por jogos (mais primeiro) e apelido, mesmo com a maior média
        ['Novato', null, null, 10],
        ['Fantasma', null, null, null],
      ]);
    });

    it('C12: quem subiu 2 posições com a última rodada tem trend 2; quem entrou no ranking agora, null', async () => {
      const group = await createGroup(t);
      const a = await makeMember(group.id, 'A');
      const b = await makeMember(group.id, 'B');
      const c = await makeMember(group.id, 'C');
      const d = await makeMember(group.id, 'D');
      const e = await makeMember(group.id, 'E');
      const scores = (days: number, list: [typeof a, number][]) =>
        addRound(group.id, {
          daysAgo: days,
          white: 1,
          black: 1,
          players: list.map(([m, score]) => ({ id: m.id, team: 'WHITE' as const, score })),
        });
      await scores(40, [
        [a, 9],
        [b, 8],
        [c, 7],
        [d, 6],
      ]);
      await scores(30, [
        [a, 9],
        [b, 8],
        [c, 7],
        [d, 6],
        [e, 5],
      ]);
      await scores(20, [
        [a, 9],
        [b, 8],
        [c, 7],
        [d, 6],
        [e, 5],
      ]);
      // A última: A cai, B cai um pouco, C dispara. E chega ao mínimo de 3 notas e entra no ranking.
      await scores(10, [
        [a, 3],
        [b, 6],
        [c, 10],
        [d, 6],
        [e, 6],
      ]);

      const res = await get(rankingUrl(group.id), a.user.id).expect(200);

      const players = (res.body as Ranking).players;
      const row = (nickname: string) => players.find((p) => p.nickname === nickname)!;
      // depois: C 7,75 (1º), A e B 7,5 (2º), D 6, E 5,33 · antes: A 1º, B 2º, C 3º, D 4º, E sem posição
      expect(row('C')).toMatchObject({ rank: 1, trend: 2 });
      expect(row('A')).toMatchObject({ rank: 2, trend: -1 });
      expect(row('B')).toMatchObject({ rank: 2, trend: 0 });
      expect(row('D')).toMatchObject({ rank: 4, trend: 0 });
      expect(row('E')).toMatchObject({ rank: 5, trend: null });
    });

    it('C12: com uma só rodada encerrada ninguém tem tendência', async () => {
      const group = await createGroup(t);
      const a = await makeMember(group.id, 'A');
      await addRound(group.id, {
        daysAgo: 5,
        white: 1,
        black: 0,
        players: [{ id: a.id, team: 'WHITE', score: 8 }],
      });

      const res = await get(rankingUrl(group.id), a.user.id).expect(200);

      expect((res.body as Ranking).players[0]).toMatchObject({ rank: 1, trend: null });
    });

    it('C13: goleiro vem com os números de goleiro (só as rodadas na vaga); jogador de linha, null', async () => {
      const s = await setup();

      const ranking = await fetchRanking(s);

      // 3 jogos no gol (sofreu 0, 2 e 1); a rodada na linha (R4) não entra
      expect(byNickname(ranking, 'Paredão').stats.goalkeeper).toEqual({
        games: 3,
        conceded: 3,
        cleanSheets: 1,
        concededPerGame: 1,
      });
      expect(byNickname(ranking, 'Paredão').stats.games).toBe(4);
      for (const p of ranking.players.filter((x) => x.primaryPosition !== 'GOALKEEPER')) {
        expect(p.stats.goalkeeper).toBeNull();
      }
    });

    it('C14: membro inativo não aparece e não conta nas posições dos outros', async () => {
      const s = await setup();

      const ranking = await fetchRanking(s);

      expect(ranking.players.map((p) => p.membershipId)).not.toContain(s.saiu.id);
      expect(ranking.players).toHaveLength(7);
      // o inativo tinha média 10 nas 3 rodadas: se contasse, o Dedé não seria o 1º
      expect(byNickname(ranking, 'Dedé').rank).toBe(1);
      expect(ranking.closedRounds).toBe(4);
    });

    it('C15: grupo sem rodada encerrada: todos sem posição e com estatísticas zeradas', async () => {
      const group = await createGroup(t);
      const ana = await makeMember(group.id, 'Ana', { role: 'ADMIN' });
      await makeMember(group.id, 'Beto');
      await makeMember(group.id, 'Paredão', { primaryPosition: 'GOALKEEPER' });
      await addRound(group.id, { daysAgo: 1, status: 'VOTING', white: 1, black: 0, players: [] });

      const res = await get(rankingUrl(group.id), ana.user.id).expect(200);

      const ranking = res.body as Ranking;
      expect(rankingSchema.safeParse(ranking).success).toBe(true);
      expect(ranking.closedRounds).toBe(0);
      expect(ranking.minRatedGames).toBe(1);
      expect(ranking.players).toHaveLength(3);
      const zero = {
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals: 0,
        assists: 0,
        ownGoals: 0,
        mvps: 0,
        flops: 0,
        ratedGames: 0,
        average: null,
        streak: null,
      };
      for (const p of ranking.players) {
        expect(p).toMatchObject({ rank: null, positionRank: null, trend: null });
        expect(p.stats).toMatchObject(zero);
      }
      expect(byNickname(ranking, 'Paredão').stats.goalkeeper).toEqual({
        games: 0,
        conceded: 0,
        cleanSheets: 0,
        concededPerGame: null,
      });
    });
  });

  describe('GET /groups/:groupId/members/:membershipId/stats', () => {
    it('C16: a figurinha do jogador com estatísticas, posições, nota de referência e as últimas rodadas', async () => {
      const s = await setup();

      const res = await get(statsUrl(s.group.id, s.zeca.id), s.ana.user.id).expect(200);

      const profile = res.body as PlayerProfile;
      expect(playerProfileSchema.safeParse(profile).success).toBe(true);
      expect(profile).toMatchObject({
        membershipId: s.zeca.id,
        nickname: 'Zeca',
        avatar: { skin: 'TAN', hair: 'SHORT', hairColor: 'BLACK' },
        primaryPosition: 'MIDFIELDER',
        secondaryPositions: ['WINGER'],
        isHiredGoalkeeper: false,
        role: 'PLAYER',
        rank: 4,
        positionRank: 3,
        trend: null,
        // (8 + 7 + 6,5 + 2 × inicial 6) / 5: a rodada sem nota e a em votação não entram
        referenceRating: 6.7,
      });
      expect(profile.stats).toMatchObject({ games: 4, wins: 2, average: 7.17, goals: 2 });
      // da mais recente para a mais antiga; a rodada em votação não aparece
      expect(profile.lastRounds.map((r) => r.number)).toEqual(
        [...s.rounds].reverse().map((r) => r.number),
      );
      const [r4, r3, r2, r1] = profile.lastRounds;
      expect(r4).toEqual({
        roundId: s.rounds[3]!.id,
        number: s.rounds[3]!.number,
        scheduledAt: s.rounds[3]!.scheduledAt.toISOString(),
        team: 'WHITE',
        result: 'WIN',
        score: 6.5,
        goals: 0,
        assists: 0,
        isMvp: false,
        isFlop: true,
      });
      expect(r3).toMatchObject({ result: 'DRAW', score: 7, assists: 1, isMvp: true });
      expect(r2).toMatchObject({ result: 'LOSS', score: null });
      expect(r1).toMatchObject({ result: 'WIN', score: 8, goals: 2 });
    });

    it('C16: o perfil mostra no máximo as 5 últimas rodadas jogadas', async () => {
      const group = await createGroup(t);
      const a = await makeMember(group.id, 'A');
      for (let i = 7; i >= 1; i -= 1) {
        await addRound(group.id, {
          daysAgo: i * 5,
          white: 1,
          black: 0,
          players: [{ id: a.id, team: 'WHITE', score: 5 + i / 2 }],
        });
      }

      const res = await get(statsUrl(group.id, a.id), a.user.id).expect(200);

      const profile = res.body as PlayerProfile;
      expect(profile.lastRounds).toHaveLength(5);
      // as 5 mais recentes: notas 5,5 (i=1) até 7 (i=4)
      expect(profile.lastRounds.map((r) => r.score)).toEqual([5.5, 6, 6.5, 7, 7.5]);
      expect(profile.stats.games).toBe(7);
      // 5 notas: a inicial não pesa; média das 5 últimas
      expect(profile.referenceRating).toBe(6.5);
    });

    it('C16: o perfil do goleiro traz os números de goleiro; jogador sem rodada, tudo zerado', async () => {
      const s = await setup();

      const keeper = (await get(statsUrl(s.group.id, s.paredao.id), s.ana.user.id).expect(200))
        .body as PlayerProfile;
      const empty = (await get(statsUrl(s.group.id, s.fantasma.id), s.ana.user.id).expect(200))
        .body as PlayerProfile;

      expect(keeper.stats.goalkeeper).toMatchObject({ games: 3, conceded: 3, cleanSheets: 1 });
      expect(empty).toMatchObject({ rank: null, lastRounds: [], referenceRating: 6 });
      expect(empty.stats).toMatchObject({ games: 0, average: null, streak: null });
    });

    it('C17: membership inativa, de outro grupo ou inexistente é 404', async () => {
      const s = await setup();
      const other = await createGroup(t);
      const stranger = await makeMember(other.id, 'Estranho');

      await get(statsUrl(s.group.id, s.saiu.id), s.ana.user.id).expect(404);
      await get(statsUrl(s.group.id, stranger.id), s.ana.user.id).expect(404);
      await get(statsUrl(s.group.id, 'nao-existe'), s.ana.user.id).expect(404);
      // o id do jogador de outro grupo também não vale pela rota do outro grupo
      await get(statsUrl(other.id, s.zeca.id), stranger.user.id).expect(404);
    });
  });

  describe('permissões', () => {
    it('C21: usuário de outro grupo, quem não é membro e membro inativo recebem 404 nas duas rotas', async () => {
      const s = await setup();
      const other = await createGroup(t);
      const outsider = await makeMember(other.id, 'De fora');
      const nobody = await createUser(t);

      for (const userId of [outsider.user.id, nobody.id, s.saiu.user.id]) {
        await get(rankingUrl(s.group.id), userId).expect(404);
        await get(statsUrl(s.group.id, s.zeca.id), userId).expect(404);
      }
      await request(server()).get(rankingUrl(s.group.id)).expect(401);
    });

    it('C21: jogador comum (não admin) vê o ranking e o perfil', async () => {
      const s = await setup();

      await get(rankingUrl(s.group.id), s.zeca.user.id).expect(200);
      await get(statsUrl(s.group.id, s.ana.id), s.zeca.user.id).expect(200);
    });
  });

  describe('nota de referência nas listas e no seletor', () => {
    /** Ref (inicial 6) com notas 8 e 9 nas duas últimas rodadas; Outro (7,5) e Admin (6,5) sem rodada. */
    async function referenceSetup() {
      const group = await createGroup(t);
      const admin = await makeMember(group.id, 'Admin', { role: 'ADMIN', initialRating: 6.5 });
      const ref = await makeMember(group.id, 'Ref', { initialRating: 6 });
      const outro = await makeMember(group.id, 'Outro', { initialRating: 7.5 });
      await addRound(group.id, {
        daysAgo: 20,
        white: 1,
        black: 0,
        players: [{ id: ref.id, team: 'WHITE', score: 8 }],
      });
      await addRound(group.id, {
        daysAgo: 10,
        white: 1,
        black: 0,
        players: [{ id: ref.id, team: 'WHITE', score: 9 }],
      });
      const next = await t.prisma.round.create({
        data: { groupId: group.id, scheduledAt: new Date(Date.now() + DAY_MS) },
      });
      await t.prisma.attendance.createMany({
        data: [admin, ref, outro].map((m) => ({
          roundId: next.id,
          membershipId: m.id,
          confirmed: true,
        })),
      });
      return { group, admin, ref, outro, next };
    }

    it('C18: lista de presença e escalação mostram a nota de referência e a posição por ela', async () => {
      const s = await referenceSetup();

      const detail = await get(
        `/api/groups/${s.group.id}/rounds/${s.next.id}`,
        s.admin.user.id,
      ).expect(200);
      const lineup = await get(
        `/api/groups/${s.group.id}/rounds/${s.next.id}/lineup`,
        s.admin.user.id,
      ).expect(200);

      expect(roundDetailSchema.safeParse(detail.body).success).toBe(true);
      expect(lineupSchema.safeParse(lineup.body).success).toBe(true);
      const pick = (list: { membershipId: string; rating: number; rank: number }[], id: string) =>
        list.find((m) => m.membershipId === id);
      // (8 + 9 + 3 × inicial 6) / 5 = 7,0: acima do Admin (6,5), abaixo do Outro (7,5). Pela inicial seria 3º.
      expect(pick(detail.body.attendance.confirmed, s.ref.id)).toMatchObject({
        rating: 7,
        rank: 2,
      });
      expect(pick(detail.body.attendance.confirmed, s.outro.id)).toMatchObject({
        rating: 7.5,
        rank: 1,
      });
      expect(pick(detail.body.attendance.confirmed, s.admin.id)).toMatchObject({
        rating: 6.5,
        rank: 3,
      });
      expect(pick(lineup.body.unassigned, s.ref.id)).toMatchObject({ rating: 7, rank: 2 });
      expect(pick(lineup.body.unassigned, s.outro.id)).toMatchObject({ rating: 7.5, rank: 1 });
    });

    it('C18: o escalado aparece com a nota de referência também nos times', async () => {
      const s = await referenceSetup();
      await t.prisma.teamPlayer.create({
        data: { roundId: s.next.id, membershipId: s.ref.id, team: 'WHITE', position: 'MIDFIELDER' },
      });

      const lineup = await get(
        `/api/groups/${s.group.id}/rounds/${s.next.id}/lineup`,
        s.admin.user.id,
      ).expect(200);

      expect(lineup.body.teams.WHITE.starters[0]).toMatchObject({
        membershipId: s.ref.id,
        rating: 7,
        rank: 2,
      });
    });

    it('C19: o seletor usa a nota de referência: dois craques só pela média recente caem em times diferentes', async () => {
      const group = await createGroup(t);
      const positions: Position[] = [
        'GOALKEEPER',
        'GOALKEEPER',
        ...Array<Position>(4).fill('DEFENDER'),
        ...Array<Position>(4).fill('WINGER'),
        ...Array<Position>(3).fill('MIDFIELDER'),
        ...Array<Position>(3).fill('FORWARD'),
      ];
      const members: Awaited<ReturnType<typeof makeMember>>[] = [];
      for (const [i, primaryPosition] of positions.entries()) {
        members.push(
          await makeMember(group.id, `J${i}`, {
            primaryPosition,
            initialRating: 6,
            role: i === 0 ? 'ADMIN' : 'PLAYER',
          }),
        );
      }
      // Dois alas com inicial 6 igual à dos outros, mas 9,5 nas 5 últimas rodadas (um em cada time)
      const [starA, starB] = [members[6]!, members[7]!];
      for (let i = 5; i >= 1; i -= 1) {
        await addRound(group.id, {
          daysAgo: i * 7,
          white: 1,
          black: 0,
          players: [
            { id: starA.id, team: 'WHITE', position: 'WINGER', score: 9.5 },
            { id: starB.id, team: 'BLACK', position: 'WINGER', score: 9.5 },
          ],
        });
      }
      const next = await t.prisma.round.create({
        data: { groupId: group.id, scheduledAt: new Date(Date.now() + DAY_MS) },
      });
      await t.prisma.attendance.createMany({
        data: members.map((m) => ({ roundId: next.id, membershipId: m.id, confirmed: true })),
      });
      const suggest = () =>
        request(server())
          .post(`/api/groups/${group.id}/rounds/${next.id}/lineup/suggestion`)
          .set('Cookie', as(members[0]!.user.id))
          .send({});
      const teamOf = (teams: SaveLineupInput, id: string) =>
        (['WHITE', 'BLACK'] as const).find((team) =>
          [...teams[team].starters.map((s) => s.membershipId), ...teams[team].reserves].includes(
            id,
          ),
        );

      // Com a nota inicial (todos 6) a divisão é sorteio e os dois ficariam juntos em ~metade das vezes
      for (let i = 0; i < 8; i += 1) {
        const res = await suggest().expect(200);
        expect(lineupSuggestionSchema.safeParse(res.body).success).toBe(true);
        expect(teamOf(res.body.teams, starA.id)).not.toBe(teamOf(res.body.teams, starB.id));
      }
    });

    it('C20: com 5 rodadas com nota, mudar a inicial não muda a nota; com 2, muda', async () => {
      const group = await createGroup(t);
      const admin = await makeMember(group.id, 'Admin', { role: 'ADMIN' });
      const veteran = await makeMember(group.id, 'Veterano', { initialRating: 6 });
      const rookie = await makeMember(group.id, 'Calouro', { initialRating: 6 });
      for (let i = 5; i >= 1; i -= 1) {
        await addRound(group.id, {
          daysAgo: i * 7,
          white: 1,
          black: 0,
          players: [
            { id: veteran.id, team: 'WHITE', score: 8 },
            // o calouro só tem nota nas 2 últimas
            { id: rookie.id, team: 'WHITE', score: i <= 2 ? 8 : null },
          ],
        });
      }
      const next = await t.prisma.round.create({
        data: { groupId: group.id, scheduledAt: new Date(Date.now() + DAY_MS) },
      });
      const ratings = async () => {
        const res = await get(`/api/groups/${group.id}/rounds/${next.id}`, admin.user.id).expect(
          200,
        );
        const all = [
          ...res.body.attendance.confirmed,
          ...res.body.attendance.declined,
          ...res.body.attendance.pending,
        ] as { membershipId: string; rating: number }[];
        return (id: string) => all.find((m) => m.membershipId === id)!.rating;
      };
      const before = await ratings();
      expect(before(veteran.id)).toBe(8);
      // (8 + 8 + 3 × 6) / 5
      expect(before(rookie.id)).toBe(6.8);

      for (const m of [veteran, rookie]) {
        await request(server())
          .patch(`/api/groups/${group.id}/members/${m.id}`)
          .set('Cookie', as(admin.user.id))
          .send({ initialRating: 9 })
          .expect(200);
      }

      const after = await ratings();
      expect(after(veteran.id)).toBe(8);
      // (8 + 8 + 3 × 9) / 5
      expect(after(rookie.id)).toBe(8.6);
    });

    it('C18: sem rodada encerrada a nota de referência é a inicial', async () => {
      const group = await createGroup(t);
      const admin = await makeMember(group.id, 'Admin', { role: 'ADMIN', initialRating: 7.5 });
      const next = await t.prisma.round.create({
        data: { groupId: group.id, scheduledAt: new Date(Date.now() + DAY_MS) },
      });

      const res = await get(`/api/groups/${group.id}/rounds/${next.id}`, admin.user.id).expect(200);

      expect(res.body.attendance.pending[0]).toMatchObject({ rating: 7.5, rank: 1 });
    });
  });
});
