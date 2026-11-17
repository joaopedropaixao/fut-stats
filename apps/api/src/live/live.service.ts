import { Injectable, NotFoundException } from '@nestjs/common';
import { LIVE_ROUND_STATUSES } from '@fut-stats/shared';
import type { GroupMembership } from '../auth/request';
import { PrismaService } from '../prisma/prisma.service';

const LIVE = new Set<string>(LIVE_ROUND_STATUSES);

@Injectable()
export class LiveService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A rodada só se for do grupo da rota e estiver numa etapa com canal (`LIVE_ROUND_STATUSES`); senão 404
   * (resposta comum, antes de abrir o fluxo). Rodada encerrada não tem mais nada a avisar.
   */
  async requireRound(membership: GroupMembership, roundId: string): Promise<void> {
    const round = await this.prisma.round.findFirst({
      where: { id: roundId, groupId: membership.groupId },
      select: { status: true },
    });
    if (!round || !LIVE.has(round.status)) throw new NotFoundException();
  }
}
