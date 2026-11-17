import { LIVE_ROUND_STATUSES, roundStatusSchema, type RoundList } from '@fut-stats/shared';
import { describe, expect, it } from 'vitest';
import { pickLiveRoundIds } from './pick-live-rounds';

type Status = RoundList['upcoming'][number]['status'];

const round = (id: string, status: Status) => ({
  id,
  number: 1,
  scheduledAt: '2026-11-17T20:00:00.000Z',
  location: null,
  status,
  confirmedCount: 0,
});

const list = (over: Partial<RoundList>): RoundList => ({
  upcoming: [],
  past: [],
  currentId: null,
  suggestion: null,
  votingId: null,
  lastResult: null,
  ...over,
});

describe('pickLiveRoundIds: quais rodadas abrem o canal', () => {
  it('sem lista ainda ou sem rodada: nenhuma conexão', () => {
    expect(pickLiveRoundIds(undefined)).toEqual([]);
    expect(pickLiveRoundIds(list({}))).toEqual([]);
  });

  it('a rodada da vez, em qualquer etapa ao vivo', () => {
    for (const status of LIVE_ROUND_STATUSES) {
      expect(pickLiveRoundIds(list({ upcoming: [round('a', status)], currentId: 'a' }))).toEqual([
        'a',
      ]);
    }
  });

  it('rodada agendada ou encerrada não abre conexão', () => {
    const other = roundStatusSchema.options.filter(
      (s) => !LIVE_ROUND_STATUSES.some((l) => l === s),
    );
    expect(other.length).toBeGreaterThan(0);
    for (const status of other) {
      expect(pickLiveRoundIds(list({ upcoming: [round('a', status)], currentId: 'a' }))).toEqual(
        [],
      );
    }
  });

  it('a da vez e a em votação: duas conexões, nessa ordem', () => {
    const result = pickLiveRoundIds(
      list({
        upcoming: [round('a', 'TEAMS_PUBLISHED')],
        past: [round('b', 'VOTING')],
        currentId: 'a',
        votingId: 'b',
      }),
    );
    expect(result).toEqual(['a', 'b']);
  });

  it('a mesma rodada da vez e em votação conta uma vez', () => {
    expect(
      pickLiveRoundIds(list({ past: [round('a', 'VOTING')], currentId: 'a', votingId: 'a' })),
    ).toEqual(['a']);
  });

  it('id que não está na lista é ignorado', () => {
    expect(pickLiveRoundIds(list({ currentId: 'fantasma' }))).toEqual([]);
  });

  it('a lista de estados ao vivo é a do contrato (sem cópia local)', () => {
    expect([...LIVE_ROUND_STATUSES]).toEqual([
      'TEAMS_PUBLISHED',
      'IN_PROGRESS',
      'POST_MATCH',
      'VOTING',
    ]);
  });
});
