import { DEFAULT_AVATAR } from '@fut-stats/domain';
import { GroupsService } from '../groups/groups.service';
import { createUser } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';
import { createInactiveGroup } from './dev-inactive-group';

// A ferramenta `collections/dev-session.ts` chamava `groups.create` e `groups.join` sem `avatar` (o default do
// contrato só vale no parse do Zod, e o service recebe o tipo já parseado): a "Pelada Inativa" nunca era criada.
describe('dev-session: Pelada Inativa', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('C29: cria o grupo com o avatar padrão e deixa o usuário inativo inativo nele', async () => {
    const owner = await createUser(t, { email: 'dono@dev.local' });
    const inactive = await createUser(t, { email: 'inativo@dev.local' });

    const { group, inviteCode } = await createInactiveGroup(t.prisma, t.app.get(GroupsService), {
      owner: owner.id,
      inactive: inactive.id,
    });

    expect(group.name).toBe('Pelada Inativa');
    expect(inviteCode).toEqual(expect.any(String));
    const members = await t.prisma.membership.findMany({
      where: { groupId: group.id },
      orderBy: { nickname: 'asc' },
    });
    expect(members).toHaveLength(2);
    const [dono, inativo] = members;
    expect(dono).toMatchObject({
      userId: owner.id,
      nickname: 'Dono',
      role: 'ADMIN',
      active: true,
      avatarSkin: DEFAULT_AVATAR.skin,
      avatarHair: DEFAULT_AVATAR.hair,
      avatarHairColor: DEFAULT_AVATAR.hairColor,
    });
    expect(inativo).toMatchObject({
      userId: inactive.id,
      nickname: 'Inativo',
      role: 'PLAYER',
      active: false,
      avatarSkin: DEFAULT_AVATAR.skin,
      avatarHair: DEFAULT_AVATAR.hair,
      avatarHairColor: DEFAULT_AVATAR.hairColor,
    });
  });
});
