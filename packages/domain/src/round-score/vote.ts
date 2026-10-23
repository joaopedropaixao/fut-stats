import { RATING_ERRORS, validateRating } from '../core';
import { validateAwardBallot, type AwardBallot, type BallotIssue } from './awards';
import { rateablePlayers, VOTE_ERRORS, validateVote } from './eligibility';

/** Uma nota dada pelo votante a um jogador. */
export interface RatingEntry {
  targetId: string;
  value: number;
}

/** Por que a folha de notas de um votante é inválida. Textos em `packages/shared`. */
export const RATING_SHEET_ERRORS = [
  ...VOTE_ERRORS,
  ...RATING_ERRORS,
  'MISSING_RATING',
  'DUPLICATE_TARGET',
] as const;

export type RatingSheetError = (typeof RATING_SHEET_ERRORS)[number];

/** Um problema na folha de notas: sobre qual jogador e o motivo. */
export interface RatingSheetIssue {
  targetId: string;
  code: RatingSheetError;
}

/**
 * Valida a folha de notas de um votante: quem vota dá nota a **todos** que jogaram, menos a si
 * mesmo, sem pular ninguém (`rateablePlayers`). Lista todos os problemas, na ordem da folha e
 * depois os que faltaram. Se o votante não jogou, devolve só esse.
 */
export function validateRatingSheet(
  voterId: string,
  ratings: readonly RatingEntry[],
  playedIds: readonly string[],
): RatingSheetIssue[] {
  if (!playedIds.includes(voterId)) return [{ targetId: voterId, code: 'VOTER_DID_NOT_PLAY' }];

  const issues: RatingSheetIssue[] = [];
  const rated = new Set<string>();
  for (const { targetId, value } of ratings) {
    if (rated.has(targetId)) {
      issues.push({ targetId, code: 'DUPLICATE_TARGET' });
      continue;
    }
    rated.add(targetId);
    const code = validateVote(voterId, targetId, playedIds) ?? validateRating(value);
    if (code) issues.push({ targetId, code });
  }
  for (const targetId of rateablePlayers(voterId, playedIds)) {
    if (!rated.has(targetId)) issues.push({ targetId, code: 'MISSING_RATING' });
  }
  return issues;
}

export function isValidRatingSheet(
  voterId: string,
  ratings: readonly RatingEntry[],
  playedIds: readonly string[],
): boolean {
  return validateRatingSheet(voterId, ratings, playedIds).length === 0;
}

/** O voto de um jogador na rodada é um pacote: notas de todos + Craque + Perna de Pau. */
export interface RoundVote extends AwardBallot {
  ratings: readonly RatingEntry[];
}

export interface RoundVoteIssues {
  ratings: RatingSheetIssue[];
  awards: BallotIssue[];
}

/**
 * Valida o pacote inteiro; problemas das notas e dos prêmios vêm separados. Se o votante não jogou,
 * o motivo vem uma vez só, nas notas.
 */
export function validateRoundVote(vote: RoundVote, playedIds: readonly string[]): RoundVoteIssues {
  if (!playedIds.includes(vote.voterId)) {
    return { ratings: [{ targetId: vote.voterId, code: 'VOTER_DID_NOT_PLAY' }], awards: [] };
  }
  return {
    ratings: validateRatingSheet(vote.voterId, vote.ratings, playedIds),
    awards: validateAwardBallot(vote, playedIds),
  };
}

export function isValidRoundVote(vote: RoundVote, playedIds: readonly string[]): boolean {
  const { ratings, awards } = validateRoundVote(vote, playedIds);
  return ratings.length === 0 && awards.length === 0;
}
