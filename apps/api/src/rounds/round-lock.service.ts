import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Client do Prisma dentro da transação da rodada (o `tx` do `$transaction` interativo). */
export type RoundTx = Prisma.TransactionClient;

/**
 * Trava por rodada, de quem escreve nela: placar, lances, votos e fechamento disputam a mesma rodada.
 */
@Injectable()
export class RoundLockService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Toda escrita da rodada roda aqui: uma transação que começa travando a linha da rodada (`FOR UPDATE`).
   * Quem chega depois espera o commit de quem travou e só então carrega, valida e grava, então a validação
   * sempre vê o que o pedido anterior gravou (placar no limite, etapa, lance já apagado, voto já enviado).
   * Rodada de outro grupo ou inexistente não trava nada e leva 404. A resposta é montada depois do commit.
   */
  withRoundLock<T>(
    groupId: string,
    roundId: string,
    work: (tx: RoundTx) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ locked: number }[]>`
        SELECT 1 AS locked FROM "Round" WHERE id = ${roundId} AND "groupId" = ${groupId} FOR UPDATE`;
      if (locked.length === 0) throw new NotFoundException();
      return work(tx);
    });
  }
}
