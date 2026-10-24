import { Controller, Get, HttpCode, NotFoundException, Param, Post, Res } from '@nestjs/common';
import type { DevUser } from '@fut-stats/shared';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { SessionService } from '../auth/session.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Login de desenvolvimento: lista as pessoas do banco local e abre a sessão de qualquer uma, sem Google.
 * Só existe com NODE_ENV=development (ver `DevModule.forEnvironment`).
 */
@Public()
@Controller('dev')
export class DevController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  @Get('users')
  async users(): Promise<DevUser[]> {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        memberships: {
          select: { nickname: true, role: true, active: true, group: { select: { name: true } } },
          orderBy: { group: { name: 'asc' } },
        },
      },
      orderBy: { name: 'asc' },
    });
    return users.map(({ memberships, ...user }) => ({
      ...user,
      memberships: memberships.map(({ group, ...m }) => ({ ...m, groupName: group.name })),
    }));
  }

  @Post('login/:userId')
  @HttpCode(204)
  async login(
    @Param('userId') userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException();
    this.sessions.createSession(res, user.id);
  }
}
