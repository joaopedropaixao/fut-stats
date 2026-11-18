import type { MatchEventItem } from '@fut-stats/shared';
import { describe, expect, it } from 'vitest';
import { craqueMoves } from './craque-moves';

const event = (id: string, membershipId: string, type: MatchEventItem['type']): MatchEventItem => ({
  id,
  type,
  membershipId,
  nickname: 'x',
  photoUrl: null,
  avatar: { skin: 'LIGHT', hair: 'SHORT', hairColor: 'BROWN' },
  playerTeam: 'WHITE',
  team: 'WHITE',
  createdByNickname: 'y',
  createdAt: '2026-11-08T12:00:00.000Z',
  canRemove: false,
});

describe('lances do Craque', () => {
  it('V2: só os dele, gols e assistências, na ordem em que vieram', () => {
    const events = [
      event('1', 'a', 'GOAL'),
      event('2', 'b', 'GOAL'),
      event('3', 'a', 'ASSIST'),
      event('4', 'a', 'GOAL'),
    ];
    expect(craqueMoves(events, 'a').map((e) => e.id)).toEqual(['1', '3', '4']);
  });

  it('V2: gol contra não é lance do Craque', () => {
    expect(craqueMoves([event('1', 'a', 'OWN_GOAL')], 'a')).toEqual([]);
  });

  it('V2: sem lances, lista vazia', () => {
    expect(craqueMoves([], 'a')).toEqual([]);
  });
});
