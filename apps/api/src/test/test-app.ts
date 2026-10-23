import type { DynamicModule, INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { setupApp } from '../setup-app';

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
}

export interface TestAppOptions {
  /** Controllers só de teste, registrados junto da app (ex.: para exercitar um guard sem rota de produção). */
  controllers?: Type[];
  /** Módulos de que esses controllers dependem (ex.: `AuthModule` para injetar o `SessionService`). */
  imports?: (Type | DynamicModule)[];
  /** Providers trocados por outra classe. Só para o que é externo (ex.: o Google); nunca o Prisma. */
  overrides?: { provide: Type; useClass: Type }[];
}

/** Sobe a app real (AppModule) apontando para o banco de teste. Feche com `app.close()`. */
export async function createTestApp({
  controllers = [],
  imports = [],
  overrides = [],
}: TestAppOptions = {}): Promise<TestApp> {
  const builder = Test.createTestingModule({
    imports: [AppModule, ...imports],
    controllers,
  });
  for (const { provide, useClass } of overrides)
    builder.overrideProvider(provide).useClass(useClass);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  setupApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/** Apaga os dados de todas as tabelas (mantém as migrations). Use no `beforeEach`. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const [{ db }] = await prisma.$queryRaw<[{ db: string }]>`SELECT current_database() AS db`;
  if (!db.endsWith('_test')) {
    throw new Error(`resetDatabase recusou apagar "${db}": só roda em banco *_test.`);
  }

  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;

  const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
