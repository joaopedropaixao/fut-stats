import { Injectable, NotFoundException } from '@nestjs/common';
import { matchWinner, POSITIONS, type Position } from '@fut-stats/domain';
import type {
  HistoryDetail,
  HistoryItem,
  HistoryList,
  HistoryPlayer,
  HistoryQuery,
  HistoryTeam,
} from '@fut-stats/shared';
import type { Prisma } from '../generated/prisma/client';
import type { RoundStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

/** Já foi jogada: em jogo ou depois, ou com placar lançado. */
const PLAYED: Prisma.RoundWhereInput = {
  OR: [
    { status: { in: ['IN_PROGRESS', 'VOTING', 'CLOSED'] } },
    { whiteGoals: { not: null }, blackGoals: { not: null } },
  ],
};

interface ItemRow {
  id: string;
  scheduledAt: Date;
  location: string | null;
  status: RoundStatus;
  whiteGoals: number | null;
  blackGoals: number | null;
}

const itemSelect = {
  id: true,
  scheduledAt: true,
  location: true,
  status: true,
  whiteGoals: true,
  blackGoals: true,
} as const;

function toItem(round: ItemRow): HistoryItem {
  const score =
    round.whiteGoals === null || round.blackGoals === null
      ? null
      : { WHITE: round.whiteGoals, BLACK: round.blackGoals };
  return {
    roundId: round.id,
    scheduledAt: round.scheduledAt.toISOString(),
    location: round.location,
    status: round.status,
    score,
    // Placar de jogo em andamento é parcial: ninguém venceu ainda
    winner: score && round.status !== 'IN_PROGRESS' ? matchWinner(score) : null,
  };
}

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mais recente primeiro. `cursor` é o id da última rodada da página anterior. */
  async list(groupId: string, { limit, cursor }: HistoryQuery): Promise<HistoryList> {
    const rows = await this.prisma.round.findMany({
      where: { groupId, ...PLAYED },
      orderBy: [{ scheduledAt: 'desc' }, { id: 'desc' }],
      select: itemSelect,
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
    const page = rows.slice(0, limit);
    return {
      items: page.map(toItem),
      nextCursor: rows.length > limit ? page[page.length - 1]!.id : null,
    };
  }

  async detail(groupId: string, roundId: string): Promise<HistoryDetail> {
    const round = await this.prisma.round.findFirst({
      where: { id: roundId, groupId, ...PLAYED },
      select: {
        ...itemSelect,
        teamPlayers: {
          select: {
            membershipId: true,
            team: true,
            position: true,
            isReserve: true,
            membership: {
              select: { nickname: true, photoUrl: true, isHiredGoalkeeper: true },
            },
          },
        },
        matchEvents: { select: { membershipId: true, type: true } },
      },
    });
    if (!round) throw new NotFoundException('Partida não encontrada');

    const tally = new Map<string, { goals: number; assists: number }>();
    for (const { membershipId, type } of round.matchEvents) {
      const entry = tally.get(membershipId) ?? { goals: 0, assists: 0 };
      if (type === 'GOAL') entry.goals += 1;
      if (type === 'ASSIST') entry.assists += 1;
      tally.set(membershipId, entry);
    }

    const order = (position: Position) => POSITIONS.indexOf(position);
    const team = (side: 'WHITE' | 'BLACK'): HistoryTeam => {
      const players: (HistoryPlayer & { isReserve: boolean })[] = round.teamPlayers
        .filter((p) => p.team === side)
        .map((p) => ({
          membershipId: p.membershipId,
          nickname: p.membership.nickname,
          photoUrl: p.membership.photoUrl,
          position: p.position,
          isHiredGoalkeeper: p.membership.isHiredGoalkeeper,
          goals: tally.get(p.membershipId)?.goals ?? 0,
          assists: tally.get(p.membershipId)?.assists ?? 0,
          isReserve: p.isReserve,
        }))
        .sort(
          (a, b) => order(a.position) - order(b.position) || a.nickname.localeCompare(b.nickname),
        );
      const strip = ({ isReserve: _, ...player }: (typeof players)[number]): HistoryPlayer =>
        player;
      return {
        starters: players.filter((p) => !p.isReserve).map(strip),
        reserves: players.filter((p) => p.isReserve).map(strip),
      };
    };

    return { ...toItem(round), teams: { WHITE: team('WHITE'), BLACK: team('BLACK') } };
  }
}
