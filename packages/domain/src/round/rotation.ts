import type { RoundTeams } from './match';
import type { RoundActor } from './events';
import type { RoundState } from './match';
import type { Team } from '../core';

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

/** Contract placeholder; rotation scheduling is implemented in the domain task. */
export function rotationPlan(
  _teams: RoundTeams,
  _options: { seed: string; durationMinutes?: number },
): RotationPlan {
  return { WHITE: { turns: [] }, BLACK: { turns: [] } };
}

/** Contract placeholder; rotation scheduling is implemented in the domain task. */
export function rotationStatus(
  _plan: RotationPlan,
  durationMinutes: number,
  elapsedMs: number,
): RotationStatus {
  const totalMs = durationMinutes * 60_000;
  const normalizedElapsed = Math.max(0, elapsedMs);
  return {
    elapsedMs: normalizedElapsed,
    remainingMs: Math.max(0, totalMs - normalizedElapsed),
    finished: normalizedElapsed >= totalMs,
    teams: {
      WHITE: { out: [], next: null },
      BLACK: { out: [], next: null },
    },
  };
}

/** Contract placeholder; validation is implemented in the domain task. */
export function validateRotationStart(
  _actor: RoundActor,
  _round: RoundState,
  _minutes: number,
): RotationError[] {
  return [];
}

/** Contract placeholder; validation is implemented in the domain task. */
export function validateRotationStop(_actor: RoundActor, _round: RoundState): RotationError[] {
  return [];
}
