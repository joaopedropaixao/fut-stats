import { describe, expect, it } from 'vitest';
import {
  isVotingOpen,
  shouldCloseVoting,
  votingCloseReason,
  votingDeadline,
  type VotingState,
} from './voting';

const openedAt = new Date('2026-10-22T22:00:00Z');
const hoursLater = (h: number) => new Date(openedAt.getTime() + h * 3_600_000);

const voting = (overrides: Partial<VotingState> = {}): VotingState => ({
  openedAt,
  deadlineHours: 48,
  playedIds: ['ana', 'bia', 'caio'],
  votedIds: [],
  ...overrides,
});

describe('votingDeadline', () => {
  it('soma o prazo em horas à abertura', () => {
    expect(votingDeadline(openedAt, 48)).toEqual(new Date('2026-10-24T22:00:00Z'));
  });

  it('não altera a data recebida', () => {
    const date = new Date(openedAt);
    votingDeadline(date, 48);
    expect(date).toEqual(openedAt);
  });
});

describe('votingCloseReason', () => {
  it('aberta: dentro do prazo e faltando votos', () => {
    expect(votingCloseReason(hoursLater(1), voting({ votedIds: ['ana'] }))).toBeNull();
  });

  it('fecha quando todos que jogaram votaram', () => {
    expect(votingCloseReason(hoursLater(1), voting({ votedIds: ['caio', 'ana', 'bia'] }))).toBe(
      'ALL_VOTED',
    );
  });

  it('voto de quem não jogou não conta', () => {
    expect(
      votingCloseReason(hoursLater(1), voting({ votedIds: ['ana', 'bia', 'intruso'] })),
    ).toBeNull();
  });

  it('voto repetido não conta duas vezes', () => {
    expect(
      votingCloseReason(hoursLater(1), voting({ votedIds: ['ana', 'ana', 'bia'] })),
    ).toBeNull();
  });

  it('fecha no prazo, mesmo sem nenhum voto (votar é opcional)', () => {
    expect(votingCloseReason(hoursLater(47.99), voting())).toBeNull();
    expect(votingCloseReason(hoursLater(48), voting())).toBe('DEADLINE_PASSED');
    expect(votingCloseReason(hoursLater(100), voting())).toBe('DEADLINE_PASSED');
  });

  it('todos votaram tem prioridade sobre o prazo', () => {
    expect(votingCloseReason(hoursLater(100), voting({ votedIds: ['ana', 'bia', 'caio'] }))).toBe(
      'ALL_VOTED',
    );
  });

  it('respeita o prazo do grupo', () => {
    expect(votingCloseReason(hoursLater(24), voting({ deadlineHours: 24 }))).toBe(
      'DEADLINE_PASSED',
    );
  });

  it('sem ninguém que jogou, não fecha por "todos votaram" (só pelo prazo)', () => {
    expect(votingCloseReason(hoursLater(1), voting({ playedIds: [] }))).toBeNull();
    expect(votingCloseReason(hoursLater(48), voting({ playedIds: [] }))).toBe('DEADLINE_PASSED');
  });

  it('relógio antes da abertura não fecha', () => {
    expect(votingCloseReason(hoursLater(-1), voting())).toBeNull();
  });
});

describe('shouldCloseVoting', () => {
  it('é a versão sim/não de votingCloseReason', () => {
    expect(shouldCloseVoting(hoursLater(1), voting())).toBe(false);
    expect(shouldCloseVoting(hoursLater(48), voting())).toBe(true);
  });
});

describe('isVotingOpen', () => {
  it('aberta: em VOTING, dentro do prazo e faltando votos (votar e editar)', () => {
    expect(isVotingOpen('VOTING', hoursLater(1), voting({ votedIds: ['ana'] }))).toBe(true);
  });

  it('fecha no prazo: não dá mais para votar nem editar', () => {
    expect(isVotingOpen('VOTING', hoursLater(48), voting({ votedIds: ['ana'] }))).toBe(false);
  });

  it('fecha quando todos votaram, mesmo antes do prazo', () => {
    expect(
      isVotingOpen('VOTING', hoursLater(1), voting({ votedIds: ['ana', 'bia', 'caio'] })),
    ).toBe(false);
  });

  it('fora de VOTING está fechada (antes de abrir ou depois do admin encerrar)', () => {
    for (const status of ['SCHEDULED', 'TEAMS_PUBLISHED', 'IN_PROGRESS', 'CLOSED'] as const) {
      expect(isVotingOpen(status, hoursLater(1), voting())).toBe(false);
    }
  });
});
