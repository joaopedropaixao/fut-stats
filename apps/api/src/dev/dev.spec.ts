import request from 'supertest';
import { addMember, createGroup, createUser } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';
import { devUsersSchema } from '@fut-stats/shared';
import { DevModule } from './dev.module';

describe('login de desenvolvimento', () => {
  describe('com NODE_ENV=development', () => {
    let t: TestApp;

    beforeAll(async () => {
      t = await createTestApp({ imports: [DevModule.forEnvironment('development')] });
    });

    beforeEach(async () => {
      await resetDatabase(t.prisma);
    });

    afterAll(async () => {
      await t.app.close();
    });

    const server = () => t.app.getHttpServer();

    it('lista as pessoas com os grupos e papéis, sem precisar de sessão', async () => {
      const carlos = await createUser(t, { name: 'Carlos', email: 'carlos@example.com' });
      await createUser(t, { name: 'Novato', email: 'novato@example.com' });
      const group = await createGroup(t, { name: 'Pelada X' });
      await addMember(t, carlos.id, group.id, { role: 'ADMIN' });

      const res = await request(server()).get('/api/dev/users').expect(200);

      expect(devUsersSchema.safeParse(res.body).success).toBe(true);
      expect(res.body).toEqual([
        {
          id: carlos.id,
          name: 'Carlos',
          memberships: [
            { nickname: 'Apelido', role: 'ADMIN', active: true, groupName: 'Pelada X' },
          ],
        },
        { id: expect.any(String), name: 'Novato', memberships: [] },
      ]);
    });

    it('entrar como alguém abre a sessão dessa pessoa', async () => {
      const user = await createUser(t);

      const res = await request(server()).post(`/api/dev/login/${user.id}`).expect(204);
      const cookie = (res.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

      const me = await request(server()).get('/api/me').set('Cookie', cookie).expect(200);
      expect(me.body.user.id).toBe(user.id);
    });

    it('pessoa que não existe → 404', async () => {
      await request(server()).post('/api/dev/login/nao-existe').expect(404);
    });
  });

  describe('fora de development', () => {
    it.each(['test', 'production', undefined])('NODE_ENV=%s não registra as rotas', async (env) => {
      const t = await createTestApp({ imports: [DevModule.forEnvironment(env)] });
      try {
        await request(t.app.getHttpServer()).get('/api/dev/users').expect(404);
        await request(t.app.getHttpServer()).post('/api/dev/login/qualquer').expect(404);
      } finally {
        await t.app.close();
      }
    });
  });
});
