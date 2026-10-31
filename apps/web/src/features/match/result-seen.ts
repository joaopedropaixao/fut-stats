/**
 * "Já vi o card de resultado desta rodada": lembrado por rodada no navegador. Sem armazenamento (modo privado,
 * bloqueado, cheio), nada quebra: lê como "não vi" e o card toca de novo.
 */
const key = (roundId: string) => `fut-stats:resultado-visto:${roundId}`;

export function hasSeenResult(roundId: string, storage?: Pick<Storage, 'getItem'>): boolean {
  try {
    return (storage ?? window.localStorage).getItem(key(roundId)) === '1';
  } catch {
    return false;
  }
}

export function markResultSeen(roundId: string, storage?: Pick<Storage, 'setItem'>): void {
  try {
    (storage ?? window.localStorage).setItem(key(roundId), '1');
  } catch {
    // sem armazenamento: o card toca de novo na próxima vez
  }
}
