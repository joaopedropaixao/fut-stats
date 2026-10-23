import { Injectable } from '@nestjs/common';
import type { MeResponse, SessionUser } from '@fut-stats/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /** O usuário e os grupos em que ele é membro ativo, com o papel em cada um. */
  async me(user: SessionUser): Promise<MeResponse> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.id, active: true },
      select: { role: true, group: { select: { id: true, name: true, slug: true } } },
      orderBy: { group: { name: 'asc' } },
    });
    return {
      user,
      groups: memberships.map(({ role, group }) => ({ ...group, role })),
    };
  }
}
