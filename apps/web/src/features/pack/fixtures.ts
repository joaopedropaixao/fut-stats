import type { ResultPlayer, RoundResult } from '@fut-stats/shared';

/** Fixtures dos testes do pacote: um jogador com nota e o resultado de uma rodada. */
export function player(id: string, nickname: string, score: number | null, rank = 1): ResultPlayer {
  return {
    membershipId: id,
    nickname,
    avatar: { skin: 'LIGHT', hair: 'SHORT', hairColor: 'BROWN' },
    team: 'WHITE',
    position: 'MIDFIELDER',
    isReserve: false,
    score,
    ratingsCount: 5,
    rank,
    goals: 0,
    assists: 0,
    ownGoals: 0,
    isMvp: false,
    isFlop: false,
  };
}

export function result(
  parts: Partial<Pick<RoundResult, 'mvps' | 'flops' | 'players'>> & {
    me?: RoundResult['me'];
    voted?: number;
  },
): RoundResult {
  return {
    roundId: 'r1',
    number: 12,
    scheduledAt: '2026-11-08T12:00:00.000Z',
    score: { WHITE: 3, BLACK: 2 },
    winner: 'WHITE',
    closedAt: '2026-11-08T22:00:00.000Z',
    closeReason: 'ALL_VOTED',
    votes: { voted: parts.voted ?? 8, total: 10 },
    mvps: parts.mvps ?? [],
    flops: parts.flops ?? [],
    players: parts.players ?? [],
    me: parts.me ?? { membershipId: 'me', played: true },
  } as RoundResult;
}
