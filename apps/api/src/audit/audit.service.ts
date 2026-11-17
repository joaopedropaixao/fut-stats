import { Injectable, NotFoundException } from '@nestjs/common';
import { ROUND_LOG_ACTIONS, type RoundLogAction } from '@fut-stats/domain';
import { ROUND_LOG_ACTION_LABELS, type RoundLogEntry } from '@fut-stats/shared';
import type { GroupMembership } from '../auth/request';
import { getRequestId } from '../common/request-context';
import { Prisma } from '../generated/prisma/client';
import type { AuditAction } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Retrato pequeno do que mudou (por ação, ver o spec). Na rodada, só ids e valores. No feed, a moderação guarda o
 * conteúdo: POST_EDITED leva o título e o texto de antes e de depois, POST_DELETED e COMMENT_DELETED o texto apagado
 * (é a prova do que foi tirado; a leitura do registro é só de admin). Voto nunca entra: só contagens.
 */
export type AuditSnapshot = Prisma.InputJsonObject;

export interface AuditRecord {
  groupId: string;
  /** Linhas da rodada. As do feed não têm. */
  roundId?: string;
  /** Linhas do feed (resenha, comentário, reação). Sem chave estrangeira: sobrevive à resenha apagada. */
  postId?: string;
  /** A participação de quem pediu; nulo = automático (fechamento da votação sem pedido do admin). */
  actorId: string | null;
  action: AuditAction;
  before: AuditSnapshot | null;
  after: AuditSnapshot | null;
}

/**
 * Registro de auditoria do grupo: quem mudou placar, etapa e lance da rodada, e quem escreveu no feed (resenha,
 * comentário, reação), o quê e quando. Só inserção. Quem escreve chama `record` com o `tx` da própria transação:
 * a mudança e a linha entram juntas ou nenhuma entra. A leitura da rodada é a rota do admin; a do feed é só do dono.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Grava uma linha no `tx` recebido. O `requestId` do pedido em andamento só vai com ator: a linha sem ator
   * (VOTING_CLOSED pelo último voto ou pelo prazo) fica com `requestId` nulo, senão o log de pedido ligaria o
   * fechamento a quem votou por último ou a quem só abriu o app.
   */
  async record(tx: Prisma.TransactionClient, entry: AuditRecord): Promise<void> {
    await tx.auditLog.create({
      data: {
        groupId: entry.groupId,
        roundId: entry.roundId ?? null,
        postId: entry.postId ?? null,
        actorId: entry.actorId,
        action: entry.action,
        before: entry.before ?? Prisma.DbNull,
        after: entry.after ?? Prisma.DbNull,
        requestId: entry.actorId === null ? null : getRequestId(),
      },
    });
  }

  /** Linha com o membro que pediu como ator, na rodada (`{ roundId }`) ou no feed (`{ postId }`) do grupo dele. */
  recordForMember(
    tx: Prisma.TransactionClient,
    membership: GroupMembership,
    target: { roundId: string } | { postId: string },
    action: AuditAction,
    before: AuditSnapshot | null,
    after: AuditSnapshot | null,
  ): Promise<void> {
    return this.record(tx, {
      groupId: membership.groupId,
      ...target,
      actorId: membership.id,
      action,
      before,
      after,
    });
  }

  /** O registro da rodada do grupo da rota (senão 404), do mais antigo para o mais novo. Quem pode ler é o controller. */
  async list(membership: GroupMembership, roundId: string): Promise<RoundLogEntry[]> {
    const round = await this.prisma.round.findFirst({
      where: { id: roundId, groupId: membership.groupId },
      select: { id: true },
    });
    if (!round) throw new NotFoundException();

    const rows = await this.prisma.auditLog.findMany({
      where: {
        roundId: round.id,
        groupId: membership.groupId,
        action: { in: [...ROUND_LOG_ACTIONS] },
      },
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
      action: row.action as RoundLogAction,
      label: ROUND_LOG_ACTION_LABELS[row.action as RoundLogAction],
      actor: row.actor ? { membershipId: row.actor.id, nickname: row.actor.nickname } : null,
      before: row.before as RoundLogEntry['before'],
      after: row.after as RoundLogEntry['after'],
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
