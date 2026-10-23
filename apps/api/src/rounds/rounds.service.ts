import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  canChangeAttendance,
  isRoundDeletable,
  isRoundEditable,
  validateAttendanceChange,
  type RoundActor,
} from '@fut-stats/domain';
import {
  ATTENDANCE_ERROR_LABELS,
  ROUND_NOT_DELETABLE_LABEL,
  ROUND_NOT_EDITABLE_LABEL,
  type AttendanceMember,
  type CreateRoundInput,
  type RoundDetail,
  type RoundList,
  type RoundPermissions,
  type RoundSummary,
  type SetAttendanceInput,
  type UpdateRoundInput,
} from '@fut-stats/shared';
import type { GroupMembership } from '../auth/request';
import { PrismaService } from '../prisma/prisma.service';

/** Só conta quem confirmou e segue ativo no grupo. */
const confirmedCount = {
  _count: {
    select: { attendances: { where: { confirmed: true, membership: { active: true } } } },
  },
} as const;

const summarySelect = {
  id: true,
  number: true,
  scheduledAt: true,
  location: true,
  status: true,
  ...confirmedCount,
} as const;

type SummaryRow = {
  id: string;
  number: number;
  scheduledAt: Date;
  location: string | null;
  status: RoundSummary['status'];
  _count: { attendances: number };
};

function toSummary({ _count, scheduledAt, ...round }: SummaryRow): RoundSummary {
  return { ...round, scheduledAt: scheduledAt.toISOString(), confirmedCount: _count.attendances };
}

function toActor(membership: GroupMembership): RoundActor {
  return { id: membership.id, isAdmin: membership.role === 'ADMIN' };
}

@Injectable()
export class RoundsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(membership: GroupMembership, input: CreateRoundInput): Promise<RoundDetail> {
    const round = await this.prisma.round.create({
      data: {
        groupId: membership.groupId,
        scheduledAt: new Date(input.scheduledAt),
        location: input.location,
      },
      select: { id: true },
    });
    return this.detail(membership, round.id);
  }

  /** Próximas (a partir de agora, mais perto primeiro) e passadas (mais recente primeiro). */
  async list(groupId: string, now = new Date()): Promise<RoundList> {
    const [upcoming, past] = await Promise.all([
      this.prisma.round.findMany({
        where: { groupId, scheduledAt: { gte: now } },
        select: summarySelect,
        orderBy: { scheduledAt: 'asc' },
      }),
      this.prisma.round.findMany({
        where: { groupId, scheduledAt: { lt: now } },
        select: summarySelect,
        orderBy: { scheduledAt: 'desc' },
      }),
    ]);
    return { upcoming: upcoming.map(toSummary), past: past.map(toSummary) };
  }

  /** A rodada com a lista de presença dos membros ativos: Vou, Não vou e quem não respondeu. */
  async detail(membership: GroupMembership, roundId: string): Promise<RoundDetail> {
    const round = await this.prisma.round.findFirst({
      where: { id: roundId, groupId: membership.groupId },
      select: summarySelect,
    });
    if (!round) throw new NotFoundException();

    const members = await this.prisma.membership.findMany({
      where: { groupId: membership.groupId, active: true },
      select: {
        id: true,
        nickname: true,
        photoUrl: true,
        primaryPosition: true,
        isHiredGoalkeeper: true,
        attendances: { where: { roundId }, select: { confirmed: true } },
      },
      orderBy: [{ nickname: 'asc' }, { createdAt: 'asc' }],
    });

    const attendance: RoundDetail['attendance'] = { confirmed: [], declined: [], pending: [] };
    let myAttendance: boolean | null = null;
    for (const { id, attendances, ...member } of members) {
      const answer = attendances[0]?.confirmed ?? null;
      if (id === membership.id) myAttendance = answer;
      const item: AttendanceMember = { membershipId: id, ...member };
      if (answer === null) attendance.pending.push(item);
      else (answer ? attendance.confirmed : attendance.declined).push(item);
    }
    const actor = toActor(membership);
    const permissions: RoundPermissions = {
      setOwnAttendance: canChangeAttendance(membership.id, actor, round.status),
      setAnyAttendance: actor.isAdmin && canChangeAttendance(membership.id, actor, round.status),
      edit: actor.isAdmin && isRoundEditable(round.status),
      delete: actor.isAdmin && isRoundDeletable(round.status),
    };
    return {
      ...toSummary(round),
      myMembershipId: membership.id,
      permissions,
      myAttendance,
      attendance,
    };
  }

  /** Muda data/hora e/ou local. Só antes do jogo (`isRoundEditable`). */
  async update(
    membership: GroupMembership,
    roundId: string,
    input: UpdateRoundInput,
  ): Promise<RoundDetail> {
    const round = await this.findRound(membership.groupId, roundId);
    if (!isRoundEditable(round.status)) {
      throw new ConflictException({
        code: 'ROUND_NOT_EDITABLE',
        message: ROUND_NOT_EDITABLE_LABEL,
      });
    }
    await this.prisma.round.update({
      where: { id: round.id },
      data: {
        scheduledAt: input.scheduledAt === undefined ? undefined : new Date(input.scheduledAt),
        location: input.location,
      },
    });
    return this.detail(membership, round.id);
  }

  /** Apaga a rodada (e as presenças). Só antes do jogo (`isRoundDeletable`). */
  async remove(groupId: string, roundId: string): Promise<void> {
    const round = await this.findRound(groupId, roundId);
    if (!isRoundDeletable(round.status)) {
      throw new ConflictException({
        code: 'ROUND_NOT_DELETABLE',
        message: ROUND_NOT_DELETABLE_LABEL,
      });
    }
    await this.prisma.round.delete({ where: { id: round.id } });
  }

  /**
   * Marca Vou / Não vou de um membro ativo do grupo. Quem pode e até quando é do domínio
   * (`validateAttendanceChange`): mexer na presença de outro sem ser admin → 403; fora do prazo → 409.
   */
  async setAttendance(
    membership: GroupMembership,
    roundId: string,
    membershipId: string,
    input: SetAttendanceInput,
  ): Promise<RoundDetail> {
    const round = await this.findRound(membership.groupId, roundId);
    const target = await this.prisma.membership.findFirst({
      where: { id: membershipId, groupId: membership.groupId, active: true },
      select: { id: true },
    });
    if (!target) throw new NotFoundException();

    const [error] = validateAttendanceChange(target.id, toActor(membership), round.status);
    if (error) {
      const body = { code: error, message: ATTENDANCE_ERROR_LABELS[error] };
      throw error === 'NOT_OWN_ATTENDANCE'
        ? new ForbiddenException(body)
        : new ConflictException(body);
    }

    await this.prisma.attendance.upsert({
      where: { roundId_membershipId: { roundId: round.id, membershipId: target.id } },
      create: { roundId: round.id, membershipId: target.id, confirmed: input.confirmed },
      update: { confirmed: input.confirmed },
    });
    return this.detail(membership, round.id);
  }

  /** A rodada, só se for do grupo da rota; senão 404 (não revela rodada de outro grupo). */
  private async findRound(groupId: string, roundId: string) {
    const round = await this.prisma.round.findFirst({
      where: { id: roundId, groupId },
      select: { id: true, status: true },
    });
    if (!round) throw new NotFoundException();
    return round;
  }
}
