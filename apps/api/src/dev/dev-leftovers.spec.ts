import request from 'supertest';
import { addMember, createGroup, createUser, loginAs } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';
import { removeLeftoverDevGroups } from './dev-leftovers';

// A limpeza do `collections/dev-session.ts`: apaga os grupos que só têm usuários de dev e nenhuma rodada.
// Desde o registro do feed, uma resenha, comentário ou reação nesses grupos deixa linha de AuditLog, e o
// `AuditLog.actorId` (e o `groupId`) é Restrict: a limpeza precisa apagar o registro antes da participação.
describe('dev-session: limpeza dos grupos de dev', () => {
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

  const server = () => t.app.getHttpServer();

  it('apaga o grupo de dev sem rodada mesmo com resenha, comentário, reação e o registro deles', async () => {
    const dono = await createUser(t, { email: 'dono@dev.local' });
    const parceiro = await createUser(t, { email: 'parceiro@dev.local' });
    const group = await createGroup(t, { name: 'Sobra de dev' });
    await addMember(t, dono.id, group.id, { role: 'ADMIN', nickname: 'Dono' });
    await addMember(t, parceiro.id, group.id, { role: 'PLAYER', nickname: 'Parceiro' });
    const base = `/api/groups/${group.id}/posts`;

    const post = await request(server())
      .post(base)
      .set('Cookie', loginAs(t, dono.id))
      .send({ body: 'Resenha de teste.' })
      .expect(201);
    await request(server())
      .put(`${base}/${post.body.id}/reaction`)
      .set('Cookie', loginAs(t, parceiro.id))
      .send({ reaction: 'CATFISH' })
      .expect(200);
    await request(server())
      .post(`${base}/${post.body.id}/comments`)
      .set('Cookie', loginAs(t, parceiro.id))
      .send({ text: 'Boa.' })
      .expect(201);
    expect(await t.prisma.auditLog.count({ where: { groupId: group.id } })).toBe(3);

    const removed = await removeLeftoverDevGroups(t.prisma, [dono.id, parceiro.id]);

    expect(removed).toEqual([group.id]);
    expect(await t.prisma.group.count({ where: { id: group.id } })).toBe(0);
    expect(await t.prisma.membership.count({ where: { groupId: group.id } })).toBe(0);
    expect(await t.prisma.post.count({ where: { groupId: group.id } })).toBe(0);
    expect(await t.prisma.auditLog.count({ where: { groupId: group.id } })).toBe(0);
  });

  it('não mexe em grupo com rodada nem em grupo com gente de fora', async () => {
    const dono = await createUser(t, { email: 'dono@dev.local' });
    const deFora = await createUser(t, { email: 'fora@example.com' });

    const comRodada = await createGroup(t, { name: 'Com rodada' });
    await addMember(t, dono.id, comRodada.id, { role: 'ADMIN' });
    await t.prisma.round.create({ data: { groupId: comRodada.id, scheduledAt: new Date() } });

    const misto = await createGroup(t, { name: 'Misto' });
    await addMember(t, dono.id, misto.id, { role: 'ADMIN' });
    await addMember(t, deFora.id, misto.id, { role: 'PLAYER' });

    const removed = await removeLeftoverDevGroups(t.prisma, [dono.id]);

    expect(removed).toEqual([]);
    expect(await t.prisma.group.count({ where: { id: { in: [comRodada.id, misto.id] } } })).toBe(2);
  });
});
