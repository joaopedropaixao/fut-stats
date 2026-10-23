import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { AuthenticatedRequest } from './request';
import { SESSION_COOKIE, SessionService } from './session.service';

/**
 * Guard global: toda rota exige sessão válida, menos as marcadas com `@Public()`.
 * Sem cookie, cookie inválido/expirado ou usuário que não existe mais → 401.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const token = cookies?.[SESSION_COOKIE];
    const userId = typeof token === 'string' ? this.sessions.verify(token) : null;
    if (!userId) throw new UnauthorizedException();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });
    if (!user) throw new UnauthorizedException();

    req.user = user;
    return true;
  }
}
