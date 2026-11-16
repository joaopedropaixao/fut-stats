import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { rejectControlCharsInPath } from './common/reject-control-chars';
import { requestContextMiddleware } from './common/request-context';
import { requestLogMiddleware } from './common/request-log';

/** Configuração comum da app, usada no main.ts e nos testes. */
export function setupApp(app: INestApplication): void {
  // Antes de tudo: dá um `x-request-id` ao pedido e abre o contexto que logs e registro da rodada leem.
  app.use(requestContextMiddleware);
  app.use(requestLogMiddleware);
  // Todas as rotas ficam sob /api (ex.: GET /api/health), igual em dev e em produção.
  app.setGlobalPrefix('api');
  // Lê o cookie de sessão (req.cookies).
  app.use(cookieParser());
  // `\0` e outros controles no caminho → 404 em qualquer rota (sem 500 do Postgres).
  app.use(rejectControlCharsInPath);
  // Erro inesperado vira 500 com `requestId` no corpo e a pilha só no log.
  app.useGlobalFilters(new AllExceptionsFilter(app.getHttpAdapter()));
  // Testes não poluem a saída com o log de pedido (quem quer ver o log captura o `Logger`).
  if (process.env.NODE_ENV === 'test') app.useLogger(false);
}
