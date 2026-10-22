import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { setupApp } from '../setup-app';

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
}

/** Sobe a app real (AppModule) apontando para o banco de teste. Feche com `app.close()`. */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
