import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import type { Env } from '../config/env';
import { GoogleAuthService } from './google-auth.service';
import { Public } from './public.decorator';
import { SessionService, sessionCookieOptions } from './session.service';

/** Cookies da ida ao Google, lidos na volta: `state` (CSRF) e code verifier (PKCE). */
export const OAUTH_STATE_COOKIE = 'google_oauth_state';
export const OAUTH_VERIFIER_COOKIE = 'google_oauth_verifier';

const OAUTH_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

/** Para onde o navegador vai depois do login. Relativo: o navegador está na origem do front. */
export const LOGIN_SUCCESS_REDIRECT = '/';
export const LOGIN_ERROR_REDIRECT = '/?login=erro';

@Public()
@Controller('auth/google')
export class GoogleAuthController {
  constructor(
    private readonly googleAuth: GoogleAuthService,
    private readonly sessions: SessionService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get()
  start(@Res() res: Response): void {
    const { url, state, codeVerifier } = this.googleAuth.start();
    const options = { ...this.oauthCookieOptions(), maxAge: OAUTH_COOKIE_MAX_AGE_MS };
    res.cookie(OAUTH_STATE_COOKIE, state, options);
    res.cookie(OAUTH_VERIFIER_COOKIE, codeVerifier, options);
    res.redirect(url.toString());
  }

  @Get('callback')
  async callback(
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const cookies = (req.cookies ?? {}) as Record<string, unknown>;
    // Os cookies da ida valem uma volta só, dê certo ou não.
    res.clearCookie(OAUTH_STATE_COOKIE, this.oauthCookieOptions());
    res.clearCookie(OAUTH_VERIFIER_COOKIE, this.oauthCookieOptions());

    const result = await this.googleAuth.finish({
      code: asString(query.code),
      state: asString(query.state),
      error: asString(query.error),
      expectedState: asString(cookies[OAUTH_STATE_COOKIE]),
      codeVerifier: asString(cookies[OAUTH_VERIFIER_COOKIE]),
    });
    if (!result.ok) return res.redirect(LOGIN_ERROR_REDIRECT);

    this.sessions.createSession(res, result.userId);
    res.redirect(LOGIN_SUCCESS_REDIRECT);
  }

  /** Iguais ao da sessão (Lax deixa o cookie voltar no redirect do Google), só que restritos a estas rotas. */
  private oauthCookieOptions(): CookieOptions {
    return {
      ...sessionCookieOptions(this.config.get('NODE_ENV', { infer: true })),
      path: '/api/auth/google',
    };
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
