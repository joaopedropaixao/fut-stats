// Primeiro de tudo: os arquivos de ambiente no process.env, antes de o AppModule ser montado (ver load-env.ts).
import './load-env';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createAppLogger } from './common/app-logger';
import { initMonitoring, monitoringOptionsFromEnv } from './common/monitoring';
import type { Env } from './config/env';
import { setupApp } from './setup-app';

async function bootstrap() {
  // Antes do Nest: o Sentry já precisa estar de pé para pegar erro de subida. Sem SENTRY_DSN, não faz nada.
  initMonitoring(monitoringOptionsFromEnv(process.env));
  const app = await NestFactory.create(AppModule, {
    logger: createAppLogger(process.env.NODE_ENV),
  });
  setupApp(app);
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap();
