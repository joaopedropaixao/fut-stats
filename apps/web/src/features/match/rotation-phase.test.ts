import { describe, expect, it } from 'vitest';
import { clockOffset, rotationElapsedMs, rotationPhase, synchronizedNow } from './rotation-phase';

describe('rotationPhase (C31, C32, C37)', () => {
  it('shows PREPARE during the last 30 seconds before the next turn', () => {
    expect(
      rotationPhase({ finished: false, nextInMs: 30_000, turnIndex: 0, elapsedInTurnMs: 0 }),
    ).toBe('PREPARE');
  });

  it('shows CHANGE for ten seconds after a turn begins, except the first turn', () => {
    expect(
      rotationPhase({ finished: false, nextInMs: 500_000, turnIndex: 1, elapsedInTurnMs: 9_999 }),
    ).toBe('CHANGE');
    expect(
      rotationPhase({ finished: false, nextInMs: 500_000, turnIndex: 1, elapsedInTurnMs: 10_000 }),
    ).toBe('COUNTDOWN');
    expect(
      rotationPhase({ finished: false, nextInMs: 500_000, turnIndex: 0, elapsedInTurnMs: 0 }),
    ).toBe('COUNTDOWN');
  });

  it('returns FINISHED after the full rotation duration', () => {
    expect(
      rotationPhase({ finished: true, nextInMs: null, turnIndex: 6, elapsedInTurnMs: 0 }),
    ).toBe('FINISHED');
  });
});

describe('clock offset (C39)', () => {
  it('uses serverTime to compensate for a device clock that is two minutes ahead', () => {
    const localNow = Date.parse('2026-11-15T12:02:00.000Z');
    const offset = clockOffset('2026-11-15T12:00:00.000Z', localNow);
    expect(offset).toBe(-120_000);
    expect(synchronizedNow(localNow, offset)).toBe(Date.parse('2026-11-15T12:00:00.000Z'));
    expect(rotationElapsedMs('2026-11-15T11:56:00.000Z', synchronizedNow(localNow, offset))).toBe(
      240_000,
    );
  });

  it('ignores an invalid server timestamp and never returns negative elapsed time', () => {
    expect(clockOffset('invalid', 1000)).toBe(0);
    expect(rotationElapsedMs('2026-11-15T12:01:00Z', Date.parse('2026-11-15T12:00:00Z'))).toBe(0);
  });
});
