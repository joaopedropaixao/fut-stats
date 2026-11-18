import { Injectable, Logger } from '@nestjs/common';
import { generateCodeVerifier, generateState } from 'arctic';
import { timingSafeEqual } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleOAuthClient, type GoogleProfile } from './google-oauth.client';

/** O que a callback recebeu: a query do Google e o que a ida guardou nos cookies. */
export interface GoogleCallbackInput {
  code?: string;
  state?: string;
  /** Ex.: `access_denied` quando a pessoa cancela na tela do Google. */
  error?: string;
  expectedState?: string;
  codeVerifier?: string;
}

export type GoogleLoginResult = { ok: true; userId: string } | { ok: false; reason: string };

/** Login com Google: começa o fluxo (state + PKCE) e, na volta, confere tudo e cria/atualiza o User. */
@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);

  constructor(
    private readonly google: GoogleOAuthClient,
    private readonly prisma: PrismaService,
  ) {}

  /** Gera o `state` (CSRF) e o code verifier (PKCE) e monta a URL do Google. */
  start(): { url: URL; state: string; codeVerifier: string } {
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    return { url: this.google.authorizationUrl(state, codeVerifier), state, codeVerifier };
  }

  /** Confere a volta do Google e devolve o User logado, ou o motivo da recusa (vai para o log). */
  async finish(input: GoogleCallbackInput): Promise<GoogleLoginResult> {
    const result = await this.check(input);
    if (!result.ok) this.logger.warn(`Login com Google recusado: ${result.reason}`);
    return result;
  }

  private async check(input: GoogleCallbackInput): Promise<GoogleLoginResult> {
    const { code, state, error, expectedState, codeVerifier } = input;
    if (error) return { ok: false, reason: `Google devolveu erro "${error}"` };
    if (!state || !expectedState || !sameState(state, expectedState)) {
      return { ok: false, reason: 'state ausente ou diferente do cookie' };
    }
    if (!code || !codeVerifier) return { ok: false, reason: 'sem code ou sem code verifier' };

    let profile: GoogleProfile;
    try {
      profile = await this.google.exchangeCode(code, codeVerifier);
    } catch (e) {
      return { ok: false, reason: `troca do code falhou (${e instanceof Error ? e.message : e})` };
    }
    if (!profile.emailVerified) return { ok: false, reason: 'e-mail não verificado no Google' };

    try {
      return { ok: true, userId: await this.upsertUser(profile) };
    } catch (e) {
      // E-mail já usado por outro User (outra conta Google): não junta contas sozinho.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return { ok: false, reason: 'e-mail já pertence a outro usuário' };
      }
      throw e;
    }
  }

  /** O googleId é a chave; nome, e-mail e foto vêm sempre do Google (atualizados a cada login). */
  private async upsertUser({ googleId, email, name, avatarUrl }: GoogleProfile): Promise<string> {
    const user = await this.prisma.user.upsert({
      where: { googleId },
      create: { googleId, email, name, avatarUrl },
      update: { email, name, avatarUrl },
      select: { id: true },
    });
    return user.id;
  }
}

function sameState(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
