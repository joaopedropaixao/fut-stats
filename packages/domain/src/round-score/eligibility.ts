/** Por que um voto (nota, MVP ou Bola Murcha) não é permitido. Textos em `packages/shared`. */
export const VOTE_ERRORS = ['VOTER_DID_NOT_PLAY', 'TARGET_DID_NOT_PLAY', 'SELF_VOTE'] as const;

export type VoteError = (typeof VOTE_ERRORS)[number];

/**
 * Regra de voto: só quem jogou a rodada vota, só se vota em quem jogou (de qualquer time,
 * goleiros inclusos) e ninguém vota em si mesmo. Devolve o motivo do bloqueio, ou null se pode.
 */
export function validateVote(
  voterId: string,
  targetId: string,
  playedIds: readonly string[],
): VoteError | null {
  if (!playedIds.includes(voterId)) return 'VOTER_DID_NOT_PLAY';
  if (voterId === targetId) return 'SELF_VOTE';
  if (!playedIds.includes(targetId)) return 'TARGET_DID_NOT_PLAY';
  return null;
}

export function canVoteFor(
  voterId: string,
  targetId: string,
  playedIds: readonly string[],
): boolean {
  return validateVote(voterId, targetId, playedIds) === null;
}

/** Jogadores que o votante deve avaliar na rodada (vazio se ele não jogou). */
export function rateablePlayers(voterId: string, playedIds: readonly string[]): string[] {
  return playedIds.filter((id) => canVoteFor(voterId, id, playedIds));
}
