import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { getRequestContext } from './request-context';

/** O Render chama a saúde a cada poucos segundos: não vale uma linha de log por chamada. */
const SILENT_PATHS: ReadonlySet<string> = new Set(['/api/health']);

const logger = new Logger('HTTP');

/**
 * Uma linha de log por pedido, quando a resposta termina: `requestId`, `method`, `path` (sem query), `status`,
 * `durationMs`, `userId` e `groupId`. Nunca corpo, cookie, email nem nome. Roda depois do `requestContextMiddleware`
 * e é middleware (não interceptor) para também cobrir o que guard, filtro ou rota inexistente recusam.
 */
export function requestLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();
  const context = getRequestContext();
  res.on('finish', () => {
    const path = (req.originalUrl.split('?')[0] ?? '').replace(/(?<=.)\/+$/, '');
    if (SILENT_PATHS.has(path)) return;
    logger.log({
      requestId: context?.requestId,
      method: req.method,
      path,
      status: res.statusCode,
      durationMs: Math.round(Number(process.hrtime.bigint() - startedAt) / 1e4) / 100,
      userId: context?.userId ?? null,
      groupId: context?.groupId ?? null,
    });
  });
  next();
}
