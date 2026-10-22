import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './database-url';

/** Roda uma vez antes de todos os testes: aplica as migrations no banco de teste. */
export default function globalSetup(): void {
  execSync('pnpm exec prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}
