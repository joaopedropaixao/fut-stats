import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  PLAYED_ROUND_STATUSES,
  POSITIONS,
  roundResult,
  tallyPlayerEvents,
  type Position,
} from '@fut-stats/domain';
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

/** Já foi jogada (`isRoundPlayed` do domain): em jogo, votação ou encerrada. */
const PLAYED: Prisma.RoundWhereInput = { status: { in: [...PLAYED_ROUND_STATUSES] } };

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
    winner: roundResult(round.status, score),
  };
}

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mais recente primeiro. `cursor` é o id da última rodada da página anterior. */
  async list(groupId: string, { limit, cursor }: HistoryQuery): Promise<HistoryList> {
    // O Prisma acha o cursor só pelo id: um id de outro grupo mudaria onde a página começa
    if (cursor) {
      const known = await this.prisma.round.count({ where: { id: cursor, groupId, ...PLAYED } });
      if (!known) throw new BadRequestException('Cursor inválido');
    }
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
            membership: { select: { nickname: true } },
          },
        },
        matchEvents: { select: { membershipId: true, type: true } },
      },
    });
    if (!round) throw new NotFoundException('Partida não encontrada');

    const tally = tallyPlayerEvents(
      round.matchEvents.map(({ membershipId, type }) => ({ playerId: membershipId, type })),
    );

    const order = (position: Position) => POSITIONS.indexOf(position);
    const team = (side: 'WHITE' | 'BLACK'): HistoryTeam => {
      const players: (HistoryPlayer & { isReserve: boolean })[] = round.teamPlayers
        .filter((p) => p.team === side)
        .map((p) => ({
          membershipId: p.membershipId,
          nickname: p.membership.nickname,
          position: p.position,
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
