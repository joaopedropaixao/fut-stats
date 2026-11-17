import { Injectable } from '@nestjs/common';
import { feedAlerts, RESULT_HIGHLIGHT_DAYS } from '@fut-stats/domain';
import type { FeedAlert } from '@fut-stats/shared';
import type { GroupMembership } from '../auth/request';
import { PrismaService } from '../prisma/prisma.service';
import { VotingService } from '../voting/voting.service';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly voting: VotingService,
  ) {}

  /**
   * Os avisos do grupo para quem pede, na ordem de prioridade. Nada fica gravado: sai do estado das rodadas
   * (o domain escolhe os avisos) e o `me` de cada um vem de consultas só de quem pede, nas rodadas dos avisos.
   * Antes, fecha as votações vencidas do grupo (como a lista de rodadas): sem isso o feed entregaria VOTING de uma
   * votação que o card fecha ao abrir, e o topo ficaria vazio no lugar do resultado.
   */
  async alerts(membership: GroupMembership, now = new Date()): Promise<FeedAlert[]> {
    await this.voting.closeDueVotings(now, membership.groupId);
    const rounds = await this.prisma.round.findMany({
      where: {
        groupId: membership.groupId,
        OR: [
          { status: { not: 'CLOSED' } },
          // Só as que fecharam dentro do destaque do resultado; o domain escolhe a última.
          { closedAt: { gt: new Date(now.getTime() - RESULT_HIGHLIGHT_DAYS * DAY_MS) } },
        ],
      },
      select: { id: true, number: true, status: true, scheduledAt: true, closedAt: true },
    });

    const alerts = feedAlerts(rounds, now);
    if (alerts.length === 0) return [];
    const roundIds = alerts.map((alert) => alert.roundId);

    const [teamRows, attendanceRows, voteRows] = await Promise.all([
      this.prisma.teamPlayer.findMany({
        where: { membershipId: membership.id, roundId: { in: roundIds } },
        select: { roundId: true, team: true },
      }),
      this.prisma.attendance.findMany({
        where: { membershipId: membership.id, roundId: { in: roundIds } },
        select: { roundId: true, confirmed: true },
      }),
      this.prisma.vote.findMany({
        where: { voterId: membership.id, roundId: { in: roundIds } },
        select: { roundId: true },
      }),
    ]);
    const teamOf = new Map(teamRows.map((row) => [row.roundId, row.team]));
    const attendanceOf = new Map(attendanceRows.map((row) => [row.roundId, row.confirmed]));
    const voted = new Set(voteRows.map((row) => row.roundId));
    const byId = new Map(rounds.map((round) => [round.id, round]));

    return alerts.map(({ type, roundId }): FeedAlert => {
      const round = byId.get(roundId)!;
      const base = {
        type,
        roundId,
        roundNumber: round.number,
        scheduledAt: round.scheduledAt.toISOString(),
      };
      switch (type) {
        case 'PRESENCE':
          return { ...base, me: { attendance: attendanceOf.get(roundId) ?? null } };
        case 'TEAMS_PUBLISHED':
        case 'IN_PROGRESS':
        case 'POST_MATCH':
          return { ...base, me: { team: teamOf.get(roundId) ?? null } };
        case 'VOTING':
          return { ...base, me: { played: teamOf.has(roundId), voted: voted.has(roundId) } };
        case 'RESULT':
          return { ...base, me: {} };
      }
    });
  }
}
