import type { INestApplication } from '@nestjs/common';

/** Configuração comum da app, usada no main.ts e nos testes. */
export function setupApp(app: INestApplication): void {
  // Todas as rotas ficam sob /api (ex.: GET /api/health), igual em dev e em produção.
  app.setGlobalPrefix('api');
}
