import type { Role } from '../core';
import { compareNicknames } from './group';

/** Por que uma mudança de admin (papel, ativo) num membro é inválida. Textos em `packages/shared`. */
export const MEMBER_ADMIN_CHANGE_ERRORS = ['SELF_CHANGE'] as const;

export type MemberAdminChangeError = (typeof MEMBER_ADMIN_CHANGE_ERRORS)[number];

/**
 * O apelido já é de outro? `others` = apelidos dos outros membros **ativos** do grupo (sem o de quem está
 * mudando). Igual = `compareNicknames` 0 (ignora maiúscula e acento), sem os espaços das pontas.
 */
export function isNicknameTaken(nickname: string, others: readonly string[]): boolean {
  const wanted = nickname.trim();
  return others.some((other) => compareNicknames(wanted, other.trim()) === 0);
}

/**
 * Um admin não muda o próprio papel nem se desativa: assim sempre sobra pelo menos um admin ativo.
 * Mudar a própria nota inicial ou o goleiro contratado pode. `change` traz só o que muda (campo ausente = não muda).
 */
export function validateMemberAdminChange(
  actorId: string,
  targetId: string,
  change: { role?: Role; active?: boolean },
): MemberAdminChangeError[] {
  const isSelf = actorId === targetId;
  const touchesAdminFields = change.role !== undefined || change.active !== undefined;
  return isSelf && touchesAdminFields ? ['SELF_CHANGE'] : [];
}
