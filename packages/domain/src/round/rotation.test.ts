import { describe, expect, it } from 'vitest';
import type { RoundTeams } from './match';
import {
  DEFAULT_ROTATION_MINUTES,
  ROTATION_MINUTES_MAX,
  ROTATION_MINUTES_MIN,
  ROTATION_MINUTES_STEP,
  rotationPlan,
  rotationStatus,
  isValidRotationMinutes,
  validateRotationStart,
  validateRotationStop,
} from './rotation';

function team(prefix: string): RoundTeams['WHITE'] {
  const lineup: RoundTeams['WHITE'] = [
    { playerId: `${prefix}-gk`, position: 'GOALKEEPER' },
    { playerId: `${prefix}-d1`, position: 'DEFENDER' },
    { playerId: `${prefix}-d2`, position: 'DEFENDER' },
    { playerId: `${prefix}-w1`, position: 'WINGER' },
    { playerId: `${prefix}-w2`, position: 'WINGER' },
    { playerId: `${prefix}-m`, position: 'MIDFIELDER' },
    { playerId: `${prefix}-f`, position: 'FORWARD' },
  ];
  return lineup;
}

function makeTeams(whiteReserves: number, blackReserves = 0): RoundTeams {
  return {
    WHITE: team('w'),
    BLACK: [
      { playerId: 'b-gk', position: 'GOALKEEPER' },
      { playerId: 'b-d1', position: 'DEFENDER' },
      { playerId: 'b-d2', position: 'DEFENDER' },
      { playerId: 'b-w1', position: 'WINGER' },
      { playerId: 'b-w2', position: 'WINGER' },
      { playerId: 'b-m', position: 'MIDFIELDER' },
      { playerId: 'b-f', position: 'FORWARD' },
    ],
    reserves: {
      WHITE: Array.from({ length: whiteReserves }, (_, i) => `w-r${i + 1}`),
      BLACK: Array.from({ length: blackReserves }, (_, i) => `b-r${i + 1}`),
    },
  };
}

function sixOutfieldIds(prefix: string): string[] {
  return [
    `${prefix}-d1`,
    `${prefix}-d2`,
    `${prefix}-w1`,
    `${prefix}-w2`,
    `${prefix}-m`,
    `${prefix}-f`,
  ];
}

describe('rotationPlan', () => {
  it('C1: divides one reserve over seven equal turns and keeps goalkeepers out', () => {
    const plan = rotationPlan(makeTeams(1), { seed: 'round-1' });
    const turns = plan.WHITE.turns;

    expect(turns).toHaveLength(7);
    expect(turns.map(({ startMs, endMs }) => endMs - startMs)).toEqual([
      514_285, 514_286, 514_286, 514_285, 514_286, 514_286, 514_286,
    ]);
    expect(turns[0]?.out).toEqual(['w-r1']);
    expect(turns.flatMap(({ out }) => out).sort()).toEqual(['w-r1', ...sixOutfieldIds('w')].sort());
    expect(turns.flatMap(({ out }) => out)).not.toContain('w-gk');
    expect(turns.at(-1)?.endMs).toBe(3_600_000);
  });

  it('C2: rotates two reserves in four 15-minute turns', () => {
    const turns = rotationPlan(makeTeams(2), { seed: 'round-2' }).WHITE.turns;

    expect(turns).toHaveLength(4);
    expect(turns.map(({ endMs, startMs }) => endMs - startMs)).toEqual([
      900_000, 900_000, 900_000, 900_000,
    ]);
    expect(turns.every(({ out }) => out.length === 2)).toBe(true);
    expect(turns[0]?.out).toEqual(['w-r1', 'w-r2']);
    expect(turns.flatMap(({ out }) => out).sort()).toEqual(
      ['w-r1', 'w-r2', ...sixOutfieldIds('w')].sort(),
    );
  });

  it('C3: returns no turns for a team without reserves', () => {
    expect(rotationPlan(makeTeams(0), { seed: 'round-3' }).WHITE.turns).toEqual([]);
  });

  it('C4: creates an independent schedule for each team', () => {
    const plan = rotationPlan(makeTeams(2, 1), { seed: 'round-4' });
    expect(plan.WHITE.turns).toHaveLength(4);
    expect(plan.BLACK.turns).toHaveLength(7);
  });

  it('C5: keeps the schedule stable for a seed and varies it across round seeds', () => {
    const one = rotationPlan(makeTeams(1), { seed: 'round-5a' }).WHITE.turns;
    const repeated = rotationPlan(makeTeams(1), { seed: 'round-5a' }).WHITE.turns;
    const other = rotationPlan(makeTeams(1), { seed: 'round-5b' }).WHITE.turns;

    expect(repeated.map(({ out }) => out)).toEqual(one.map(({ out }) => out));
    expect(other.slice(1).map(({ out }) => out)).not.toEqual(one.slice(1).map(({ out }) => out));
  });

  it('C6: uses the selected duration for every turn and closes exactly at 45 minutes', () => {
    const turns = rotationPlan(makeTeams(1), { seed: 'round-6', durationMinutes: 45 }).WHITE.turns;
    expect(turns).toHaveLength(7);
    expect(turns[0]?.startMs).toBe(0);
    expect(turns.at(-1)?.endMs).toBe(45 * 60_000);
    expect(
      turns.every((turn, index) => index === 0 || turn.startMs === turns[index - 1]?.endMs),
    ).toBe(true);
  });
});

describe('rotationStatus', () => {
  it('C7: reports the active reserve and next exchange four minutes into the game', () => {
    const plan = rotationPlan(makeTeams(1), { seed: 'round-7' });
    const status = rotationStatus(plan, 60, 240_000);
    const nextTurn = plan.WHITE.turns[1];

    expect(status.teams.WHITE.out).toEqual(['w-r1']);
    expect(status.teams.WHITE.next?.inMs).toBe(274_285);
    expect(status.teams.WHITE.next?.inMs).toBe((nextTurn?.startMs ?? 0) - 240_000);
    expect(status.teams.WHITE.next?.enter).toEqual(['w-r1']);
    expect(status.teams.WHITE.next?.leave).toEqual(nextTurn?.out);
  });

  it('C8: treats the exact turn boundary as the next turn', () => {
    const plan = rotationPlan(makeTeams(1), { seed: 'round-8' });
    const boundary = plan.WHITE.turns[1]?.startMs ?? 0;
    const status = rotationStatus(plan, 60, boundary);
    expect(status.teams.WHITE.out).toEqual(plan.WHITE.turns[1]?.out);
  });

  it('C9: has no upcoming exchange during the last turn or after time expires', () => {
    const plan = rotationPlan(makeTeams(1), { seed: 'round-9' });
    const lastTurn = plan.WHITE.turns.at(-1);
    const duringLast = rotationStatus(plan, 60, (lastTurn?.startMs ?? 0) + 1);
    const afterEnd = rotationStatus(plan, 60, 3_600_001);

    expect(duringLast.teams.WHITE.next).toBeNull();
    expect(duringLast.remainingMs).toBe(3_600_000 - ((lastTurn?.startMs ?? 0) + 1));
    expect(afterEnd.finished).toBe(true);
    expect(afterEnd.remainingMs).toBe(0);
    expect(afterEnd.teams.WHITE.out).toEqual([]);
    expect(afterEnd.teams.WHITE.next).toBeNull();
  });

  it('C10: clamps a negative elapsed time to zero', () => {
    const plan = rotationPlan(makeTeams(1), { seed: 'round-10' });
    const status = rotationStatus(plan, 60, -1_000);
    expect(status.elapsedMs).toBe(0);
    expect(status.remainingMs).toBe(3_600_000);
    expect(status.teams.WHITE.out).toEqual(plan.WHITE.turns[0]?.out);
  });
});

describe('rotation validation', () => {
  it('C11: accepts an admin starting a 60-minute rotation during an in-progress round with reserves', () => {
    const round = {
      status: 'IN_PROGRESS',
      teams: makeTeams(1),
      confirmedIds: [],
      score: null,
      events: [],
    } as const;
    expect(validateRotationStart({ id: 'admin', isAdmin: true }, round, 60)).toEqual([]);
  });

  it('C12: returns only the first applicable error in the documented priority', () => {
    const baseRound = {
      status: 'IN_PROGRESS',
      teams: makeTeams(1),
      confirmedIds: [],
      score: null,
      events: [],
    } as const;

    expect(validateRotationStart({ id: 'player', isAdmin: false }, baseRound, 17)).toEqual([
      'NOT_ADMIN',
    ]);
    expect(
      validateRotationStart(
        { id: 'admin', isAdmin: true },
        { ...baseRound, status: 'TEAMS_PUBLISHED' },
        17,
      ),
    ).toEqual(['ROUND_NOT_IN_PROGRESS']);
    expect(
      validateRotationStart({ id: 'admin', isAdmin: true }, { ...baseRound, teams: null }, 17),
    ).toEqual(['NO_RESERVES']);
    expect(validateRotationStart({ id: 'admin', isAdmin: true }, baseRound, 17)).toEqual([
      'INVALID_DURATION',
    ]);
    expect(validateRotationStart({ id: 'admin', isAdmin: true }, baseRound, 125)).toEqual([
      'INVALID_DURATION',
    ]);
    expect(validateRotationStop({ id: 'player', isAdmin: false }, baseRound)).toEqual([
      'NOT_ADMIN',
    ]);
    expect(
      validateRotationStop({ id: 'admin', isAdmin: true }, { ...baseRound, status: 'POST_MATCH' }),
    ).toEqual(['ROUND_NOT_IN_PROGRESS']);
  });
});

describe('rotation duration', () => {
  it('C12: accepts only whole minutes from 20 through 120 in steps of five', () => {
    expect(DEFAULT_ROTATION_MINUTES).toBe(60);
    expect([ROTATION_MINUTES_MIN, ROTATION_MINUTES_MAX, ROTATION_MINUTES_STEP]).toEqual([
      20, 120, 5,
    ]);
    expect(isValidRotationMinutes(20)).toBe(true);
    expect(isValidRotationMinutes(120)).toBe(true);
    expect(isValidRotationMinutes(45)).toBe(true);
    for (const minutes of [17, 125, 22.5]) {
      expect(isValidRotationMinutes(minutes)).toBe(false);
    }
  });
});
