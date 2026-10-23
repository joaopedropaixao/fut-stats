import {
  applyDecorators,
  createParamDecorator,
  SetMetadata,
  UseGuards,
  type ExecutionContext,
} from '@nestjs/common';
import type { Role } from '../generated/prisma/enums';
import { GROUP_ROLES_KEY, GroupAccessGuard } from './group-access.guard';
import type { AuthenticatedRequest, GroupMembership } from './request';

/** Exige membro ativo do grupo `:groupId` da rota, qualquer papel. */
export const GroupMember = () => UseGuards(GroupAccessGuard);

/** Exige membro ativo do grupo `:groupId` com um dos papéis. Ex.: `@GroupRole('ADMIN')`. */
export const GroupRole = (...roles: [Role, ...Role[]]) =>
  applyDecorators(SetMetadata(GROUP_ROLES_KEY, roles), UseGuards(GroupAccessGuard));

/** A Membership do usuário logado no grupo da rota. Só com `@GroupMember()`/`@GroupRole()`. */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, context: ExecutionContext): GroupMembership => {
    const { membership } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!membership) throw new Error('@CurrentMembership() usado sem @GroupMember()/@GroupRole()');
    return membership;
  },
);
