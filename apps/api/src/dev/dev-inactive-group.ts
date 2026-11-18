import { createGroupSchema, joinGroupSchema } from '@fut-stats/shared';
import type { GroupsService } from '../groups/groups.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * A "Pelada Inativa" do `collections/dev-session.ts` (caso do 409 no Bruno): o dono cria o grupo pelo fluxo real,
 * o usuário `inactive` entra pelo convite e é desativado nele. Devolve o grupo e o código do convite.
 */
export async function createInactiveGroup(
  prisma: PrismaService,
  groups: GroupsService,
  ids: { owner: string; inactive: string },
) {
  // Pelos schemas do contrato: é o parse que põe o `avatar` padrão (o service recebe o tipo já parseado).
  const group = await groups.create(
    ids.owner,
    createGroupSchema.parse({
      name: 'Pelada Inativa',
      nickname: 'Dono',
      primaryPosition: 'MIDFIELDER',
    }),
  );
  const ownerMembership = { id: '', groupId: group.id, role: 'ADMIN' as const };
  const { code } = await groups.getInvite(ownerMembership);
  await groups.join(
    ids.inactive,
    code,
    joinGroupSchema.parse({ nickname: 'Inativo', primaryPosition: 'DEFENDER' }),
  );
  await prisma.membership.update({
    where: { userId_groupId: { userId: ids.inactive, groupId: group.id } },
    data: { active: false },
  });
  return { group, inviteCode: code };
}
