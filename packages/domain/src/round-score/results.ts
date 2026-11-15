import type { Result } from '../core';
import {
  parseBallots,
  tallyAwards,
  type AwardBallot,
  type AwardTieBreak,
  type BallotError,
} from './awards';
import { parseRatings, roundScore, type RoundScoreOptions } from './round-score';
import type { RatingSheetError, RoundVote } from './vote';
import { validateRoundVote } from './vote';

/** Um problema num voto da rodada: de quem, em qual parte do pacote e o motivo. */
export type RoundVoteIssue =
  | { voterId: string; kind: 'RATING'; targetId: string; code: RatingSheetError }
  | { voterId: string; kind: 'AWARD'; field: keyof AwardBallot; code: BallotError };

/** Nota e quantidade de notas de um jogador, mais os prêmios da rodada. */
export interface RoundResults {
  /** Por jogador que jogou. `score: null` = ninguém deu nota (não é 0). */
  players: Record<string, { score: number | null; ratingsCount: number }>;
  /** Craque(s), em ordem alfabética. */
  mvpIds: string[];
  /** Perna(s) de Pau, em ordem alfabética. */
  flopIds: string[];
}

export interface RoundResultsOptions extends RoundScoreOptions {
  /** Desempate de Craque e Perna de Pau. Padrão: `ROUND_SCORE` (a maior/menor nota da rodada). */
  tieBreak?: AwardTieBreak;
}

/**
 * Apuração da rodada: valida todos os votos, calcula a nota de cada um que jogou (`roundScore` das notas
 * recebidas) e apura Craque e Perna de Pau (`tallyAwards`, desempate pela nota da rodada).
 * Se algum voto for inválido (ou o mesmo votante aparecer duas vezes), devolve todos os problemas e não calcula nada.
 * Sem votos, todos ficam sem nota e sem prêmio. Só compõe as regras que já existem; não lê relógio.
 */
export function roundResults(
  votes: readonly RoundVote[],
  playedIds: readonly string[],
  { tieBreak = 'ROUND_SCORE', ...scoreOptions }: RoundResultsOptions = {},
): Result<RoundResults, RoundVoteIssue> {
  const errors = collectIssues(votes, playedIds);
  if (errors.length > 0) return { ok: false, errors };

  const received = new Map<string, number[]>(playedIds.map((id) => [id, []]));
  for (const vote of votes) {
    for (const { targetId, value } of vote.ratings) received.get(targetId)?.push(value);
  }

  const players: RoundResults['players'] = {};
  const roundScores: Record<string, number | null> = {};
  for (const id of playedIds) {
    const ratings = parseRatings(received.get(id) ?? []);
    // Já validadas na folha de cada votante: um erro aqui é bug nosso, não do usuário.
    if (!ratings.ok) throw new Error(`Notas inválidas depois de validar o voto de ${id}.`);
    const score = roundScore(ratings.value, scoreOptions);
    players[id] = { score, ratingsCount: ratings.value.length };
    roundScores[id] = score;
  }

  const ballots = parseBallots(
    votes.map(({ voterId, mvpId, flopId }) => ({ voterId, mvpId, flopId })),
    playedIds,
  );
  if (!ballots.ok) throw new Error('Votos inválidos depois de validar o pacote.');

  const { mvpIds, flopIds } = tallyAwards(
    ballots.value,
    tieBreak === 'ROUND_SCORE' ? { tieBreak, roundScores } : { tieBreak },
  );
  return { ok: true, value: { players, mvpIds, flopIds } };
}

function collectIssues(
  votes: readonly RoundVote[],
  playedIds: readonly string[],
): RoundVoteIssue[] {
  const issues: RoundVoteIssue[] = [];
  const voters = new Set<string>();
  for (const vote of votes) {
    const { voterId } = vote;
    if (voters.has(voterId)) {
      issues.push({ voterId, kind: 'AWARD', field: 'voterId', code: 'DUPLICATE_VOTER' });
      continue;
    }
    voters.add(voterId);

    const { ratings, awards } = validateRoundVote(vote, playedIds);
    for (const { targetId, code } of ratings) {
      issues.push({ voterId, kind: 'RATING', targetId, code });
    }
    for (const { field, code } of awards) issues.push({ voterId, kind: 'AWARD', field, code });
  }
  return issues;
}
