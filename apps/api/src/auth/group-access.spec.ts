import { Controller, Get } from '@nestjs/common';
import request from 'supertest';
import { addMember, createGroup, createUser, loginAs } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';
import { CurrentMembership, GroupMember, GroupRole } from './group-access.decorator';
import type { GroupMembership } from './request';

/** Só no teste: rotas para exercitar o guard de grupo. */
@Controller('test-groups/:groupId')
class GroupProbeController {
  @GroupMember()
  @Get('member')
  member(@CurrentMembership() membership: GroupMembership): GroupMembership {
    return membership;
  }

  @GroupRole('ADMIN')
  @Get('admin')
  admin(@CurrentMembership() membership: GroupMembership): GroupMembership {
    return membership;
  }
}

describe('acesso ao grupo', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ controllers: [GroupProbeController] });
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
  });

  afterAll(async () => {
    await t.app.close();
  });

  const get = (path: string, userId?: string) => {
    const req = request(t.app.getHttpServer()).get(path);
    return userId ? req.set('Cookie', loginAs(t, userId)) : req;
  };

  it('401 sem sessão (antes de olhar o grupo)', async () => {
    const group = await createGroup(t);

    await get(`/api/test-groups/${group.id}/member`).expect(401);
  });

  it('membro ativo (PLAYER) entra na rota de membro e recebe a membership', async () => {
    const user = await createUser(t);
    const group = await createGroup(t);
    const membership = await addMember(t, user.id, group.id);

    const res = await get(`/api/test-groups/${group.id}/member`, user.id).expect(200);

    expect(res.body).toEqual({ id: membership.id, groupId: group.id, role: 'PLAYER' });
  });

  it('PLAYER na rota de admin → 403', async () => {
    const user = await createUser(t);
    const group = await createGroup(t);
    await addMember(t, user.id, group.id);

    await get(`/api/test-groups/${group.id}/admin`, user.id).expect(403);
  });

  it('ADMIN entra na rota de admin e na de membro', async () => {
    const user = await createUser(t);
    const group = await createGroup(t);
    await addMember(t, user.id, group.id, { role: 'ADMIN' });

    const res = await get(`/api/test-groups/${group.id}/admin`, user.id).expect(200);
    expect(res.body.role).toBe('ADMIN');
    await get(`/api/test-groups/${group.id}/member`, user.id).expect(200);
  });

  it('membro inativo → 404, mesmo sendo admin', async () => {
    const user = await createUser(t);
    const group = await createGroup(t);
    await addMember(t, user.id, group.id, { role: 'ADMIN', active: false });

    await get(`/api/test-groups/${group.id}/member`, user.id).expect(404);
    await get(`/api/test-groups/${group.id}/admin`, user.id).expect(404);
  });

  it('membro de outro grupo → 404 (admin lá não vale aqui)', async () => {
    const user = await createUser(t);
    const mine = await createGroup(t);
    const other = await createGroup(t);
    await addMember(t, user.id, mine.id, { role: 'ADMIN' });
    await addMember(t, (await createUser(t)).id, other.id, { role: 'ADMIN' });

    await get(`/api/test-groups/${other.id}/member`, user.id).expect(404);
    await get(`/api/test-groups/${other.id}/admin`, user.id).expect(404);
  });

  it('grupo que não existe → 404, igual a não ser membro', async () => {
    const user = await createUser(t);

    await get('/api/test-groups/grupo-inexistente/member', user.id).expect(404);
  });
});
