import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { healthResponseSchema } from '@fut-stats/shared';
import request from 'supertest';
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
});
