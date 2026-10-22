/**
 * Regra de voto (notas, MVP e Bola Murcha): só quem jogou a rodada vota,
 * só se vota em quem jogou (de qualquer time, goleiros inclusos) e ninguém vota em si mesmo.
 */
export function canVoteFor(
  voterId: string,
  targetId: string,
  playedIds: readonly string[],
): boolean {
  return voterId !== targetId && playedIds.includes(voterId) && playedIds.includes(targetId);
}

/** Jogadores que o votante deve avaliar na rodada (vazio se ele não jogou). */
export function rateablePlayers(voterId: string, playedIds: readonly string[]): string[] {
  return playedIds.filter((id) => canVoteFor(voterId, id, playedIds));
}
