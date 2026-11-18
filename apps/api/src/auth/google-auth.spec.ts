import { Injectable } from '@nestjs/common';
import request from 'supertest';
import { DEMO_GROUP, seedDemo } from '../seed/demo';
import { createUser } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';
import {
  LOGIN_ERROR_REDIRECT,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
} from './google-auth.controller';
import { GoogleOAuthClient, type GoogleProfile } from './google-oauth.client';
import { SESSION_COOKIE } from './session.service';

/** Troca só a conversa com o Google; a URL de login, o state, o PKCE, o banco e a sessão são os reais. */
@Injectable()
class FakeGoogleOAuthClient extends GoogleOAuthClient {
  /** O que o "Google" devolve na próxima troca de code (ou o erro que ele dá). */
  next: GoogleProfile | Error = new Error('nenhum perfil configurado no teste');
  calls: { code: string; codeVerifier: string }[] = [];

  override async exchangeCode(code: string, codeVerifier: string): Promise<GoogleProfile> {
    this.calls.push({ code, codeVerifier });
    if (this.next instanceof Error) throw this.next;
    return this.next;
  }
}

const profile = (data: Partial<GoogleProfile> = {}): GoogleProfile => ({
  googleId: 'google-sub-123',
  email: 'fulano@gmail.com',
  emailVerified: true,
  name: 'Fulano de Tal',
  avatarUrl: 'https://lh3.googleusercontent.com/a/foto',
  ...data,
});

function setCookies(res: request.Response): string[] {
  return (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
}

function findCookie(res: request.Response, name: string): string | undefined {
  return setCookies(res).find((c) => c.startsWith(`${name}=`));
}

/** Valor de um cookie no Set-Cookie (sem os atributos). */
function cookieValue(res: request.Response, name: string): string {
  const cookie = findCookie(res, name);
  if (!cookie) throw new Error(`resposta sem Set-Cookie de ${name}`);
  return decodeURIComponent(cookie.split(';')[0]!.slice(name.length + 1));
}

describe('login com Google', () => {
  let t: TestApp;
  let google: FakeGoogleOAuthClient;

  beforeAll(async () => {
    t = await createTestApp({
      overrides: [{ provide: GoogleOAuthClient, useClass: FakeGoogleOAuthClient }],
    });
    google = t.app.get(GoogleOAuthClient);
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
    google.next = new Error('nenhum perfil configurado no teste');
    google.calls = [];
  });

  afterAll(async () => {
    await t.app.close();
  });

  const server = () => t.app.getHttpServer();

  /** Faz a ida (GET /api/auth/google) e devolve o state e o verifier que ela guardou. */
  async function startLogin() {
    const res = await request(server()).get('/api/auth/google').expect(302);
    return {
      state: cookieValue(res, OAUTH_STATE_COOKIE),
      codeVerifier: cookieValue(res, OAUTH_VERIFIER_COOKIE),
    };
  }

  /** A volta do Google: callback com a query e os cookies da ida. */
  function callback(query: Record<string, string>, cookies: Record<string, string>) {
    const cookieHeader = Object.entries(cookies)
      .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
      .join('; ');
    const req = request(server()).get('/api/auth/google/callback').query(query);
    return cookieHeader ? req.set('Cookie', cookieHeader) : req;
  }

  /** Ida + volta com sucesso, com o perfil que o "Google" devolve. */
  async function login(next: GoogleProfile) {
    google.next = next;
    const { state, codeVerifier } = await startLogin();
    return callback(
      { code: 'code-do-google', state },
      { [OAUTH_STATE_COOKIE]: state, [OAUTH_VERIFIER_COOKIE]: codeVerifier },
    );
  }

  describe('GET /api/auth/google', () => {
    it('é público e redireciona para o Google com openid/email/profile, state e PKCE', async () => {
      const res = await request(server()).get('/api/auth/google').expect(302);
      const url = new URL(res.headers.location as string);

      expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url.searchParams.get('client_id')).toBe(process.env.GOOGLE_CLIENT_ID);
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('scope')).toBe('openid email profile');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('code_challenge')).toBeTruthy();
      // Da configuração (APP_URL), não do host da requisição.
      expect(url.searchParams.get('redirect_uri')).toBe(
        'http://localhost:5173/api/auth/google/callback',
      );
      expect(url.searchParams.get('state')).toBe(cookieValue(res, OAUTH_STATE_COOKIE));
    });

    it('guarda state e verifier em cookies httpOnly, Lax, de 10 minutos, só nas rotas do Google', async () => {
      const res = await request(server()).get('/api/auth/google').expect(302);

      for (const name of [OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE]) {
        const cookie = findCookie(res, name);
        expect(cookie).toMatch(/; HttpOnly/);
        expect(cookie).toMatch(/; SameSite=Lax/);
        expect(cookie).toMatch(/; Max-Age=600/);
        expect(cookie).toMatch(/; Path=\/api\/auth\/google/);
      }
    });

    it('cada ida gera um state novo', async () => {
      const first = await startLogin();
      const second = await startLogin();

      expect(first.state).not.toBe(second.state);
      expect(first.codeVerifier).not.toBe(second.codeVerifier);
    });
  });

  describe('GET /api/auth/google/callback', () => {
    it('primeiro login: cria o User, abre a sessão e redireciona para /', async () => {
      const res = await login(profile());

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/');
      const users = await t.prisma.user.findMany();
      expect(users).toHaveLength(1);
      expect(users[0]).toMatchObject({
        googleId: 'google-sub-123',
        email: 'fulano@gmail.com',
        name: 'Fulano de Tal',
        avatarUrl: 'https://lh3.googleusercontent.com/a/foto',
      });
    });

    it('troca o code com o verifier guardado na ida (PKCE)', async () => {
      google.next = profile();
      const { state, codeVerifier } = await startLogin();

      await callback(
        { code: 'code-do-google', state },
        { [OAUTH_STATE_COOKIE]: state, [OAUTH_VERIFIER_COOKIE]: codeVerifier },
      ).expect(302);

      expect(google.calls).toEqual([{ code: 'code-do-google', codeVerifier }]);
    });

    it('o cookie de sessão sai e /api/me funciona depois', async () => {
      const res = await login(profile());

      const session = findCookie(res, SESSION_COOKIE);
      expect(session).toMatch(/; HttpOnly/);
      const me = await request(server())
        .get('/api/me')
        .set('Cookie', session!.split(';')[0]!)
        .expect(200);
      expect(me.body.user).toMatchObject({
        name: 'Fulano de Tal',
        email: 'fulano@gmail.com',
        avatarUrl: 'https://lh3.googleusercontent.com/a/foto',
      });
    });

    it('segundo login atualiza nome, e-mail e foto sem duplicar o User', async () => {
      await login(profile());
      const [before] = await t.prisma.user.findMany();

      const res = await login(
        profile({ name: 'Fulano Novo', email: 'novo@gmail.com', avatarUrl: 'https://foto/nova' }),
      );

      expect(res.status).toBe(302);

      const users = await t.prisma.user.findMany();
      expect(users).toHaveLength(1);
      expect(users[0]).toMatchObject({
        id: before!.id,
        name: 'Fulano Novo',
        email: 'novo@gmail.com',
        avatarUrl: 'https://foto/nova',
      });
    });

    it('apaga os cookies de state e verifier na volta', async () => {
      const res = await login(profile());

      for (const name of [OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE]) {
        expect(findCookie(res, name)).toMatch(/Expires=Thu, 01 Jan 1970/);
      }
    });

    describe('recusa (redireciona para /?login=erro, sem sessão e sem falar com o Google)', () => {
      async function expectRefused(res: request.Response) {
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe(LOGIN_ERROR_REDIRECT);
        expect(findCookie(res, SESSION_COOKIE)).toBeUndefined();
        expect(await t.prisma.user.count()).toBe(0);
      }

      beforeEach(() => {
        google.next = profile();
      });

      it('sem o cookie de state', async () => {
        const { state, codeVerifier } = await startLogin();

        await expectRefused(
          await callback({ code: 'c', state }, { [OAUTH_VERIFIER_COOKIE]: codeVerifier }),
        );
        expect(google.calls).toEqual([]);
      });

      it('sem o state na query', async () => {
        const { state, codeVerifier } = await startLogin();

        await expectRefused(
          await callback(
            { code: 'c' },
            { [OAUTH_STATE_COOKIE]: state, [OAUTH_VERIFIER_COOKIE]: codeVerifier },
          ),
        );
        expect(google.calls).toEqual([]);
      });

      it('com state diferente do cookie (CSRF)', async () => {
        const { state, codeVerifier } = await startLogin();

        await expectRefused(
          await callback(
            { code: 'c', state: 'state-do-atacante' },
            { [OAUTH_STATE_COOKIE]: state, [OAUTH_VERIFIER_COOKIE]: codeVerifier },
          ),
        );
        expect(google.calls).toEqual([]);
      });

      it('sem o cookie do verifier', async () => {
        const { state } = await startLogin();

        await expectRefused(await callback({ code: 'c', state }, { [OAUTH_STATE_COOKIE]: state }));
        expect(google.calls).toEqual([]);
      });

      it('quando a pessoa cancela no Google (error=access_denied)', async () => {
        const { state, codeVerifier } = await startLogin();

        await expectRefused(
          await callback(
            { error: 'access_denied', state },
            { [OAUTH_STATE_COOKIE]: state, [OAUTH_VERIFIER_COOKIE]: codeVerifier },
          ),
        );
        expect(google.calls).toEqual([]);
      });
    });

    describe('recusa depois da troca do code', () => {
      async function expectRefused(res: request.Response) {
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe(LOGIN_ERROR_REDIRECT);
        expect(findCookie(res, SESSION_COOKIE)).toBeUndefined();
      }

      it('e-mail não verificado no Google: não cria User', async () => {
        await expectRefused(await login(profile({ emailVerified: false })));
        expect(await t.prisma.user.count()).toBe(0);
      });

      it('o Google recusa o code', async () => {
        google.next = new Error('invalid_grant');
        const { state, codeVerifier } = await startLogin();

        await expectRefused(
          await callback(
            { code: 'code-vencido', state },
            { [OAUTH_STATE_COOKIE]: state, [OAUTH_VERIFIER_COOKIE]: codeVerifier },
          ),
        );
        expect(await t.prisma.user.count()).toBe(0);
      });

      it('e-mail já é de outro User (outra conta Google): não junta nem sobrescreve', async () => {
        const other = await createUser(t, { email: 'fulano@gmail.com' });

        await expectRefused(await login(profile()));

        const users = await t.prisma.user.findMany();
        expect(users).toHaveLength(1);
        expect(users[0]).toMatchObject({ id: other.id, googleId: other.googleId });
      });
    });

    describe('reserva de admin da pelada de demonstração (googleId "pendente:")', () => {
      const RESERVED_EMAIL = 'nova.admin@gmail.com';
      const SEED_TIMEOUT_MS = 30_000;

      /** Roda a demo com um e-mail sem conta: sai uma reserva + membership ADMIN. */
      async function reserve(email = RESERVED_EMAIL) {
        await seedDemo(t.prisma, { admins: [email], now: new Date('2026-10-24T15:10:00Z') });
        const user = await t.prisma.user.findFirstOrThrow({
          where: { googleId: { startsWith: 'pendente:' } },
        });
        return user;
      }

      it(
        'C8: o primeiro login com o e-mail da reserva assume a reserva e entra como admin da demo',
        async () => {
          const reserved = await reserve();
          expect(reserved.googleId).toBe(`pendente:${RESERVED_EMAIL}`);
          const usersBefore = await t.prisma.user.count();

          const res = await login(
            profile({ googleId: 'google-sub-nova', email: RESERVED_EMAIL, name: 'Nova Admin' }),
          );

          expect(res.status).toBe(302);
          expect(res.headers.location).not.toContain('login=erro');
          // Mesmo User (a membership continua nele), sem User novo; o marcador some.
          expect(await t.prisma.user.count()).toBe(usersBefore);
          const user = await t.prisma.user.findUniqueOrThrow({ where: { id: reserved.id } });
          expect(user).toMatchObject({
            googleId: 'google-sub-nova',
            email: RESERVED_EMAIL,
            name: 'Nova Admin',
            avatarUrl: 'https://lh3.googleusercontent.com/a/foto',
          });
          expect(
            await t.prisma.user.count({ where: { googleId: { startsWith: 'pendente:' } } }),
          ).toBe(0);

          const group = await t.prisma.group.findUniqueOrThrow({
            where: { slug: DEMO_GROUP.slug },
          });
          const membership = await t.prisma.membership.findFirstOrThrow({
            where: { groupId: group.id, userId: reserved.id },
          });
          expect(membership.role).toBe('ADMIN');
          const session = findCookie(res, SESSION_COOKIE)!;
          await request(server())
            .get(`/api/groups/${group.id}`)
            .set('Cookie', session.split(';')[0]!)
            .expect(200);
        },
        SEED_TIMEOUT_MS,
      );

      it('C8: depois de assumir, o segundo login é normal (mesmo googleId, sem duplicar)', async () => {
        await t.prisma.user.create({
          data: {
            email: RESERVED_EMAIL,
            name: 'nova.admin',
            googleId: `pendente:${RESERVED_EMAIL}`,
          },
        });
        const p = profile({ googleId: 'google-sub-nova', email: RESERVED_EMAIL });
        await login(p);
        await login(p);

        const users = await t.prisma.user.findMany();
        expect(users).toHaveLength(1);
        expect(users[0]!.googleId).toBe('google-sub-nova');
      });

      it('C9: outra conta Google com e-mail diferente não assume a reserva (a reserva fica igual)', async () => {
        const reserved = await t.prisma.user.create({
          data: {
            email: RESERVED_EMAIL,
            name: 'nova.admin',
            googleId: `pendente:${RESERVED_EMAIL}`,
          },
        });

        const res = await login(
          profile({ googleId: 'google-sub-outro', email: 'outro@gmail.com' }),
        );

        expect(res.status).toBe(302);
        const after = await t.prisma.user.findUniqueOrThrow({ where: { id: reserved.id } });
        expect(after).toMatchObject({
          googleId: `pendente:${RESERVED_EMAIL}`,
          email: RESERVED_EMAIL,
        });
        const outro = await t.prisma.user.findUniqueOrThrow({
          where: { googleId: 'google-sub-outro' },
        });
        expect(outro.id).not.toBe(reserved.id);
      });

      it('C9b: mesmo e-mail com email_verified=false recusa e a reserva fica intacta', async () => {
        const reserved = await t.prisma.user.create({
          data: {
            email: RESERVED_EMAIL,
            name: 'nova.admin',
            googleId: `pendente:${RESERVED_EMAIL}`,
          },
        });

        const res = await login(
          profile({ googleId: 'google-sub-fake', email: RESERVED_EMAIL, emailVerified: false }),
        );

        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('login=erro');
        expect(findCookie(res, SESSION_COOKIE)).toBeUndefined();
        const users = await t.prisma.user.findMany();
        expect(users).toHaveLength(1);
        expect(users[0]).toMatchObject({
          id: reserved.id,
          googleId: `pendente:${RESERVED_EMAIL}`,
          name: 'nova.admin',
          avatarUrl: null,
        });
      });

      it(
        'C9c: e-mail da lista com maiúsculas e espaço vira reserva em minúsculas e o login minúsculo assume',
        async () => {
          const reserved = await reserve('  Nova.Admin@Gmail.com ');
          expect(reserved.email).toBe(RESERVED_EMAIL);

          const res = await login(profile({ googleId: 'google-sub-nova', email: RESERVED_EMAIL }));

          expect(res.headers.location).not.toContain('login=erro');
          const user = await t.prisma.user.findUniqueOrThrow({ where: { id: reserved.id } });
          expect(user.googleId).toBe('google-sub-nova');
        },
        SEED_TIMEOUT_MS,
      );

      it('C9c: o Google devolvendo o e-mail com maiúsculas também assume a reserva', async () => {
        const reserved = await t.prisma.user.create({
          data: {
            email: RESERVED_EMAIL,
            name: 'nova.admin',
            googleId: `pendente:${RESERVED_EMAIL}`,
          },
        });

        await login(profile({ googleId: 'google-sub-nova', email: 'Nova.Admin@Gmail.com' }));

        const users = await t.prisma.user.findMany();
        expect(users).toHaveLength(1);
        expect(users[0]).toMatchObject({ id: reserved.id, googleId: 'google-sub-nova' });
      });

      it('C9d: sem reserva o login é o de sempre (novo e existente), e quem tem outro Google continua recusado', async () => {
        // Novo
        const first = await login(profile());
        expect(first.headers.location).not.toContain('login=erro');
        expect(await t.prisma.user.count()).toBe(1);
        // Existente (mesmo googleId)
        await login(profile({ name: 'Fulano Novo' }));
        const users = await t.prisma.user.findMany();
        expect(users).toHaveLength(1);
        expect(users[0]!.name).toBe('Fulano Novo');
        // Outro Google com o e-mail de um User normal (googleId sem o prefixo): recusa, como hoje
        const refused = await login(profile({ googleId: 'google-sub-outro' }));
        expect(refused.headers.location).toContain('login=erro');
        expect((await t.prisma.user.findMany())[0]!.googleId).toBe('google-sub-123');
      });
    });
  });
});
