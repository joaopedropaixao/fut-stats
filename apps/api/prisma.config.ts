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
    // CLI (migrations) usa a conexão direta quando existe: o pooler do Neon não serve para migrate.
    // A API não passa por aqui; ela usa a DATABASE_URL (com pooling) no PrismaService.
    // `prisma generate` não conecta no banco; o fallback deixa gerar o client sem nenhuma URL.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
});
