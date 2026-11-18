/** Um jogador com a nota que conta para o ranking. */
export interface RatedPlayer {
  id: string;
  rating: number;
}

/**
 * Posição de cada jogador no ranking pela nota (maior primeiro). Empate divide a posição e pula a
 * seguinte, como em tabela de campeonato (1, 2, 2, 4). Devolve `id → posição`, na ordem do ranking.
 * Até a Fase 3 a nota é a inicial (definida pelo admin); depois, a média da temporada.
 */
export function rankByRating(players: readonly RatedPlayer[]): Map<string, number> {
  const sorted = [...players].sort((a, b) => b.rating - a.rating);
  const ranks = new Map<string, number>();
  sorted.forEach((player, i) => {
    const previous = sorted[i - 1];
    const rank = previous && previous.rating === player.rating ? ranks.get(previous.id)! : i + 1;
    ranks.set(player.id, rank);
  });
  return ranks;
}
