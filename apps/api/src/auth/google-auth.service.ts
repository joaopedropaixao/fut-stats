import { Injectable, Logger } from '@nestjs/common';
import { generateCodeVerifier, generateState } from 'arctic';
import { timingSafeEqual } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PENDING_GOOGLE_ID_PREFIX } from './pending-google-id';
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

  /**
   * O googleId é a chave; nome, e-mail (normalizado: minúsculas, sem espaço) e foto vêm sempre do Google. O caminho
   * normal é uma consulta só. Se o e-mail já é de outro User (P2002), o único caso que segue é a reserva de admin da
   * pelada de demonstração (`googleId` `pendente:`): ver `claimReservation`. O e-mail já chega verificado (`check`).
   */
  private async upsertUser({ googleId, email, name, avatarUrl }: GoogleProfile): Promise<string> {
    const normalized = email.trim().toLowerCase();
    try {
      const user = await this.prisma.user.upsert({
        where: { googleId },
        create: { googleId, email: normalized, name, avatarUrl },
        update: { email: normalized, name, avatarUrl },
        select: { id: true },
      });
      return user.id;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const claimed = await this.claimReservation({
          googleId,
          email: normalized,
          name,
          avatarUrl,
        });
        if (claimed) return claimed;
      }
      throw e;
    }
  }

  /**
   * Quem tem o e-mail é uma reserva (`pendente:`)? Então ela cede, numa transação só:
   * - sem User com esse googleId: a reserva vira o User (googleId real, nome e foto do Google, marcador some);
   * - com User real (que trocou de e-mail para este): as memberships da reserva passam para ele (se já for membro do
   *   grupo, ganha o papel ADMIN da reserva e a duplicada fica inativa) e a reserva é apagada (ou, se sobrou membership
   *   duplicada com histórico, aposentada com e-mail e googleId que ninguém assume).
   * Devolve o id do User que loga, ou null se o e-mail não é de uma reserva (a recusa segue como antes).
   */
  private async claimReservation({
    googleId,
    email,
    name,
    avatarUrl,
  }: Pick<GoogleProfile, 'googleId' | 'name' | 'avatarUrl'> & { email: string }): Promise<
    string | null
  > {
    return this.prisma.$transaction(async (tx) => {
      const reserved = await tx.user.findUnique({
        where: { email },
        select: { id: true, googleId: true },
      });
      if (!reserved || !reserved.googleId.startsWith(PENDING_GOOGLE_ID_PREFIX)) return null;

      const real = await tx.user.findUnique({ where: { googleId }, select: { id: true } });
      if (!real) {
        await tx.user.update({
          where: { id: reserved.id },
          data: { googleId, email, name, avatarUrl },
        });
        return reserved.id;
      }

      const memberships = await tx.membership.findMany({
        where: { userId: reserved.id },
        select: { id: true, groupId: true, role: true },
      });
      for (const membership of memberships) {
        const mine = await tx.membership.findUnique({
          where: { userId_groupId: { userId: real.id, groupId: membership.groupId } },
          select: { id: true, role: true },
        });
        if (!mine) {
          await tx.membership.update({ where: { id: membership.id }, data: { userId: real.id } });
        } else {
          if (membership.role === 'ADMIN' && mine.role !== 'ADMIN') {
            await tx.membership.update({
              where: { id: mine.id },
              data: { role: 'ADMIN', active: true },
            });
          }
          await tx.membership.update({ where: { id: membership.id }, data: { active: false } });
        }
      }

      const leftover = await tx.membership.count({ where: { userId: reserved.id } });
      if (leftover === 0) {
        await tx.user.delete({ where: { id: reserved.id } });
      } else {
        // Sobrou só a membership duplicada (inativa) que tem histórico: a reserva sai do caminho do e-mail e do marcador.
        await tx.user.update({
          where: { id: reserved.id },
          data: { email: `cedida-${reserved.id}@demo.invalid`, googleId: `cedida:${reserved.id}` },
        });
      }
      await tx.user.update({ where: { id: real.id }, data: { email, name, avatarUrl } });
      return real.id;
    });
  }
}

function sameState(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
