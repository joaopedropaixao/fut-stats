import type { RoundStatus } from './status';

const HOUR_MS = 60 * 60 * 1000;

/** O que a regra de fechamento precisa saber da votação. */
export interface VotingState {
  /** Quando a rodada entrou em `VOTING`. */
  openedAt: Date;
  /** Prazo do grupo (`Group.votingDeadlineHours`). */
  deadlineHours: number;
  /** Quem jogou (titulares e reservas): quem pode votar. */
  playedIds: readonly string[];
  /** Quem já votou. */
  votedIds: readonly string[];
}

/** Por que a votação fecha sozinha. */
export const VOTING_CLOSE_REASONS = ['ALL_VOTED', 'DEADLINE_PASSED'] as const;

export type VotingCloseReason = (typeof VOTING_CLOSE_REASONS)[number];

/** Momento em que o prazo da votação expira. */
export function votingDeadline(openedAt: Date, deadlineHours: number): Date {
  return new Date(openedAt.getTime() + deadlineHours * HOUR_MS);
}

/**
 * Diz se a votação deve fechar e por quê: todos que jogaram votaram (`ALL_VOTED`, tem prioridade)
 * ou o prazo expirou (`DEADLINE_PASSED`, a partir do instante exato do prazo). Null = segue aberta.
 * `now` vem de fora: o domínio não lê relógio. Votar é opcional, então o prazo fecha mesmo sem votos.
 */
export function votingCloseReason(now: Date, voting: VotingState): VotingCloseReason | null {
  const voted = new Set(voting.votedIds);
  if (voting.playedIds.every((id) => voted.has(id))) return 'ALL_VOTED';
  if (now.getTime() >= votingDeadline(voting.openedAt, voting.deadlineHours).getTime()) {
    return 'DEADLINE_PASSED';
  }
  return null;
}

export function shouldCloseVoting(now: Date, voting: VotingState): boolean {
  return votingCloseReason(now, voting) !== null;
}

/**
 * Dá para votar ou editar o voto (notas, Craque e Perna de Pau)? Só com a rodada em `VOTING` e a
 * votação ainda aberta: fechou (prazo, todos votaram ou o admin encerrou), não muda mais.
 */
export function isVotingOpen(status: RoundStatus, now: Date, voting: VotingState): boolean {
  return status === 'VOTING' && !shouldCloseVoting(now, voting);
}
