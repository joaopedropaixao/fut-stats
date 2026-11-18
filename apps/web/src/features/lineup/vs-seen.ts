/**
 * "Já vi o VS desta rodada": lembrado por rodada no navegador. Sem armazenamento (modo privado, bloqueado,
 * cheio), nada quebra: lê como "não vi" e o VS toca de novo.
 */
const key = (roundId: string) => `fut-stats:vs-visto:${roundId}`;

export function hasSeenVs(roundId: string, storage?: Pick<Storage, 'getItem'>): boolean {
  try {
    return (storage ?? window.localStorage).getItem(key(roundId)) === '1';
  } catch {
    return false;
  }
}

export function markVsSeen(roundId: string, storage?: Pick<Storage, 'setItem'>): void {
  try {
    (storage ?? window.localStorage).setItem(key(roundId), '1');
  } catch {
    // sem armazenamento: o VS toca de novo na próxima vez
  }
}
