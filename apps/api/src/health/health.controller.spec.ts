import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { healthResponseSchema } from '@fut-stats/shared';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { createTestApp } from '../test/test-app';
import { setupApp } from '../setup-app';
import { HealthModule } from './health.module';

describe('GET /api/health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('retorna { status: "ok" } no formato do schema compartilhado', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);

    expect(res.body).toEqual({ status: 'ok' });
    expect(healthResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it('C8: continua 200 com o banco fora do ar (o health não consulta o banco)', async () => {
    /** O banco numa porta onde ninguém escuta: qualquer consulta falha. */
    class DownPrismaService extends PrismaClient {
      constructor() {
        super({
          adapter: new PrismaPg({
            connectionString: 'postgresql://postgres:postgres@127.0.0.1:1/fut_stats',
          }),
        });
      }
      async onModuleDestroy(): Promise<void> {
        await this.$disconnect();
      }
    }
    const t = await createTestApp({
      overrides: [{ provide: PrismaService, useClass: DownPrismaService as never }],
    });
    try {
      await expect(t.prisma.$queryRaw`SELECT 1`).rejects.toThrow();

      const res = await request(t.app.getHttpServer()).get('/api/health').expect(200);

      expect(res.body).toEqual({ status: 'ok' });
    } finally {
      await t.app.close();
    }
  });
});
