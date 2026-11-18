import { Injectable } from '@nestjs/common';
import type { MeResponse, SessionUser } from '@fut-stats/shared';
import { AVATAR_SELECT, toAvatar } from '../common/avatar';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /** O usuário e os grupos em que ele é membro ativo, com o papel e o id da participação em cada um. */
  async me(user: SessionUser): Promise<MeResponse> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.id, active: true },
      select: {
        id: true,
        role: true,
        nickname: true,
        ...AVATAR_SELECT,
        group: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { group: { name: 'asc' } },
    });
    return {
      user,
      groups: memberships.map((m) => ({
        ...m.group,
        role: m.role,
        membershipId: m.id,
        nickname: m.nickname,
        avatar: toAvatar(m),
      })),
    };
  }
}
