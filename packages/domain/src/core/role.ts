/** Papel de um membro no grupo. Admin também é jogador: tem as permissões de admin a mais. */
export const ROLES = ['ADMIN', 'PLAYER'] as const;

export type Role = (typeof ROLES)[number];
