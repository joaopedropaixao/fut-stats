/**
 * "Já vi a animação do ranking nesta rodada": lembrado por jogador (membershipId) e pelo número de rodadas encerradas
 * do grupo, no navegador (o mesmo aparelho serve a mais de um jogador). Rodada nova = chave nova = a animação toca de
 * novo. Sem armazenamento (modo privado, bloqueado, cheio), nada quebra: lê como "não vi" e toca de novo.
 */
const key = (membershipId: string, closedRounds: number) =>
  `fut-stats:ranking-visto:${membershipId}:${closedRounds}`;

export function hasSeenRanking(
  membershipId: string,
  closedRounds: number,
  storage?: Pick<Storage, 'getItem'>,
): boolean {
  try {
    return (storage ?? window.localStorage).getItem(key(membershipId, closedRounds)) === '1';
  } catch {
    return false;
  }
}

export function markRankingSeen(
  membershipId: string,
  closedRounds: number,
  storage?: Pick<Storage, 'setItem'>,
): void {
  try {
    (storage ?? window.localStorage).setItem(key(membershipId, closedRounds), '1');
  } catch {
    // sem armazenamento: a animação toca de novo na próxima vez
  }
}
