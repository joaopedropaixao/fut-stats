/** Por que uma mudança de admin (papel, ativo) num membro é inválida. Textos em `packages/shared`. */
export const MEMBER_ADMIN_CHANGE_ERRORS = ['SELF_CHANGE'] as const;

export type MemberAdminChangeError = (typeof MEMBER_ADMIN_CHANGE_ERRORS)[number];
