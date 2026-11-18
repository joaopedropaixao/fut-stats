/**
 * "Já vi o card de resultado desta rodada": lembrado por rodada e por jogador (membershipId) no navegador: o mesmo aparelho serve a mais de um jogador. Sem armazenamento (modo privado,
 * bloqueado, cheio), nada quebra: lê como "não vi" e o card toca de novo.
 */
const key = (roundId: string, membershipId: string) =>
  `fut-stats:resultado-visto:${roundId}:${membershipId}`;

export function hasSeenResult(
  roundId: string,
  membershipId: string,
  storage?: Pick<Storage, 'getItem'>,
): boolean {
  try {
    return (storage ?? window.localStorage).getItem(key(roundId, membershipId)) === '1';
  } catch {
    return false;
  }
}

export function markResultSeen(
  roundId: string,
  membershipId: string,
  storage?: Pick<Storage, 'setItem'>,
): void {
  try {
    (storage ?? window.localStorage).setItem(key(roundId, membershipId), '1');
  } catch {
    // sem armazenamento: o card toca de novo na próxima vez
  }
}
