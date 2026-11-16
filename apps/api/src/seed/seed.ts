// Seed de desenvolvimento: monta o grupo do seed com histórico de rodadas e a rodada atual no estado
// pedido (cenário). Cada passo passa pelas regras do domínio; se algo sair inválido, o seed falha.
// Quem chama pela linha de comando é `prisma/seed.ts`.
import {
  balanceTeams,
  opponentOf,
  roundPlayerIds,
  roundResults,
  seededRandom,
  TEAMS,
  validateAttendanceChange,
  validateCommentText,
  validateMatchEvent,
  validatePostInput,
  validateRoundTransition,
  validateScoreEntry,
  votingDeadline,
  type MatchEvent,
  type MatchScore,
  type PastRound,
  type Player,
  type Position,
  type RandomFn,
  type RatingEntry,
  type RoundActor,
  type RoundResults,
  type RoundState,
  type RoundStatus,
  type RoundTeams,
  type RoundVote,
  type Team,
  type VotingEndReason,
} from '@fut-stats/domain';
import { fromAvatar } from '../common/avatar';
import type { PrismaClient } from '../generated/prisma/client';
import type { Role } from '../generated/prisma/enums';
import {
  CURRENT_ROUND,
  DEV_WITHOUT_VOTE,
  RESENHA_GOALS,
  RESENHA_OWN_GOALS_FOR,
  RESENHA_SCORE,
  MEMBERS,
  seedAvatarFor,
  PAST_ROUNDS,
  SEED_GROUP,
  SEED_LOCATION,
  SEED_POSTS,
  SEED_RANDOM,
  type AttendancePlan,
  type PastRoundPlan,
} from './seed-data';

/**
 * Estado da rodada atual: agendada (padrão), com times publicados, em jogo, na Resenha pós-jogo, em votação
 * (parte dos votos enviados) ou encerrada (resultado gravado).
 */
export const SEED_SCENARIOS = [
  'agendada',
  'times',
  'em-jogo',
  'resenha',
  'votacao',
  'encerrada',
] as const;

export type SeedScenario = (typeof SEED_SCENARIOS)[number];

export const DEFAULT_SEED_SCENARIO: SeedScenario = 'agendada';

const SCENARIO_STATUS: Record<SeedScenario, RoundStatus> = {
  agendada: 'SCHEDULED',
  times: 'TEAMS_PUBLISHED',
  'em-jogo': 'IN_PROGRESS',
  resenha: 'POST_MATCH',
  votacao: 'VOTING',
  encerrada: 'CLOSED',
};

/** Cenários em que o jogo da rodada atual já aconteceu (o horário dela é o último 20h que passou). */
const PLAYED_SCENARIOS: ReadonlySet<SeedScenario> = new Set([
  'em-jogo',
  'resenha',
  'votacao',
  'encerrada',
]);

export interface SeedOptions {
  scenario?: SeedScenario;
  /** "Agora" do seed: as datas das rodadas saem dele. */
  now?: Date;
}

export interface SeedSummary {
  groupId: string;
  groupName: string;
  scenario: SeedScenario;
  members: number;
  rounds: number;
  posts: number;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
/** 20h em Brasília. */
const MATCH_HOUR_UTC = 23;

/** Lê `--cenario=<nome>` (ou `--cenario <nome>`) dos argumentos. Sem ele, `agendada`. */
export function parseSeedScenario(argv: readonly string[]): SeedScenario {
  let value: string | undefined;
  argv.forEach((arg, i) => {
    if (arg.startsWith('--cenario=')) value = arg.slice('--cenario='.length);
    else if (arg === '--cenario') value = argv[i + 1];
  });
  if (value === undefined) return DEFAULT_SEED_SCENARIO;
  if (!(SEED_SCENARIOS as readonly string[]).includes(value)) {
    throw new Error(`Cenário "${value}" não existe. Use um de: ${SEED_SCENARIOS.join(', ')}.`);
  }
  return value as SeedScenario;
}

/**
 * Data e hora da rodada atual; as passadas caem no mesmo dia da semana e horário, de 7 em 7 dias.
 * Sempre às 20h de Brasília (23h UTC; o Brasil não tem horário de verão). Agendada e com times:
 * depois de amanhã. Em jogo, na Resenha, em votação e encerrada: o último 20h que já passou (hoje ou ontem).
 * O dia da semana sai de `now`: nada aqui fixa um dia.
 */
export function currentRoundDate(scenario: SeedScenario, now: Date): Date {
  const date = new Date(now);
  date.setUTCHours(MATCH_HOUR_UTC, 0, 0, 0);
  if (!PLAYED_SCENARIOS.has(scenario)) {
    return new Date(date.getTime() + 2 * DAY_MS);
  }
  return date.getTime() <= now.getTime() ? date : new Date(date.getTime() - DAY_MS);
}

interface SeedMemberRow {
  id: string;
  nickname: string;
  role: Role;
  primaryPosition: Position;
  secondaryPositions: Position[];
  rating: number;
}

interface PlannedEvent extends MatchEvent {
  createdById: string;
  createdAt: Date;
}

interface PlannedRound {
  scheduledAt: Date;
  createdAt: Date;
  status: RoundStatus;
  attendances: { membershipId: string; confirmed: boolean }[];
  teams: RoundTeams | null;
  score: MatchScore | null;
  events: PlannedEvent[];
  /** Quando entrou em votação; nulo antes. */
  votingOpenedAt: Date | null;
  /** Os votos enviados (rodada em votação ou encerrada). */
  votes: PlannedVote[];
  /** Fechamento: quando e por quê; o resultado de cada um sai da apuração. Nulos até fechar. */
  closing: { at: Date; reason: VotingEndReason; results: RoundResults } | null;
}

/** O pacote de um votante, com a hora em que foi enviado. */
interface PlannedVote extends RoundVote {
  at: Date;
}

/** Monta o grupo, os membros e as rodadas do seed. Rodar de novo recria só as rodadas deste grupo. */
export async function seed(
  prisma: PrismaClient,
  { scenario = DEFAULT_SEED_SCENARIO, now = new Date() }: SeedOptions = {},
): Promise<SeedSummary> {
  const group = await prisma.group.upsert({
    where: { slug: SEED_GROUP.slug },
    update: {},
    create: { ...SEED_GROUP },
  });

  const members: SeedMemberRow[] = [];
  for (const [index, member] of MEMBERS.entries()) {
    const email = emailFor(member.nickname);
    const user = await prisma.user.upsert({
      where: { email },
      update: { name: member.name },
      create: { name: member.name, email, googleId: `seed-${email}` },
    });

    const data = {
      role: member.role ?? 'PLAYER',
      nickname: member.nickname,
      primaryPosition: member.primaryPosition,
      secondaryPositions: member.secondaryPositions,
      initialRating: member.initialRating,
      isHiredGoalkeeper: member.isHiredGoalkeeper ?? false,
      ...fromAvatar(seedAvatarFor(index)),
    };
    const membership = await prisma.membership.upsert({
      where: { userId_groupId: { userId: user.id, groupId: group.id } },
      update: data,
      create: { ...data, userId: user.id, groupId: group.id },
    });
    members.push({
      id: membership.id,
      nickname: membership.nickname,
      role: membership.role,
      primaryPosition: membership.primaryPosition,
      secondaryPositions: membership.secondaryPositions,
      rating: membership.initialRating,
    });
  }

  const rounds = planRounds(members, scenario, now);

  // O trigger numera na ordem de criação: apaga as rodadas do grupo e recria da mais antiga à atual.
  await prisma.$transaction(
    async (tx) => {
      await tx.round.deleteMany({ where: { groupId: group.id } });
      for (const round of rounds) {
        await tx.round.create({
          data: {
            groupId: group.id,
            scheduledAt: round.scheduledAt,
            location: SEED_LOCATION,
            status: round.status,
            whiteGoals: round.score?.WHITE ?? null,
            blackGoals: round.score?.BLACK ?? null,
            votingOpenedAt: round.votingOpenedAt,
            closedAt: round.closing?.at ?? null,
            votingEndReason: round.closing?.reason ?? null,
            createdAt: round.createdAt,
            attendances: { create: round.attendances },
            teamPlayers: {
              create: teamPlayerRows(round.teams, members, round.closing?.results ?? null),
            },
            votes: {
              create: round.votes.map((vote) => ({
                voterId: vote.voterId,
                mvpId: vote.mvpId,
                flopId: vote.flopId,
                createdAt: vote.at,
                updatedAt: vote.at,
                ratings: { create: vote.ratings.map((r) => ({ ...r })) },
              })),
            },
            matchEvents: {
              create: round.events.map((event) => ({
                membershipId: event.playerId,
                type: event.type,
                createdById: event.createdById,
                createdAt: event.createdAt,
              })),
            },
          },
        });
      }
    },
    { timeout: 60_000 },
  );

  const posts = await seedPosts(prisma, group.id, members, now);

  return {
    groupId: group.id,
    groupName: group.name,
    scenario,
    members: members.length,
    rounds: rounds.length,
    posts,
  };
}

/** Resenhas de exemplo do Feed, com reações e comentários. Recria só as do grupo do seed; devolve quantas criou. */
async function seedPosts(
  prisma: PrismaClient,
  groupId: string,
  members: readonly SeedMemberRow[],
  now: Date,
): Promise<number> {
  const idOf = (nickname: string): string => {
    const member = members.find((m) => m.nickname === nickname);
    if (!member) throw new Error(`Seed inválido: resenha com "${nickname}", que não é membro.`);
    return member.id;
  };

  const planned = SEED_POSTS.map((post) => {
    check(validatePostInput({ title: post.title, body: post.body }), `resenha de ${post.author}`);
    for (const comment of post.comments) {
      const error = validateCommentText(comment.text);
      check(error ? [error] : [], `comentário de ${comment.author}`);
    }
    if (!members.find((m) => m.nickname === post.author && m.role === 'ADMIN')) {
      throw new Error(`Seed inválido: ${post.author} precisa ser admin para escrever resenha.`);
    }
    const createdAt = new Date(now.getTime() - post.hoursAgo * HOUR_MS);
    return {
      data: {
        groupId,
        authorId: idOf(post.author),
        title: post.title,
        body: post.body,
        createdAt,
        reactions: {
          create: post.reactions.map(([nickname, reaction]) => ({
            membershipId: idOf(nickname),
            reaction,
            createdAt,
          })),
        },
        comments: {
          create: post.comments.map((comment) => ({
            membershipId: idOf(comment.author),
            text: comment.text,
            createdAt: new Date(createdAt.getTime() + comment.minutesLater * MINUTE_MS),
          })),
        },
      },
    };
  });

  await prisma.$transaction(async (tx) => {
    // Reações e comentários saem junto (cascata).
    await tx.post.deleteMany({ where: { groupId } });
    for (const { data } of planned) await tx.post.create({ data });
  });
  return planned.length;
}

function emailFor(nickname: string): string {
  const slug = nickname
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return `${slug}@example.com`;
}

/** Todas as rodadas, da mais antiga à atual, já validadas pelo domínio. */
function planRounds(
  members: readonly SeedMemberRow[],
  scenario: SeedScenario,
  now: Date,
): PlannedRound[] {
  const random = seededRandom(SEED_RANDOM);
  // Os votos têm o próprio sorteio: assim os times e os lances não mudam com a votação.
  const voteRandom = seededRandom(SEED_RANDOM + 1);
  const current = currentRoundDate(scenario, now);
  const history: PastRound[] = [];
  const rounds: PlannedRound[] = [];

  PAST_ROUNDS.forEach((plan, i) => {
    const scheduledAt = new Date(current.getTime() - (PAST_ROUNDS.length - i) * WEEK_MS);
    const round = planPastRound(plan, i, scheduledAt, members, history, random, voteRandom);
    if (round.teams) history.push({ ...round.teams, score: round.score });
    rounds.push(round);
  });

  rounds.push(planCurrentRound(scenario, current, now, members, history, random, voteRandom));
  return rounds;
}

function planPastRound(
  plan: PastRoundPlan,
  index: number,
  scheduledAt: Date,
  members: readonly SeedMemberRow[],
  history: readonly PastRound[],
  random: RandomFn,
  voteRandom: RandomFn,
): PlannedRound {
  const label = `rodada de ${scheduledAt.toISOString()}`;
  const attendances = planAttendance(plan, members, label);
  const teams = pickTeams(attendances, members, history, random, label);

  let state = advance(
    {
      status: 'SCHEDULED',
      teams,
      confirmedIds: confirmedIds(attendances),
      score: null,
      events: [],
    },
    'TEAMS_PUBLISHED',
    label,
  );
  state = advance(state, 'IN_PROGRESS', label);

  // O admin finaliza o jogo com o placar; na Resenha cada um lança os seus lances (ou o admin, por ele).
  const admin = adminActor(members);
  check(validateScoreEntry(plan.score, admin, state), `${label}: placar`);
  state = advance({ ...state, score: plan.score }, 'POST_MATCH', label);

  const events = planEvents(plan.score, plan, teams, members, scheduledAt, random, label, state);
  state = advance({ ...state, events }, 'VOTING', label);
  const votingOpenedAt = new Date(scheduledAt.getTime() + 3 * HOUR_MS);

  // Cada rodada passada fechou de um jeito: todo mundo votou, o prazo acabou ou o admin encerrou.
  const how = PAST_CLOSINGS[index % PAST_CLOSINGS.length]!;
  const deadline = votingDeadline(votingOpenedAt, SEED_GROUP_VOTING_HOURS);
  const closeAt =
    how.reason === 'ADMIN_CLOSED' ? new Date(votingOpenedAt.getTime() + 10 * HOUR_MS) : deadline;
  const votes = planVotes(
    teams,
    members,
    events,
    votingOpenedAt,
    closeAt,
    how.turnout,
    new Set(),
    voteRandom,
  );
  const lastVote = Math.max(...votes.map((v) => v.at.getTime()));
  const closing = closeRound(
    votes,
    teams,
    how.reason === 'ALL_VOTED' ? new Date(lastVote) : closeAt,
    how.reason,
    label,
  );
  state = advance(state, 'CLOSED', label);

  return {
    scheduledAt,
    createdAt: new Date(scheduledAt.getTime() - 5 * DAY_MS),
    status: state.status,
    attendances,
    teams,
    score: plan.score,
    events,
    votingOpenedAt,
    votes,
    closing,
  };
}

function planCurrentRound(
  scenario: SeedScenario,
  scheduledAt: Date,
  now: Date,
  members: readonly SeedMemberRow[],
  history: readonly PastRound[],
  random: RandomFn,
  voteRandom: RandomFn,
): PlannedRound {
  const label = `rodada atual (${scenario})`;
  const attendances = planAttendance(CURRENT_ROUND, members, label);
  const round: PlannedRound = {
    scheduledAt,
    createdAt: new Date(Math.min(scheduledAt.getTime() - 5 * DAY_MS, now.getTime())),
    status: 'SCHEDULED',
    attendances,
    teams: null,
    score: null,
    events: [],
    votingOpenedAt: null,
    votes: [],
    closing: null,
  };
  const target = SCENARIO_STATUS[scenario];
  if (target === 'SCHEDULED') return round;

  const teams = pickTeams(attendances, members, history, random, label);
  let state = advance(
    {
      status: 'SCHEDULED',
      teams,
      confirmedIds: confirmedIds(attendances),
      score: null,
      events: [],
    },
    'TEAMS_PUBLISHED',
    label,
  );
  if (target === 'IN_PROGRESS') {
    // Em jogo não há lance nem placar: o admin só finaliza com o placar, e os lances entram na Resenha.
    state = advance(state, 'IN_PROGRESS', label);
    return { ...round, status: state.status, teams };
  }
  if (target === 'POST_MATCH') {
    state = advance(state, 'IN_PROGRESS', label);
    check(validateScoreEntry(RESENHA_SCORE, adminActor(members), state), `${label}: placar`);
    state = advance({ ...state, score: RESENHA_SCORE }, 'POST_MATCH', label);
    // Faltam lances para os gols baterem com o placar: é o que a turma completa na Resenha.
    const events = planEvents(
      RESENHA_GOALS,
      { ownGoalsFor: RESENHA_OWN_GOALS_FOR },
      teams,
      members,
      scheduledAt,
      random,
      label,
      state,
    );
    return { ...round, status: state.status, teams, score: RESENHA_SCORE, events };
  }
  if (target === 'VOTING' || target === 'CLOSED') {
    // Votação e encerrada: os lances fecham o placar (para a votação abrir, gols = placar).
    state = advance(state, 'IN_PROGRESS', label);
    check(validateScoreEntry(RESENHA_SCORE, adminActor(members), state), `${label}: placar`);
    state = advance({ ...state, score: RESENHA_SCORE }, 'POST_MATCH', label);
    const events = planEvents(
      RESENHA_SCORE,
      { ownGoalsFor: RESENHA_OWN_GOALS_FOR },
      teams,
      members,
      scheduledAt,
      random,
      label,
      state,
    );
    state = advance({ ...state, events }, 'VOTING', label);
    const withGame = { ...round, teams, score: RESENHA_SCORE, events };

    if (target === 'VOTING') {
      // Aberta há pouco, com parte dos votos e as pessoas de dev (os admins) ainda sem votar.
      const openedAt = new Date(now.getTime() - 30 * MINUTE_MS);
      const votes = planVotes(
        teams,
        members,
        events,
        openedAt,
        now,
        0.55,
        DEV_WITHOUT_VOTE,
        voteRandom,
      );
      return { ...withGame, status: state.status, votingOpenedAt: openedAt, votes };
    }

    // Encerrada hoje: abriu depois do jogo, todo mundo (ou quase) votou e a votação acabou de fechar.
    const closeAt = new Date(now.getTime() - MINUTE_MS);
    const openedAt = new Date(
      Math.min(scheduledAt.getTime() + 3 * HOUR_MS, closeAt.getTime() - MINUTE_MS),
    );
    const votes = planVotes(teams, members, events, openedAt, closeAt, 0.8, new Set(), voteRandom);
    const closing = closeRound(votes, teams, closeAt, 'ADMIN_CLOSED', label);
    state = advance(state, 'CLOSED', label);
    return { ...withGame, status: state.status, votingOpenedAt: openedAt, votes, closing };
  }
  return { ...round, status: state.status, teams };
}

/** Presença pelo plano: recusou, não respondeu ou (o resto) confirmou. Cada um marca a sua. */
function planAttendance(
  plan: AttendancePlan,
  members: readonly SeedMemberRow[],
  label: string,
): PlannedRound['attendances'] {
  const known = new Set(members.map((m) => m.nickname));
  for (const nickname of [...plan.declined, ...plan.noAnswer]) {
    if (!known.has(nickname))
      throw new Error(`Seed inválido (${label}): "${nickname}" não é membro.`);
  }

  const attendances: PlannedRound['attendances'] = [];
  for (const member of members) {
    if (plan.noAnswer.includes(member.nickname)) continue;
    const self: RoundActor = { id: member.id, isAdmin: member.role === 'ADMIN' };
    check(validateAttendanceChange(member.id, self, 'SCHEDULED'), `${label}: presença`);
    attendances.push({
      membershipId: member.id,
      confirmed: !plan.declined.includes(member.nickname),
    });
  }
  return attendances;
}

function confirmedIds(attendances: PlannedRound['attendances']): string[] {
  return attendances.filter((a) => a.confirmed).map((a) => a.membershipId);
}

/** Times pelo seletor do domínio, a partir dos confirmados e do histórico. */
function pickTeams(
  attendances: PlannedRound['attendances'],
  members: readonly SeedMemberRow[],
  history: readonly PastRound[],
  random: RandomFn,
  label: string,
): RoundTeams {
  const confirmed = new Set(attendances.filter((a) => a.confirmed).map((a) => a.membershipId));
  const players: Player[] = members
    .filter((m) => confirmed.has(m.id))
    .map((m) => ({
      id: m.id,
      primaryPosition: m.primaryPosition,
      secondaryPositions: m.secondaryPositions,
      rating: m.rating,
    }));
  const result = balanceTeams(players, history, { random });
  if (!result.ok) throw new Error(`Seed inválido (${label}): times — ${result.error}`);
  return result.round;
}

const GOAL_WEIGHT: Record<Position, number> = {
  GOALKEEPER: 0,
  DEFENDER: 1,
  WINGER: 3,
  MIDFIELDER: 3,
  FORWARD: 6,
};

const ASSIST_WEIGHT: Record<Position, number> = {
  GOALKEEPER: 0,
  DEFENDER: 1,
  WINGER: 4,
  MIDFIELDER: 5,
  FORWARD: 2,
};

const OWN_GOAL_WEIGHT: Record<Position, number> = {
  GOALKEEPER: 0,
  DEFENDER: 4,
  WINGER: 2,
  MIDFIELDER: 2,
  FORWARD: 1,
};

const ASSIST_CHANCE = 0.65;
const SELF_LOGGED_CHANCE = 0.5;

/**
 * Lances que somam `goals` por time: gols de quem é do time (mais para atacante), gols contra de
 * quem é do outro e assistências de um companheiro em parte dos gols. Cada lance é lançado pelo
 * próprio jogador (na Resenha) ou por um admin e passa por `validateMatchEvent` com a rodada no status de `base`.
 */
function planEvents(
  goals: MatchScore,
  { ownGoalsFor = {}, hatTrick = false }: Pick<PastRoundPlan, 'ownGoalsFor' | 'hatTrick'>,
  teams: RoundTeams,
  members: readonly SeedMemberRow[],
  scheduledAt: Date,
  random: RandomFn,
  label: string,
  base: RoundState,
): PlannedEvent[] {
  const lineOf = (team: Team) => linePlayers(team, teams, members);
  const topTeam: Team = goals.WHITE >= goals.BLACK ? 'WHITE' : 'BLACK';
  const blocks: MatchEvent[][] = [];

  for (const team of TEAMS) {
    const ownGoals = ownGoalsFor[team] ?? 0;
    const regular = goals[team] - ownGoals;
    if (regular < 0) throw new Error(`Seed inválido (${label}): mais gols contra que gols.`);

    const line = lineOf(team);
    const scorers: string[] = [];
    if (hatTrick && team === topTeam) {
      if (regular < 3) throw new Error(`Seed inválido (${label}): hat-trick sem 3 gols.`);
      const hero = weightedPick(line, GOAL_WEIGHT, random);
      scorers.push(hero.id, hero.id, hero.id);
      const others = line.filter((p) => p.id !== hero.id);
      while (scorers.length < regular) scorers.push(weightedPick(others, GOAL_WEIGHT, random).id);
    } else {
      while (scorers.length < regular) scorers.push(weightedPick(line, GOAL_WEIGHT, random).id);
    }

    for (const scorer of scorers) {
      const block: MatchEvent[] = [{ playerId: scorer, type: 'GOAL' }];
      if (random() < ASSIST_CHANCE) {
        const mates = line.filter((p) => p.id !== scorer);
        block.push({ playerId: weightedPick(mates, ASSIST_WEIGHT, random).id, type: 'ASSIST' });
      }
      blocks.push(block);
    }

    const opponents = lineOf(opponentOf(team));
    for (let i = 0; i < ownGoals; i++) {
      blocks.push([
        { playerId: weightedPick(opponents, OWN_GOAL_WEIGHT, random).id, type: 'OWN_GOAL' },
      ]);
    }
  }

  // Embaralha os lances (Fisher-Yates) para os dois times se alternarem ao longo do jogo
  for (let i = blocks.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [blocks[i], blocks[j]] = [blocks[j]!, blocks[i]!];
  }

  const admins = members.filter((m) => m.role === 'ADMIN');
  const state: RoundState = { ...base, events: [] };
  const events: PlannedEvent[] = [];
  blocks.flat().forEach((event, i) => {
    const byAdmin = random() >= SELF_LOGGED_CHANCE;
    const creator = byAdmin
      ? admins[Math.floor(random() * admins.length)]!
      : members.find((m) => m.id === event.playerId)!;
    const actor: RoundActor = { id: creator.id, isAdmin: creator.role === 'ADMIN' };
    check(validateMatchEvent(event, actor, { ...state, events }), `${label}: lance`);
    events.push({
      ...event,
      createdById: creator.id,
      createdAt: new Date(scheduledAt.getTime() + (i + 1) * 4 * MINUTE_MS),
    });
  });
  return events;
}

interface LinePlayer {
  id: string;
  position: Position;
}

/** Jogadores de linha do time (titulares e reservas), com a posição em que jogaram. */
function linePlayers(
  team: Team,
  teams: RoundTeams,
  members: readonly SeedMemberRow[],
): LinePlayer[] {
  const starters = teams[team]
    .filter((slot) => slot.position !== 'GOALKEEPER')
    .map((slot) => ({ id: slot.playerId, position: slot.position }));
  const reserves = teams.reserves[team].map((id) => ({
    id,
    position: reservePosition(id, members),
  }));
  return [...starters, ...reserves];
}

/** Reserva não tem posição fixa no domínio; no banco vai a posição principal dele. */
function reservePosition(id: string, members: readonly SeedMemberRow[]): Position {
  const member = members.find((m) => m.id === id);
  if (!member) throw new Error(`Seed inválido: reserva ${id} não é membro.`);
  return member.primaryPosition;
}

function weightedPick<T extends { position: Position }>(
  candidates: readonly T[],
  weights: Record<Position, number>,
  random: RandomFn,
): T {
  const total = candidates.reduce((sum, c) => sum + weights[c.position], 0);
  if (total <= 0) throw new Error('Seed inválido: ninguém para fazer o lance.');
  let roll = random() * total;
  for (const candidate of candidates) {
    roll -= weights[candidate.position];
    if (roll < 0) return candidate;
  }
  return candidates[candidates.length - 1]!;
}

function teamPlayerRows(
  teams: RoundTeams | null,
  members: readonly SeedMemberRow[],
  results: RoundResults | null,
) {
  if (!teams) return [];
  // O resultado só existe depois de fechar a votação; antes, os padrões do banco (sem nota, sem prêmio).
  const outcome = (id: string) =>
    results
      ? {
          roundScore: results.players[id]!.score,
          ratingsCount: results.players[id]!.ratingsCount,
          isMvp: results.mvpIds.includes(id),
          isFlop: results.flopIds.includes(id),
        }
      : {};
  return TEAMS.flatMap((team) => [
    ...teams[team].map((slot) => ({
      membershipId: slot.playerId,
      team,
      position: slot.position,
      isReserve: false,
      ...outcome(slot.playerId),
    })),
    ...teams.reserves[team].map((id) => ({
      membershipId: id,
      team,
      position: reservePosition(id, members),
      isReserve: true,
      ...outcome(id),
    })),
  ]);
}

/** Prazo da votação do grupo do seed: o padrão do banco (`Group.votingDeadlineHours`). */
const SEED_GROUP_VOTING_HOURS = 24;

/** Como as rodadas passadas fecharam, em rodízio: todo mundo votou, o prazo acabou e o admin encerrou. */
const PAST_CLOSINGS: readonly { reason: VotingEndReason; turnout: number }[] = [
  { reason: 'ALL_VOTED', turnout: 1 },
  { reason: 'DEADLINE_PASSED', turnout: 0.75 },
  { reason: 'ADMIN_CLOSED', turnout: 0.6 },
];

const MIN_RATING = 0;
const MAX_RATING = 10;

/**
 * Votos de uma rodada: `turnout` (0 a 1) de quem jogou manda o pacote (quem está em `abstain` não manda), entre
 * `openedAt` e `until`. A nota que cada um dá sai da nota inicial do jogador, do que ele fez na partida (gols e assistências
 * sobem, gol contra desce) e de um tanto de sorte, em passos de 0,5. O Craque vem entre as 3 maiores notas que o
 * votante deu e o Perna de Pau entre as 3 menores. Tudo passa pelo domínio (`roundResults` valida o pacote).
 */
function planVotes(
  teams: RoundTeams,
  members: readonly SeedMemberRow[],
  events: readonly MatchEvent[],
  openedAt: Date,
  until: Date,
  turnout: number,
  abstain: ReadonlySet<string>,
  random: RandomFn,
): PlannedVote[] {
  const playedIds = roundPlayerIds(teams);
  const nicknameOf = (id: string) => members.find((m) => m.id === id)!.nickname;
  const skill = new Map<string, number>(
    playedIds.map((id) => {
      const mine = events.filter((e) => e.playerId === id);
      const count = (type: MatchEvent['type']) => mine.filter((e) => e.type === type).length;
      return [
        id,
        members.find((m) => m.id === id)!.rating +
          0.8 * count('GOAL') +
          0.4 * count('ASSIST') -
          1 * count('OWN_GOAL'),
      ];
    }),
  );

  const eligible = playedIds.filter((id) => !abstain.has(nicknameOf(id)));
  // Embaralha (Fisher-Yates) e pega a fatia que votou
  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const voters = shuffled.slice(0, Math.max(1, Math.round(playedIds.length * turnout)));
  const span = Math.max(0, until.getTime() - openedAt.getTime());

  return voters.map((voterId) => {
    const ratings: RatingEntry[] = playedIds
      .filter((id) => id !== voterId)
      .map((targetId) => {
        const raw = skill.get(targetId)! + (random() - 0.5) * 3;
        const value = Math.min(MAX_RATING, Math.max(MIN_RATING, Math.round(raw * 2) / 2));
        return { targetId, value };
      });
    const byValue = [...ratings].sort((a, b) => b.value - a.value);
    const mvpId = byValue[Math.floor(random() * 3)]!.targetId;
    const flopPool = byValue.slice(-3).filter((r) => r.targetId !== mvpId);
    const flopId = flopPool[Math.floor(random() * flopPool.length)]!.targetId;
    // Entre 5% e 95% do tempo aberto: nunca antes de abrir nem na hora exata do fechamento
    const at = new Date(openedAt.getTime() + span * (0.05 + 0.9 * random()));
    return { voterId, mvpId, flopId, ratings, at };
  });
}

/** Fecha a votação do seed: apura pelo domínio (voto inválido derruba o seed) e devolve quando, por quê e o resultado. */
function closeRound(
  votes: readonly PlannedVote[],
  teams: RoundTeams,
  at: Date,
  reason: VotingEndReason,
  label: string,
): NonNullable<PlannedRound['closing']> {
  const result = roundResults(votes, roundPlayerIds(teams));
  if (!result.ok) {
    throw new Error(
      `Seed inválido (${label}): votos — ${JSON.stringify(result.errors.slice(0, 3))}`,
    );
  }
  return { at, reason, results: result.value };
}

function adminActor(members: readonly SeedMemberRow[]): RoundActor {
  const admin = members.find((m) => m.role === 'ADMIN');
  if (!admin) throw new Error('Seed inválido: o grupo precisa de um admin.');
  return { id: admin.id, isAdmin: true };
}

function advance(state: RoundState, to: RoundStatus, label: string): RoundState {
  check(validateRoundTransition(state, to), `${label}: ${state.status} → ${to}`);
  return { ...state, status: to };
}

function check(errors: readonly string[], context: string): void {
  if (errors.length > 0) throw new Error(`Seed inválido (${context}): ${errors.join(', ')}`);
}
