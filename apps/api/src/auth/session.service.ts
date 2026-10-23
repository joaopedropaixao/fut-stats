import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { CookieOptions, Response } from 'express';
import type { Env } from '../config/env';

/** Nome do cookie que guarda o JWT da sessão. */
export const SESSION_COOKIE = 'session';

const DAY_MS = 24 * 60 * 60 * 1000;

interface SessionPayload {
  /** id do User. */
  sub: string;
}

/**
 * Cria, lê e apaga a sessão: um JWT assinado (só com o userId) num cookie httpOnly.
 * Quem faz login (ex.: o callback do Google) só chama `createSession(res, userId)`.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Grava o cookie de sessão do usuário na resposta. */
  createSession(res: Response, userId: string): void {
    res.cookie(SESSION_COOKIE, this.sign(userId), {
      ...this.cookieOptions(),
      maxAge: this.ttlDays() * DAY_MS,
    });
  }

  /** Apaga o cookie de sessão (logout). */
  clearSession(res: Response): void {
    res.clearCookie(SESSION_COOKIE, this.cookieOptions());
  }

  /** Assina o token de sessão do usuário. */
  sign(userId: string): string {
    const payload: SessionPayload = { sub: userId };
    return this.jwt.sign(payload, { expiresIn: `${this.ttlDays()}d` });
  }

  /** O userId do token, ou `null` se ele for inválido, adulterado ou expirado. */
  verify(token: string): string | null {
    try {
      const { sub } = this.jwt.verify<Partial<SessionPayload>>(token, { algorithms: ['HS256'] });
      return typeof sub === 'string' && sub.length > 0 ? sub : null;
    } catch {
      return null;
    }
  }

  private ttlDays(): number {
    return this.config.get('SESSION_TTL_DAYS', { infer: true });
  }

  private cookieOptions(): CookieOptions {
    return sessionCookieOptions(this.config.get('NODE_ENV', { infer: true }));
  }
}

/** Atributos do cookie de sessão. A web chama a API pela mesma origem (proxy do Vite / rewrite da Vercel). */
export function sessionCookieOptions(nodeEnv: Env['NODE_ENV']): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: nodeEnv !== 'development' && nodeEnv !== 'test',
    path: '/',
  };
}
