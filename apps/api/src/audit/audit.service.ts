import { Injectable, NotFoundException } from '@nestjs/common';
import { ROUND_LOG_ACTION_LABELS, type RoundLogEntry } from '@fut-stats/shared';
import type { GroupMembership } from '../auth/request';
import { getRequestId } from '../common/request-context';
import { Prisma } from '../generated/prisma/client';
import type { RoundLogAction } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

/** Retrato pequeno do que mudou (por ação, ver o spec): só ids e valores, nunca dado pessoal. */
export type AuditSnapshot = Prisma.InputJsonObject;

export interface AuditRecord {
  groupId: string;
  roundId: string;
  /** A participação de quem pediu; nulo = automático (fechamento da votação). */
  actorId: string | null;
  action: RoundLogAction;
  before: AuditSnapshot | null;
  after: AuditSnapshot | null;
}

/**
 * Registro da rodada: quem mudou placar, etapa e lance, o quê e quando. Só inserção.
 * Quem escreve na rodada chama `record` com o `tx` da própria transação: a mudança e a linha entram juntas
 * ou nenhuma entra.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Grava uma linha no `tx` recebido, com o `requestId` do pedido em andamento (nulo fora de um pedido). */
  async record(tx: Prisma.TransactionClient, entry: AuditRecord): Promise<void> {
    await tx.roundLog.create({
      data: {
        groupId: entry.groupId,
        roundId: entry.roundId,
        actorId: entry.actorId,
        action: entry.action,
        before: entry.before ?? Prisma.DbNull,
        after: entry.after ?? Prisma.DbNull,
        requestId: getRequestId(),
      },
    });
  }

  /** O registro da rodada do grupo da rota (senão 404), do mais antigo para o mais novo. Quem pode ler é o controller. */
  async list(membership: GroupMembership, roundId: string): Promise<RoundLogEntry[]> {
    const round = await this.prisma.round.findFirst({
      where: { id: roundId, groupId: membership.groupId },
      select: { id: true },
    });
    if (!round) throw new NotFoundException();

    const rows = await this.prisma.roundLog.findMany({
      where: { roundId: round.id, groupId: membership.groupId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        action: true,
        before: true,
        after: true,
        createdAt: true,
        actor: { select: { id: true, nickname: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      label: ROUND_LOG_ACTION_LABELS[row.action],
      actor: row.actor ? { membershipId: row.actor.id, nickname: row.actor.nickname } : null,
      before: row.before as RoundLogEntry['before'],
      after: row.after as RoundLogEntry['after'],
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
