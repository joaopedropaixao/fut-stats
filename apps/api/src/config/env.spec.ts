import { validateEnv } from './env';

const DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/fut_stats';

describe('validateEnv', () => {
  it('converte PORT para número', () => {
    expect(validateEnv({ PORT: '4000', DATABASE_URL }).PORT).toBe(4000);
  });

  it('usa a porta 3000 quando PORT não é informada', () => {
    expect(validateEnv({ DATABASE_URL }).PORT).toBe(3000);
  });

  it('falha quando PORT é inválida', () => {
    expect(() => validateEnv({ PORT: 'abc', DATABASE_URL })).toThrow(/PORT/);
  });

  it('falha sem DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('falha quando DATABASE_URL não é do Postgres', () => {
    expect(() => validateEnv({ DATABASE_URL: 'mysql://localhost/fut_stats' })).toThrow(
      /DATABASE_URL/,
    );
  });
});
