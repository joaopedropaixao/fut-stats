import { canVoteFor } from './eligibility';

/** Voto de um jogador na rodada: um MVP (Craque) e uma Bola Murcha, ambos obrigatórios. */
export interface AwardBallot {
  voterId: string;
  mvpId: string;
  /** Bola Murcha. */
  flopId: string;
}

/**
 * Critério quando há empate em votos:
 * - `ROUND_SCORE`: MVP vai para a maior nota da rodada, Bola Murcha para a menor;
 *   se a nota também empatar, todos levam.
 * - `SHARE`: todos os empatados levam.
 * - `NONE`: ninguém leva.
 */
export type AwardTieBreak = 'ROUND_SCORE' | 'SHARE' | 'NONE';

export interface AwardOptions {
  tieBreak?: AwardTieBreak;
  /** Nota da rodada por jogador (ver `roundScore`). Obrigatório com `ROUND_SCORE`. */
  roundScores?: Readonly<Record<string, number | null>>;
}

export interface AwardResult {
  mvpIds: string[];
  /** Bola Murcha. */
  flopIds: string[];
}

/** True se o voto respeita a regra de voto e não aponta o mesmo jogador para MVP e Bola Murcha. */
export function isValidAwardBallot(ballot: AwardBallot, playedIds: readonly string[]): boolean {
  return (
    ballot.mvpId !== ballot.flopId &&
    canVoteFor(ballot.voterId, ballot.mvpId, playedIds) &&
    canVoteFor(ballot.voterId, ballot.flopId, playedIds)
  );
}

/** Apura MVP e Bola Murcha da rodada. Lança erro se houver voto inválido ou repetido. */
export function tallyAwards(
  ballots: readonly AwardBallot[],
  playedIds: readonly string[],
  { tieBreak = 'ROUND_SCORE', roundScores }: AwardOptions = {},
): AwardResult {
  if (tieBreak === 'ROUND_SCORE' && !roundScores) {
    throw new Error('O desempate ROUND_SCORE exige roundScores');
  }

  const voters = new Set<string>();
  for (const ballot of ballots) {
    if (voters.has(ballot.voterId)) {
      throw new Error(`Jogador ${ballot.voterId} votou mais de uma vez`);
    }
    if (!isValidAwardBallot(ballot, playedIds)) {
      throw new Error(`Voto inválido de ${ballot.voterId}`);
    }
    voters.add(ballot.voterId);
  }

  const pick = (ids: string[], best: 'HIGHEST' | 'LOWEST') =>
    resolveTie(mostVoted(ids), tieBreak, roundScores ?? {}, best);

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

function resolveTie(
  tied: string[],
  tieBreak: AwardTieBreak,
  roundScores: Readonly<Record<string, number | null>>,
  best: 'HIGHEST' | 'LOWEST',
): string[] {
  if (tied.length <= 1 || tieBreak === 'SHARE') return tied;
  if (tieBreak === 'NONE') return [];

  // Quem não tem nota da rodada perde o desempate; se ninguém tiver, todos levam.
  const scored = tied.filter((id) => typeof roundScores[id] === 'number');
  if (scored.length === 0) return tied;

  const scores = scored.map((id) => roundScores[id] as number);
  const target = best === 'HIGHEST' ? Math.max(...scores) : Math.min(...scores);
  return scored.filter((id) => roundScores[id] === target);
}
