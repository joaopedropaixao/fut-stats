import { createHash, timingSafeEqual } from 'node:crypto';
import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

/** Token de injeção do segredo do despertador (o `TICK_SECRET` do ambiente). */
export const TICK_SECRET = Symbol('TICK_SECRET');

/** Compara em tempo constante: o hash tem sempre 32 bytes, então o tamanho do segredo não vaza pelo tempo de resposta. */
function sameSecret(received: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(received), digest(expected));
}

/**
 * Protege a rota do despertador: só vale `Authorization: Bearer <TICK_SECRET>`. Sessão, query, corpo e outros
 * esquemas não valem. Qualquer falha é o mesmo 401, sem dizer o motivo.
 */
@Injectable()
export class TickSecretGuard implements CanActivate {
  constructor(@Inject(TICK_SECRET) private readonly secret: string) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    const match = typeof header === 'string' ? /^Bearer (.+)$/i.exec(header) : null;
    if (!match?.[1] || !sameSecret(match[1], this.secret)) throw new UnauthorizedException();
    return true;
  }
}
