/** Banco dos testes de integração: o serviço db-test do docker-compose (porta 5433). */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/fut_stats_test';
