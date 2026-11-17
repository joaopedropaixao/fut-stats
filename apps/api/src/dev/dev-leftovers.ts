import type { PrismaService } from '../prisma/prisma.service';

/**
 * Apaga os grupos de dev que sobraram de execuções anteriores do `collections/dev-session.ts`: grupos em que
 * todos os membros são usuários de dev e que não têm rodada (em grupo com rodada, a participação tem presença e
 * escalação apontando para ela). Só para banco local: o app nunca apaga participação (ver CONTEXT.md).
 *
 * Ordem por causa das chaves Restrict: o registro (AuditLog, cujo `actorId` e `groupId` são Restrict) e as
 * resenhas (que levam reações e comentários junto) saem antes das participações, e o grupo por último.
 * Retorna os ids dos grupos apagados.
 */
export async function removeLeftoverDevGroups(
  prisma: PrismaService,
  devUserIds: string[],
): Promise<string[]> {
  const leftovers = await prisma.group.findMany({
    where: {
      memberships: { some: { userId: { in: devUserIds } }, every: { userId: { in: devUserIds } } },
      rounds: { none: {} },
    },
    select: { id: true },
  });
  const groupIds = leftovers.map((g) => g.id);
  if (groupIds.length === 0) return [];
  const inGroups = { groupId: { in: groupIds } };
  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: inGroups }),
    prisma.post.deleteMany({ where: inGroups }),
    prisma.membership.deleteMany({ where: inGroups }),
    prisma.group.deleteMany({ where: { id: { in: groupIds } } }),
  ]);
  return groupIds;
}
