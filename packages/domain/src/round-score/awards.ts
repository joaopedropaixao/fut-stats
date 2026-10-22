import type { Result } from '../core';
import { VOTE_ERRORS, validateVote } from './eligibility';

/** Voto de um jogador na rodada: um MVP (Craque) e uma Bola Murcha, ambos obrigatórios. */
export interface AwardBallot {
  voterId: string;
  mvpId: string;
  /** Bola Murcha. */
  flopId: string;
}

/** Por que um voto de MVP/Bola Murcha é inválido. Textos em `packages/shared`. */
export const BALLOT_ERRORS = [...VOTE_ERRORS, 'SAME_PLAYER_BOTH', 'DUPLICATE_VOTER'] as const;

export type BallotError = (typeof BALLOT_ERRORS)[number];

/** Um problema num voto: de quem, em qual campo e o motivo. */
export interface BallotIssue {
  voterId: string;
  field: keyof AwardBallot;
  code: BallotError;
}

declare const validBallots: unique symbol;

/** Votos que já passaram por `parseBallots`. Só ela cria esse tipo. */
export type ValidBallots = readonly AwardBallot[] & { readonly [validBallots]: true };

/** Lista os problemas de um voto (vazia se ele for válido). */
export function validateAwardBallot(
  ballot: AwardBallot,
  playedIds: readonly string[],
): BallotIssue[] {
  const { voterId } = ballot;
  if (!playedIds.includes(voterId)) {
    return [{ voterId, field: 'voterId', code: 'VOTER_DID_NOT_PLAY' }];
  }

  const issues: BallotIssue[] = [];
  for (const field of ['mvpId', 'flopId'] as const) {
    const code = validateVote(voterId, ballot[field], playedIds);
    if (code) issues.push({ voterId, field, code });
  }
  if (ballot.mvpId === ballot.flopId) {
    issues.push({ voterId, field: 'flopId', code: 'SAME_PLAYER_BOTH' });
  }
  return issues;
}

export function isValidAwardBallot(ballot: AwardBallot, playedIds: readonly string[]): boolean {
  return validateAwardBallot(ballot, playedIds).length === 0;
}

/** Valida todos os votos da rodada, incluindo voto repetido; devolve todos os problemas. */
export function parseBallots(
  ballots: readonly AwardBallot[],
  playedIds: readonly string[],
): Result<ValidBallots, BallotIssue> {
  const errors: BallotIssue[] = [];
  const voters = new Set<string>();
  for (const ballot of ballots) {
    if (voters.has(ballot.voterId)) {
      errors.push({ voterId: ballot.voterId, field: 'voterId', code: 'DUPLICATE_VOTER' });
      continue;
    }
    voters.add(ballot.voterId);
    errors.push(...validateAwardBallot(ballot, playedIds));
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: ballots as ValidBallots };
}

/**
 * Critério quando há empate em votos:
 * - `ROUND_SCORE` (padrão): MVP vai para a maior nota da rodada, Bola Murcha para a menor;
 *   se a nota também empatar, todos levam. Exige `roundScores`.
 * - `SHARE`: todos os empatados levam.
 * - `NONE`: ninguém leva.
 */
export type AwardTieBreak = 'ROUND_SCORE' | 'SHARE' | 'NONE';

export type AwardOptions =
  | {
      tieBreak?: 'ROUND_SCORE';
      /** Nota da rodada por jogador (ver `roundScore`). */
      roundScores: Readonly<Record<string, number | null>>;
    }
  | { tieBreak: 'SHARE' | 'NONE'; roundScores?: never };

export interface AwardResult {
  mvpIds: string[];
  /** Bola Murcha. */
  flopIds: string[];
}

/** Apura MVP e Bola Murcha da rodada a partir de votos já validados. */
export function tallyAwards(ballots: ValidBallots, options: AwardOptions): AwardResult {
  const pick = (votes: string[], best: 'HIGHEST' | 'LOWEST') =>
    resolveTie(mostVoted(votes), options, best);

  return {
    mvpIds: pick(
      ballots.map((b) => b.mvpId),
      'HIGHEST',
    ),
    flopIds: pick(
      ballots.map((b) => b.flopId),
      'LOWEST',
    ),
  };
}

/** Jogadores com mais votos (vários em caso de empate), em ordem alfabética. */
function mostVoted(votes: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const id of votes) counts.set(id, (counts.get(id) ?? 0) + 1);

  const max = Math.max(0, ...counts.values());
  return [...counts]
    .filter(([, n]) => n === max)
    .map(([id]) => id)
    .sort();
}

function resolveTie(tied: string[], options: AwardOptions, best: 'HIGHEST' | 'LOWEST'): string[] {
  if (tied.length <= 1) return tied;
  if (options.tieBreak === 'SHARE' || options.tieBreak === 'NONE') {
    return options.tieBreak === 'SHARE' ? tied : [];
  }

  // Quem não tem nota da rodada perde o desempate; se ninguém tiver, todos levam.
  const roundScores = options.roundScores ?? {};
  const scored = tied.filter((id) => typeof roundScores[id] === 'number');
  if (scored.length === 0) return tied;

  const scores = scored.map((id) => roundScores[id] as number);
  const target = best === 'HIGHEST' ? Math.max(...scores) : Math.min(...scores);
  return scored.filter((id) => roundScores[id] === target);
}
