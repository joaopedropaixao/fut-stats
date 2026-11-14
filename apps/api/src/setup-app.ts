import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { rejectControlCharsInPath } from './common/reject-control-chars';

/** Configuração comum da app, usada no main.ts e nos testes. */
export function setupApp(app: INestApplication): void {
  // Todas as rotas ficam sob /api (ex.: GET /api/health), igual em dev e em produção.
  app.setGlobalPrefix('api');
  // Lê o cookie de sessão (req.cookies).
  app.use(cookieParser());
  // `\0` e outros controles no caminho → 404 em qualquer rota (sem 500 do Postgres).
  app.use(rejectControlCharsInPath);
}
