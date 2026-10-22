import { defineConfig } from 'prisma/config';

// O Prisma 7 não lê o .env sozinho. Sem .env (CI, produção), vale o ambiente.
try {
  process.loadEnvFile();
} catch {
  // sem .env
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // `prisma generate` não conecta no banco; o fallback deixa gerar o client sem DATABASE_URL.
    url: process.env.DATABASE_URL ?? '',
  },
});
