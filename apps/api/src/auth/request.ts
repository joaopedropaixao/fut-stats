import type { SessionUser } from '@fut-stats/shared';
import type { Request } from 'express';
import type { Role } from '../generated/prisma/enums';

/** Participação do usuário logado no grupo da rota (preenchida pelo GroupAccessGuard). */
export interface GroupMembership {
  id: string;
  groupId: string;
  role: Role;
}

/** Request depois dos guards de auth. */
export interface AuthenticatedRequest extends Request {
  user?: SessionUser;
  membership?: GroupMembership;
}
