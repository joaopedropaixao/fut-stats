import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  POSITIONS,
  TEAMS,
  validateLineupDraft,
  validateRoundTransition,
  type RoundStatus,
  type RoundTeams,
  type Team,
} from '@fut-stats/domain';
import {
  LINEUP_DRAFT_ERROR_LABELS,
  LINEUP_NOT_EDITABLE_LABEL,
  PLAYER_NOT_CONFIRMED_LABEL,
  ROUND_TRANSITION_ERROR_LABELS,
  type AttendanceMember,
  type Lineup,
  type LineupPlayer,
  type SaveLineupInput,
} from '@fut-stats/shared';
import type { GroupMembership } from '../auth/request';
import { PrismaService } from '../prisma/prisma.service';

const memberSelect = {
  id: true,
  nickname: true,
  photoUrl: true,
  primaryPosition: true,
  isHiredGoalkeeper: true,
} as const;

type MemberRow = {
  id: string;
  nickname: string;
  photoUrl: string | null;
  primaryPosition: AttendanceMember['primaryPosition'];
  isHiredGoalkeeper: boolean;
};

function toMember({ id, ...member }: MemberRow): AttendanceMember {
  return { membershipId: id, ...member };
}

interface TeamPlayerRow {
  team: Team;
  position: LineupPlayer['position'];
  isReserve: boolean;
  membership: MemberRow;
}

/** Os TeamPlayer da rodada no formato que o domain valida. */
function toRoundTeams(rows: readonly TeamPlayerRow[]): RoundTeams {
  const starters = (team: Team) =>
    rows
      .filter((row) => row.team === team && !row.isReserve)
      .map((row) => ({ playerId: row.membership.id, position: row.position }));
  const reserves = (team: Team) =>
    rows.filter((row) => row.team === team && row.isReserve).map((row) => row.membership.id);
  return {
    WHITE: starters('WHITE'),
    BLACK: starters('BLACK'),
    reserves: { WHITE: reserves('WHITE'), BLACK: reserves('BLACK') },
  };
}

@Injectable()
export class LineupsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Os times da rodada. O admin vê o rascunho; os outros só depois de publicar (`published` = a rodada já
   * saiu de SCHEDULED, e daí em diante os times não mudam).
   */
  async get(membership: GroupMembership, roundId: string): Promise<Lineup> {
    const round = await this.findRound(membership.groupId, roundId);
    const isAdmin = membership.role === 'ADMIN';
    const published = round.status !== 'SCHEDULED';
    const visible = isAdmin || published;

    const rows = visible ? await this.teamPlayers(round.id) : [];
    const placed = new Set(rows.map((row) => row.membership.id));
    const unassigned = visible
      ? await this.prisma.membership.findMany({
          where: {
            groupId: membership.groupId,
            active: true,
            id: { notIn: [...placed] },
            attendances: { some: { roundId: round.id, confirmed: true } },
          },
          select: memberSelect,
          orderBy: [{ nickname: 'asc' }, { createdAt: 'asc' }],
        })
      : [];

    const team = (key: Team) => ({
      starters: rows.filter((row) => row.team === key && !row.isReserve).map(toPlayer),
      reserves: rows.filter((row) => row.team === key && row.isReserve).map(toPlayer),
    });
    return {
      published,
      teams: { WHITE: team('WHITE'), BLACK: team('BLACK') },
      unassigned: unassigned.map(toMember),
      errors: isAdmin
        ? validateRoundTransition(toState(round.status, rows), 'TEAMS_PUBLISHED')
        : [],
    };
  }

  /** Troca o rascunho inteiro. Só com a rodada agendada, e só com quem confirmou presença. */
  async save(
    membership: GroupMembership,
    roundId: string,
    input: SaveLineupInput,
  ): Promise<Lineup> {
    const round = await this.findRound(membership.groupId, roundId);
    if (round.status !== 'SCHEDULED') {
      throw new ConflictException({
        code: 'LINEUP_NOT_EDITABLE',
        message: LINEUP_NOT_EDITABLE_LABEL,
      });
    }

    const draft: RoundTeams = {
      WHITE: input.WHITE.starters.map((s) => ({ playerId: s.membershipId, position: s.position })),
      BLACK: input.BLACK.starters.map((s) => ({ playerId: s.membershipId, position: s.position })),
      reserves: { WHITE: input.WHITE.reserves, BLACK: input.BLACK.reserves },
    };
    const [draftError] = validateLineupDraft(draft);
    if (draftError) {
      throw new BadRequestException({
        code: draftError,
        message: LINEUP_DRAFT_ERROR_LABELS[draftError],
      });
    }

    const ids = [
      ...new Set(
        TEAMS.flatMap((t) => [
          ...input[t].starters.map((s) => s.membershipId),
          ...input[t].reserves,
        ]),
      ),
    ];
    const confirmed = await this.prisma.membership.findMany({
      where: {
        id: { in: ids },
        groupId: membership.groupId,
        active: true,
        attendances: { some: { roundId: round.id, confirmed: true } },
      },
      select: { id: true, primaryPosition: true },
    });
    if (confirmed.length !== ids.length) {
      throw new BadRequestException({
        code: 'PLAYER_NOT_CONFIRMED',
        message: PLAYER_NOT_CONFIRMED_LABEL,
      });
    }
    const primaryOf = new Map(confirmed.map((m) => [m.id, m.primaryPosition]));

    const data = TEAMS.flatMap((team) => [
      ...input[team].starters.map((s) => ({
        roundId: round.id,
        team,
        membershipId: s.membershipId,
        position: s.position,
        isReserve: false,
      })),
      // Reserva não tem vaga fixa: guarda a posição principal dele.
      ...input[team].reserves.map((id) => ({
        roundId: round.id,
        team,
        membershipId: id,
        position: primaryOf.get(id)!,
        isReserve: true,
      })),
    ]);
    await this.prisma.$transaction([
      this.prisma.teamPlayer.deleteMany({ where: { roundId: round.id } }),
      this.prisma.teamPlayer.createMany({ data }),
    ]);
    return this.get(membership, round.id);
  }

  /** SCHEDULED → TEAMS_PUBLISHED, só com a escalação válida (`validateRoundTransition`). */
  publish(membership: GroupMembership, roundId: string): Promise<Lineup> {
    return this.transition(membership, roundId, 'TEAMS_PUBLISHED');
  }

  /** TEAMS_PUBLISHED → SCHEDULED: o domain permite voltar para refazer os times. O rascunho fica. */
  unpublish(membership: GroupMembership, roundId: string): Promise<Lineup> {
    return this.transition(membership, roundId, 'SCHEDULED');
  }

  private async transition(
    membership: GroupMembership,
    roundId: string,
    to: RoundStatus,
  ): Promise<Lineup> {
    const round = await this.findRound(membership.groupId, roundId);
    const rows = await this.teamPlayers(round.id);
    const [error] = validateRoundTransition(toState(round.status, rows), to);
    if (error) {
      throw new ConflictException({ code: error, message: ROUND_TRANSITION_ERROR_LABELS[error] });
    }

    // Só muda se ninguém mexeu na etapa nesse meio-tempo.
    const { count } = await this.prisma.round.updateMany({
      where: { id: round.id, status: round.status },
      data: { status: to },
    });
    if (count !== 1) {
      throw new ConflictException({
        code: 'INVALID_TRANSITION',
        message: ROUND_TRANSITION_ERROR_LABELS.INVALID_TRANSITION,
      });
    }
    return this.get(membership, round.id);
  }

  private async teamPlayers(roundId: string): Promise<TeamPlayerRow[]> {
    const rows = await this.prisma.teamPlayer.findMany({
      where: { roundId },
      select: { team: true, position: true, isReserve: true, membership: { select: memberSelect } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    // Titulares na ordem do 1-2-3-1 (goleiro, zagueiros, alas, meio, atacante).
    return rows.sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position));
  }

  /** A rodada, só se for do grupo da rota; senão 404. */
  private async findRound(groupId: string, roundId: string) {
    const round = await this.prisma.round.findFirst({
      where: { id: roundId, groupId },
      select: { id: true, status: true },
    });
    if (!round) throw new NotFoundException();
    return round;
  }
}

function toPlayer({ membership, position }: TeamPlayerRow): LineupPlayer {
  return { ...toMember(membership), position };
}

function toState(status: RoundStatus, rows: readonly TeamPlayerRow[]) {
  return { status, teams: toRoundTeams(rows), score: null, events: [] };
}
