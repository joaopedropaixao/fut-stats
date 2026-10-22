import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './database-url';

/** Roda uma vez antes de todos os testes: aplica as migrations no banco de teste. */
export default function globalSetup(): void {
  execSync('pnpm exec prisma migrate deploy', {
    // DIRECT_URL também: o prisma.config.ts dá preferência a ela, e um .env local não pode desviar
    // as migrations dos testes para outro banco.
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DIRECT_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}
