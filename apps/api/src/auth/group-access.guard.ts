import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from './request';

export const GROUP_ROLES_KEY = 'groupRoles';

/**
 * Exige Membership ativa no grupo do parâmetro `:groupId` (use via `@GroupMember()`/`@GroupRole()`).
 * Não membro ou membro inativo → 404 (não revela que o grupo existe); sem o papel pedido → 403.
 */
@Injectable()
export class GroupAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const groupId = req.params.groupId;
    if (typeof groupId !== 'string') {
      throw new Error('GroupAccessGuard usado em rota sem o parâmetro :groupId');
    }
    if (!req.user) throw new Error('GroupAccessGuard usado em rota sem sessão (@Public?)');

    const membership = await this.prisma.membership.findUnique({
      where: { userId_groupId: { userId: req.user.id, groupId } },
      select: { id: true, groupId: true, role: true, active: true },
    });
    if (!membership?.active) throw new NotFoundException();

    const roles =
      this.reflector.getAllAndOverride<Role[] | undefined>(GROUP_ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (roles.length > 0 && !roles.includes(membership.role)) throw new ForbiddenException();

    req.membership = { id: membership.id, groupId: membership.groupId, role: membership.role };
    return true;
  }
}
