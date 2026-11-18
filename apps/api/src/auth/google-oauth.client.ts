import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decodeIdToken, Google } from 'arctic';
import { z } from 'zod';
import type { Env } from '../config/env';

/** Caminho da callback, igual ao cadastrado no Google Cloud (com a origem da APP_URL na frente). */
export const GOOGLE_CALLBACK_PATH = '/api/auth/google/callback';

const SCOPES = ['openid', 'email', 'profile'];

/** O que o login usa da conta Google. */
export interface GoogleProfile {
  /** `sub` do ID token: o id fixo da conta (o e-mail pode mudar). */
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl: string | null;
}

const idTokenClaimsSchema = z.object({
  sub: z.string().min(1),
  email: z.email(),
  email_verified: z.boolean().default(false),
  name: z.string().min(1).optional(),
  picture: z.url().optional(),
});

/**
 * Fala com o Google (via arctic). É a única peça externa do login: nos testes, `exchangeCode` é trocado
 * por um fake e o resto (state, PKCE, User, sessão) roda de verdade.
 */
@Injectable()
export class GoogleOAuthClient {
  private readonly google: Google;

  constructor(config: ConfigService<Env, true>) {
    this.google = new Google(
      config.get('GOOGLE_CLIENT_ID', { infer: true }),
      config.get('GOOGLE_CLIENT_SECRET', { infer: true }),
      `${config.get('APP_URL', { infer: true })}${GOOGLE_CALLBACK_PATH}`,
    );
  }

  /** URL da tela de login do Google, com `state` e PKCE (S256). */
  authorizationUrl(state: string, codeVerifier: string): URL {
    return this.google.createAuthorizationURL(state, codeVerifier, SCOPES);
  }

  /**
   * Troca o `code` da callback pelos tokens e lê o perfil do ID token. A assinatura do ID token não é
   * conferida: ele vem direto do Google, pela conexão TLS da troca (OpenID Connect, seção 3.1.3.7).
   * Lança se o Google recusar o code ou devolver um token sem os dados esperados.
   */
  async exchangeCode(code: string, codeVerifier: string): Promise<GoogleProfile> {
    const tokens = await this.google.validateAuthorizationCode(code, codeVerifier);
    const claims = idTokenClaimsSchema.parse(decodeIdToken(tokens.idToken()));
    return {
      googleId: claims.sub,
      email: claims.email,
      emailVerified: claims.email_verified,
      name: claims.name ?? claims.email,
      avatarUrl: claims.picture ?? null,
    };
  }
}
