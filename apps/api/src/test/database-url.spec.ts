import { testDatabaseUrl } from './database-url';

describe('testDatabaseUrl', () => {
  it('um banco por worktree, com o nome da pasta', () => {
    expect(testDatabaseUrl('/Users/x/orca/workspaces/fut-stats/montar-times-back')).toBe(
      'postgresql://postgres:postgres@localhost:5433/fut_stats_montar_times_back_test',
    );
  });

  it('worktrees diferentes não dividem o banco', () => {
    expect(testDatabaseUrl('/a/montar-times-back')).not.toBe(
      testDatabaseUrl('/a/montar-times-front'),
    );
  });

  it('o nome cabe no limite de 63 caracteres do Postgres', () => {
    const name = new URL(testDatabaseUrl(`/a/${'fatia-'.repeat(20)}`)).pathname.slice(1);
    expect(name.length).toBeLessThanOrEqual(63);
    expect(name).toMatch(/^fut_stats_[a-z0-9_]+_test$/);
  });

  it('TEST_DATABASE_URL vence (CI)', () => {
    expect(testDatabaseUrl('/a/qualquer', 'postgresql://ci/fut_stats_test')).toBe(
      'postgresql://ci/fut_stats_test',
    );
  });
});
