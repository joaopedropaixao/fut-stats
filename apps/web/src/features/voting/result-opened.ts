/**
 * "Já abri o resultado desta rodada": lembrado por rodada e por jogador (membershipId) no navegador, no padrão
 * de `features/match/result-seen.ts`. Sem armazenamento (modo privado, bloqueado, cheio), nada quebra: lê como
 * "não abri" e o card do início continua em destaque.
 */
const key = (roundId: string, membershipId: string) =>
  `fut-stats:resultado-aberto:${roundId}:${membershipId}`;

export function hasOpenedResult(
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

export function markResultOpened(
  roundId: string,
  membershipId: string,
  storage?: Pick<Storage, 'setItem'>,
): void {
  try {
    (storage ?? window.localStorage).setItem(key(roundId, membershipId), '1');
  } catch {
    // sem armazenamento: o card segue em destaque na próxima vez
  }
}
