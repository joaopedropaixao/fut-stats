import { basename, resolve } from 'node:path';

// Termina em _test: o resetDatabase só apaga banco com esse sufixo.
const PREFIX = 'fut_stats_';
const SUFFIX = '_test';
// Limite de nome de banco do Postgres.
const MAX_NAME = 63;

/**
 * Banco dos testes de integração: o serviço db-test do docker-compose (porta 5433), um banco por worktree
 * (nome da pasta), para dois worktrees rodando testes ao mesmo tempo não apagarem os dados um do outro.
 * O `prisma migrate deploy` do global-setup cria o banco se ele não existir. TEST_DATABASE_URL vence (CI).
 */
export function testDatabaseUrl(repoRoot: string, override?: string): string {
  if (override) return override;
  const slug = basename(repoRoot)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, MAX_NAME - PREFIX.length - SUFFIX.length);
  return `postgresql://postgres:postgres@localhost:5433/${PREFIX}${slug}${SUFFIX}`;
}

export const TEST_DATABASE_URL = testDatabaseUrl(
  resolve(__dirname, '../../../..'),
  process.env.TEST_DATABASE_URL,
);
