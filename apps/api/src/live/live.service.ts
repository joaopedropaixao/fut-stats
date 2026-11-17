import { Injectable, NotFoundException } from '@nestjs/common';
import type { GroupMembership } from '../auth/request';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LiveService {
  constructor(private readonly prisma: PrismaService) {}

  /** A rodada só se for do grupo da rota; senão 404 (resposta comum, antes de abrir o fluxo). */
  async requireRound(membership: GroupMembership, roundId: string): Promise<void> {
    const round = await this.prisma.round.findFirst({
      where: { id: roundId, groupId: membership.groupId },
      select: { id: true },
    });
    if (!round) throw new NotFoundException();
  }
}
