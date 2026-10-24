// Seed de desenvolvimento: monta o grupo do seed com histórico de rodadas e a rodada atual no estado
// pedido (cenário). Cada passo passa pelas regras do domínio; se algo sair inválido, o seed falha.
// Quem chama pela linha de comando é `prisma/seed.ts`.
import {
  balanceTeams,
  opponentOf,
  seededRandom,
  TEAMS,
  validateAttendanceChange,
  validateMatchEvent,
  validateRoundTransition,
  validateScoreEntry,
  type MatchEvent,
  type MatchScore,
  type PastRound,
  type Player,
  type Position,
  type RandomFn,
  type RoundActor,
  type RoundState,
  type RoundStatus,
  type RoundTeams,
  type Team,
} from '@fut-stats/domain';
import type { PrismaClient } from '../generated/prisma/client';
import type { Role } from '../generated/prisma/enums';
import {
  CURRENT_ROUND,
  IN_PROGRESS_GOALS,
  MEMBERS,
  PAST_ROUNDS,
  SEED_GROUP,
  SEED_LOCATION,
  SEED_RANDOM,
  type AttendancePlan,
  type PastRoundPlan,
} from './seed-data';

/** Estado da rodada atual: agendada (padrão), com times publicados ou em jogo. */
export const SEED_SCENARIOS = ['agendada', 'times', 'em-jogo'] as const;

export type SeedScenario = (typeof SEED_SCENARIOS)[number];

export const DEFAULT_SEED_SCENARIO: SeedScenario = 'agendada';

const SCENARIO_STATUS: Record<SeedScenario, RoundStatus> = {
  agendada: 'SCHEDULED',
  times: 'TEAMS_PUBLISHED',
  'em-jogo': 'IN_PROGRESS',
};

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
}

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
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
 * depois de amanhã. Em jogo: o último 20h que já passou (hoje ou ontem).
 * O dia da semana sai de `now`: nada aqui fixa um dia.
 */
export function currentRoundDate(scenario: SeedScenario, now: Date): Date {
  const date = new Date(now);
  date.setUTCHours(MATCH_HOUR_UTC, 0, 0, 0);
  if (scenario !== 'em-jogo') return new Date(date.getTime() + 2 * DAY_MS);
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
  for (const member of MEMBERS) {
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
            createdAt: round.createdAt,
            attendances: { create: round.attendances },
            teamPlayers: { create: teamPlayerRows(round.teams, members) },
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

  return {
    groupId: group.id,
    groupName: group.name,
    scenario,
    members: members.length,
    rounds: rounds.length,
  };
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
  const current = currentRoundDate(scenario, now);
  const history: PastRound[] = [];
  const rounds: PlannedRound[] = [];

  PAST_ROUNDS.forEach((plan, i) => {
    const scheduledAt = new Date(current.getTime() - (PAST_ROUNDS.length - i) * WEEK_MS);
    const round = planPastRound(plan, scheduledAt, members, history, random);
    if (round.teams) history.push(round.teams);
    rounds.push(round);
  });

  rounds.push(planCurrentRound(scenario, current, now, members, history, random));
  return rounds;
}

function planPastRound(
  plan: PastRoundPlan,
  scheduledAt: Date,
  members: readonly SeedMemberRow[],
  history: readonly PastRound[],
  random: RandomFn,
): PlannedRound {
  const label = `rodada de ${scheduledAt.toISOString()}`;
  const attendances = planAttendance(plan, members, label);
  const teams = pickTeams(attendances, members, history, random, label);

  let state = advance(
    { status: 'SCHEDULED', teams, score: null, events: [] },
    'TEAMS_PUBLISHED',
    label,
  );
  state = advance(state, 'IN_PROGRESS', label);

  const events = planEvents(plan.score, plan, teams, members, scheduledAt, random, label);
  state = { ...state, events };

  const admin = adminActor(members);
  check(validateScoreEntry(plan.score, admin, state), `${label}: placar`);
  state = { ...state, score: plan.score };
  state = advance(state, 'VOTING', label);
  state = advance(state, 'CLOSED', label);

  return {
    scheduledAt,
    createdAt: new Date(scheduledAt.getTime() - 5 * DAY_MS),
    status: state.status,
    attendances,
    teams,
    score: plan.score,
    events,
  };
}

function planCurrentRound(
  scenario: SeedScenario,
  scheduledAt: Date,
  now: Date,
  members: readonly SeedMemberRow[],
  history: readonly PastRound[],
  random: RandomFn,
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
  };
  const target = SCENARIO_STATUS[scenario];
  if (target === 'SCHEDULED') return round;

  const teams = pickTeams(attendances, members, history, random, label);
  let state = advance(
    { status: 'SCHEDULED', teams, score: null, events: [] },
    'TEAMS_PUBLISHED',
    label,
  );
  if (target === 'IN_PROGRESS') {
    state = advance(state, 'IN_PROGRESS', label);
    const events = planEvents(IN_PROGRESS_GOALS, {}, teams, members, scheduledAt, random, label);
    return { ...round, status: state.status, teams, events };
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
 * próprio jogador ou por um admin e passa por `validateMatchEvent` com a rodada em jogo.
 */
function planEvents(
  goals: MatchScore,
  { ownGoalsFor = {}, hatTrick = false }: Pick<PastRoundPlan, 'ownGoalsFor' | 'hatTrick'>,
  teams: RoundTeams,
  members: readonly SeedMemberRow[],
  scheduledAt: Date,
  random: RandomFn,
  label: string,
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
  const state: RoundState = { status: 'IN_PROGRESS', teams, score: null, events: [] };
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

function teamPlayerRows(teams: RoundTeams | null, members: readonly SeedMemberRow[]) {
  if (!teams) return [];
  return TEAMS.flatMap((team) => [
    ...teams[team].map((slot) => ({
      membershipId: slot.playerId,
      team,
      position: slot.position,
      isReserve: false,
    })),
    ...teams.reserves[team].map((id) => ({
      membershipId: id,
      team,
      position: reservePosition(id, members),
      isReserve: true,
    })),
  ]);
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
