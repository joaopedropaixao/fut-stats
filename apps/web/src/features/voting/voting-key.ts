/** A tecla do aviso grande da votação (sempre amarela), conforme o que a pessoa pode fazer. */
export function votingKeyLabel(played: boolean, voted: boolean): string {
  if (!played) return 'Ver votação';
  return voted ? 'Ver meus votos' : 'Dar minhas notas';
}
