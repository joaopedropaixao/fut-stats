import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { SessionUser } from '@fut-stats/shared';
import type { AuthenticatedRequest } from './request';

/** O usuário da sessão. Só em rota protegida (sem `@Public()`). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionUser => {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user) throw new Error('@CurrentUser() usado em rota sem sessão (@Public?)');
    return user;
  },
);
