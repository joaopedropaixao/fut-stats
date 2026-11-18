import { BadRequestException, Injectable } from '@nestjs/common';
import {
  compareNicknames,
  isMatchFinished,
  matchResult,
  matchWinner,
  ROUND_STATUSES,
  type Team,
} from '@fut-stats/domain';
import { INVALID_CURSOR_LABEL, type HistoryList, type HistoryQuery } from '@fut-stats/shared';
import type { GroupMembership } from '../auth/request';
import { AVATAR_SELECT, toAvatar } from '../common/avatar';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Partida finalizada (`isMatchFinished`) e com placar: toda rodada assim tem, finalizar exige o placar. */
function finished(groupId: string): Prisma.RoundWhereInput {
  return {
    groupId,
    status: { in: ROUND_STATUSES.filter(isMatchFinished) },
    whiteGoals: { not: null },
    blackGoals: { not: null },
  };
}

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Partidas finalizadas do grupo, da mais recente para a mais antiga (data marcada, depois número).
   * `cursor` = id da última rodada da página anterior; a página seguinte começa logo depois dela.
   */
  async list(
    { id: membershipId, groupId }: GroupMembership,
    { limit, cursor }: HistoryQuery,
  ): Promise<HistoryList> {
    let after: Prisma.RoundWhereInput = {};
    if (cursor) {
      // O cursor tem que ser de uma partida finalizada deste grupo: nunca confiar no id do cliente.
      const last = await this.prisma.round.findFirst({
        where: { ...finished(groupId), id: cursor },
        select: { scheduledAt: true, number: true },
      });
      if (!last) {
        throw new BadRequestException({ code: 'INVALID_CURSOR', message: INVALID_CURSOR_LABEL });
      }
      after = {
        OR: [
          { scheduledAt: { lt: last.scheduledAt } },
          { scheduledAt: last.scheduledAt, number: { lt: last.number } },
        ],
      };
    }

    const rows = await this.prisma.round.findMany({
      where: { AND: [finished(groupId), after] },
      orderBy: [{ scheduledAt: 'desc' }, { number: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        number: true,
        scheduledAt: true,
        location: true,
        status: true,
        whiteGoals: true,
        blackGoals: true,
        // O time de quem pede (titular ou reserva) e o(s) Craque(s): as linhas de quem pede e de quem levou o prêmio.
        teamPlayers: {
          where: { OR: [{ membershipId }, { isMvp: true }] },
          select: {
            membershipId: true,
            team: true,
            isMvp: true,
            membership: { select: { nickname: true, ...AVATAR_SELECT } },
          },
        },
      },
    });

    const page = rows.slice(0, limit);
    return {
      items: page.map((round) => {
        // `finished` garante o placar; o `?? 0` só estreita o tipo.
        const score = { WHITE: round.whiteGoals ?? 0, BLACK: round.blackGoals ?? 0 };
        const team: Team | undefined = round.teamPlayers.find(
          (p) => p.membershipId === membershipId,
        )?.team;
        // `isMvp` só é gravado ao fechar a votação: antes disso a lista é vazia.
        const mvps = round.teamPlayers
          .filter((p) => p.isMvp)
          .sort((a, b) => compareNicknames(a.membership.nickname, b.membership.nickname))
          .map((p) => ({
            membershipId: p.membershipId,
            nickname: p.membership.nickname,
            avatar: toAvatar(p.membership),
          }));
        return {
          roundId: round.id,
          number: round.number,
          scheduledAt: round.scheduledAt.toISOString(),
          location: round.location,
          status: round.status,
          score,
          winner: matchWinner(score),
          me: team ? { team, result: matchResult(score, team) } : null,
          mvps,
        };
      }),
      nextCursor: rows.length > limit ? page[page.length - 1]!.id : null,
    };
  }
}
