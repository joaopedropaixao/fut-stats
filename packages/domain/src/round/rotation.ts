import type { RoundActor } from './events';
import { seededRandom } from '../balance-teams/random';
import { TEAMS, type Team } from '../core';
import type { RoundState, RoundTeams } from './match';

export const DEFAULT_ROTATION_MINUTES = 60;
export const ROTATION_MINUTES_MIN = 20;
export const ROTATION_MINUTES_MAX = 120;
export const ROTATION_MINUTES_STEP = 5;

export function isValidRotationMinutes(minutes: number): boolean {
  return (
    Number.isInteger(minutes) &&
    minutes >= ROTATION_MINUTES_MIN &&
    minutes <= ROTATION_MINUTES_MAX &&
    (minutes - ROTATION_MINUTES_MIN) % ROTATION_MINUTES_STEP === 0
  );
}

export interface RotationTurn {
  index: number;
  startMs: number;
  endMs: number;
  out: string[];
}

export type RotationPlan = Record<Team, { turns: RotationTurn[] }>;

export interface RotationStatus {
  elapsedMs: number;
  remainingMs: number;
  finished: boolean;
  teams: Record<
    Team,
    { out: string[]; next: { inMs: number; enter: string[]; leave: string[] } | null }
  >;
}

export const ROTATION_ERRORS = [
  'NOT_ADMIN',
  'ROUND_NOT_IN_PROGRESS',
  'NO_RESERVES',
  'INVALID_DURATION',
] as const;

export type RotationError = (typeof ROTATION_ERRORS)[number];

export function rotationPlan(
  teams: RoundTeams,
  { seed, durationMinutes = DEFAULT_ROTATION_MINUTES }: { seed: string; durationMinutes?: number },
): RotationPlan {
  return Object.fromEntries(
    TEAMS.map((team) => {
      const reserveIds = [...teams.reserves[team]];
      if (reserveIds.length === 0) return [team, { turns: [] }];

      const fieldIds = teams[team]
        .filter((slot) => slot.position !== 'GOALKEEPER')
        .map((slot) => slot.playerId);
      const shuffled = shuffle(fieldIds, seededRandom(hashSeed(`${seed}:${team}`)));
      const groups: string[][] = [];
      for (let index = 0; index < shuffled.length; index += reserveIds.length) {
        groups.push(shuffled.slice(index, index + reserveIds.length));
      }

      const outs = [reserveIds, ...groups];
      const totalMs = durationMinutes * 60_000;
      const turns = outs.map((out, index) => ({
        index,
        startMs: Math.floor((index * totalMs) / outs.length),
        endMs: Math.floor(((index + 1) * totalMs) / outs.length),
        out,
      }));
      return [team, { turns }];
    }),
  ) as RotationPlan;
}

export function rotationStatus(
  plan: RotationPlan,
  durationMinutes: number,
  elapsedMs: number,
): RotationStatus {
  const totalMs = durationMinutes * 60_000;
  const normalizedElapsed = Math.max(0, elapsedMs);
  const finished = normalizedElapsed >= totalMs;
  return {
    elapsedMs: normalizedElapsed,
    remainingMs: Math.max(0, totalMs - normalizedElapsed),
    finished,
    teams: Object.fromEntries(
      TEAMS.map((team) => {
        const turns = plan[team].turns;
        if (finished || turns.length === 0) return [team, { out: [], next: null }];

        const turnIndex = turns.findIndex(
          ({ startMs, endMs }) => normalizedElapsed >= startMs && normalizedElapsed < endMs,
        );
        if (turnIndex < 0) return [team, { out: [], next: null }];

        const current = turns[turnIndex];
        const upcoming = turns[turnIndex + 1];
        return [
          team,
          {
            out: current?.out ?? [],
            next:
              current && upcoming
                ? {
                    inMs: current.endMs - normalizedElapsed,
                    enter: current.out,
                    leave: upcoming.out,
                  }
                : null,
          },
        ];
      }),
    ) as RotationStatus['teams'],
  };
}

export function validateRotationStart(
  actor: RoundActor,
  round: RoundState,
  minutes: number,
): RotationError[] {
  if (!actor.isAdmin) return ['NOT_ADMIN'];
  if (round.status !== 'IN_PROGRESS') return ['ROUND_NOT_IN_PROGRESS'];
  if (!round.teams || TEAMS.every((team) => round.teams?.reserves[team].length === 0)) {
    return ['NO_RESERVES'];
  }
  if (!isValidRotationMinutes(minutes)) return ['INVALID_DURATION'];
  return [];
}

export function validateRotationStop(actor: RoundActor, round: RoundState): RotationError[] {
  if (!actor.isAdmin) return ['NOT_ADMIN'];
  if (round.status !== 'IN_PROGRESS') return ['ROUND_NOT_IN_PROGRESS'];
  return [];
}

function hashSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!];
  }
  return shuffled;
}
