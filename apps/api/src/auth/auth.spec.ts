import { Controller, Param, Post, Res } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { meResponseSchema } from '@fut-stats/shared';
import type { Response } from 'express';
import request from 'supertest';
import { addMember, createGroup, createUser, loginAs } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';
import { AuthModule } from './auth.module';
import { Public } from './public.decorator';
import { SESSION_COOKIE, SessionService } from './session.service';

/** Só no teste: faz o papel do futuro callback do Google, que chama `createSession`. */
@Controller('test-login')
class TestLoginController {
  constructor(private readonly sessions: SessionService) {}

  @Public()
  @Post(':userId')
  login(@Param('userId') userId: string, @Res({ passthrough: true }) res: Response): void {
    this.sessions.createSession(res, userId);
  }
}

function setCookieHeader(res: request.Response): string {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = header?.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) throw new Error('resposta sem Set-Cookie de sessão');
  return cookie;
}

describe('sessão', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ controllers: [TestLoginController], imports: [AuthModule] });
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
  });

  afterAll(async () => {
    await t.app.close();
  });

  const server = () => t.app.getHttpServer();

  describe('rota protegida (GET /api/me)', () => {
    it('401 sem cookie', async () => {
      await request(server()).get('/api/me').expect(401);
    });

    it('401 com cookie que não é JWT', async () => {
      await request(server()).get('/api/me').set('Cookie', `${SESSION_COOKIE}=lixo`).expect(401);
    });

    it('401 com cookie adulterado (payload trocado, assinatura original)', async () => {
      const victim = await createUser(t);
      const attacker = await createUser(t);
      const [header, , signature] = t.app.get(SessionService).sign(attacker.id).split('.');
      const forgedPayload = Buffer.from(JSON.stringify({ sub: victim.id })).toString('base64url');

      await request(server())
        .get('/api/me')
        .set('Cookie', `${SESSION_COOKIE}=${header}.${forgedPayload}.${signature}`)
        .expect(401);
    });

    it('401 com token assinado por outro segredo', async () => {
      const user = await createUser(t);
      const token = new JwtService({ secret: 'outro-segredo-com-mais-de-32-caracteres!!' }).sign({
        sub: user.id,
      });

      await request(server())
        .get('/api/me')
        .set('Cookie', `${SESSION_COOKIE}=${token}`)
        .expect(401);
    });

    it('401 com token sem assinatura (alg "none")', async () => {
      const user = await createUser(t);
      const encode = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: user.id })}.`;

      await request(server())
        .get('/api/me')
        .set('Cookie', `${SESSION_COOKIE}=${token}`)
        .expect(401);
    });

    it('401 com cookie expirado', async () => {
      const user = await createUser(t);
      const token = t.app
        .get(JwtService)
        .sign({ sub: user.id, exp: Math.floor(Date.now() / 1000) - 60 });

      await request(server())
        .get('/api/me')
        .set('Cookie', `${SESSION_COOKIE}=${token}`)
        .expect(401);
    });

    it('401 quando o usuário da sessão não existe mais', async () => {
      await request(server())
        .get('/api/me')
        .set('Cookie', loginAs(t, 'usuario-que-nao-existe'))
        .expect(401);
    });
  });

  it('/api/health continua público', async () => {
    await request(server()).get('/api/health').expect(200);
  });

  describe('GET /api/me', () => {
    it('devolve o usuário e só os grupos em que ele é membro ativo, com o papel', async () => {
      const user = await createUser(t, { name: 'Fulano', email: 'fulano@example.com' });
      const admin = await createGroup(t, { name: 'A pelada' });
      const player = await createGroup(t, { name: 'B pelada' });
      const inactive = await createGroup(t, { name: 'C pelada' });
      await createGroup(t, { name: 'D pelada (não é membro)' });
      await addMember(t, user.id, admin.id, { role: 'ADMIN' });
      await addMember(t, user.id, player.id);
      await addMember(t, user.id, inactive.id, { active: false });

      const res = await request(server())
        .get('/api/me')
        .set('Cookie', loginAs(t, user.id))
        .expect(200);

      expect(meResponseSchema.safeParse(res.body).success).toBe(true);
      expect(res.body).toEqual({
        user: { id: user.id, name: 'Fulano', email: 'fulano@example.com', avatarUrl: null },
        groups: [
          { id: admin.id, name: 'A pelada', slug: admin.slug, role: 'ADMIN' },
          { id: player.id, name: 'B pelada', slug: player.slug, role: 'PLAYER' },
        ],
      });
    });

    it('usuário sem grupo recebe lista vazia', async () => {
      const user = await createUser(t);

      const res = await request(server())
        .get('/api/me')
        .set('Cookie', loginAs(t, user.id))
        .expect(200);

      expect(res.body.groups).toEqual([]);
    });
  });

  describe('createSession (o que o login vai usar)', () => {
    it('grava cookie httpOnly, SameSite=Lax, com validade, que abre a sessão', async () => {
      const user = await createUser(t);

      const res = await request(server()).post(`/api/test-login/${user.id}`).expect(201);
      const cookie = setCookieHeader(res);

      expect(cookie).toMatch(/; HttpOnly/);
      expect(cookie).toMatch(/; SameSite=Lax/);
      expect(cookie).toMatch(/; Path=\//);
      expect(cookie).toMatch(new RegExp(`; Max-Age=${30 * 24 * 60 * 60}`));
      expect(cookie).not.toMatch(/; Secure/); // NODE_ENV=test

      const session = cookie.split(';')[0]!;
      await request(server()).get('/api/me').set('Cookie', session).expect(200);
    });

    it('o JWT só carrega o userId (e as datas)', async () => {
      const user = await createUser(t);
      const token = t.app.get(SessionService).sign(user.id);

      const payload = t.app.get(JwtService).decode<Record<string, unknown>>(token);

      expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub']);
      expect(payload.sub).toBe(user.id);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('apaga o cookie de sessão', async () => {
      const user = await createUser(t);

      const res = await request(server())
        .post('/api/auth/logout')
        .set('Cookie', loginAs(t, user.id))
        .expect(204);
      const cookie = setCookieHeader(res);

      expect(cookie).toMatch(new RegExp(`^${SESSION_COOKIE}=;`));
      expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
      expect(cookie).toMatch(/; HttpOnly/);
      expect(cookie).toMatch(/; SameSite=Lax/);
    });

    it('funciona mesmo sem sessão válida', async () => {
      await request(server()).post('/api/auth/logout').expect(204);
    });
  });
});
