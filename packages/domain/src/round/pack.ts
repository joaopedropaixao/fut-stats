/** Um jogador da rodada fechada, só no que importa para o pacote: se foi Craque e a nota que fechou. */
export interface PackCandidate {
  isMvp: boolean;
  score: number | null;
}

/**
 * O resultado chega como pacote quando a rodada tem um Craque com nota. Rodada fechada sem votos não tem Craque, e o
 * resultado é só a tabela. Regra única: o aviso do Feed (API) e o pacote (web) usam esta função.
 */
export function roundHasPack(players: readonly PackCandidate[]): boolean {
  return players.some((player) => player.isMvp && player.score !== null);
}
